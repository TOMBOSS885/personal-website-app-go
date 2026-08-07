import 'katex/dist/katex.min.css'
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { Check, Copy, Link as LinkIcon } from 'lucide-react'
import OptimizedImage from './OptimizedImage'
import { KATEX_OPTIONS, normalizeMarkdownMath } from '../utils/markdownMath'
import { remarkGithubAlerts, remarkSafeHtml } from '../utils/markdownPlugins'

export default function MarkdownArticleRenderer({ content, resolveHeadingId, onRendered }) {
  useEffect(() => {
    onRendered?.()
  }, [content, onRendered])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkSafeHtml, remarkGithubAlerts]}
      rehypePlugins={[[rehypeKatex, KATEX_OPTIONS], rehypeHighlight]}
      components={{
        a: ({ node, href, children, ...props }) => {
          if (!isSafeMarkdownHref(href)) return <span>{children}</span>
          const external = /^https?:\/\//i.test(href || '')
          return <a {...props} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer nofollow' : undefined}>{children}</a>
        },
        table: ({ node, ...props }) => (
          <div className="article-table-wrap">
            <table {...props} />
          </div>
        ),
        // Mark the code child explicitly. react-markdown exposes HAST nodes to
        // components, so relying on a node type here would confuse inline code
        // and fenced code after dependency upgrades.
        pre: ({ children }) => isValidElement(children)
          ? cloneElement(children, { markdownBlock: true })
          : <>{children}</>,
        code: MarkdownCode,
        h2: ({ node, children, ...props }) => <MarkdownHeading level={2} id={resolveHeadingId(node, children)} {...props}>{children}</MarkdownHeading>,
        h3: ({ node, children, ...props }) => <MarkdownHeading level={3} id={resolveHeadingId(node, children)} {...props}>{children}</MarkdownHeading>,
        h4: ({ node, children, ...props }) => <MarkdownHeading level={4} id={resolveHeadingId(node, children)} {...props}>{children}</MarkdownHeading>,
        h5: ({ node, children, ...props }) => <MarkdownHeading level={5} id={resolveHeadingId(node, children)} {...props}>{children}</MarkdownHeading>,
        h6: ({ node, children, ...props }) => <MarkdownHeading level={6} id={resolveHeadingId(node, children)} {...props}>{children}</MarkdownHeading>,
        img: MarkdownImage,
      }}
    >
      {normalizeMarkdownMath(content || '')}
    </ReactMarkdown>
  )
}

function MarkdownHeading({ level, id, children, ...props }) {
  const HeadingTag = `h${level}`
  return (
    <HeadingTag id={id} {...props}>
      {id && (
        <a className="article-heading-anchor" href={`#${id}`} aria-label="打开标题锚点" title="打开标题锚点">
          <LinkIcon aria-hidden="true" />
        </a>
      )}
      {children}
    </HeadingTag>
  )
}

function MarkdownCode({ node: _node, markdownBlock = false, className, children, ...props }) {
  const source = String(children || '').replace(/\n$/, '')
  const language = /language-([\w-]+)/i.exec(className || '')?.[1] || 'text'
  const [copied, setCopied] = useState(false)
  const isBlock = markdownBlock

  // react-markdown does not consistently pass an `inline` prop across
  // versions. The explicit pre marker is stable for both fenced and indented
  // blocks, while double-backtick spans stay inline.
  if (!isBlock) return <code className={className} {...props}>{children}</code>
  if (language.toLowerCase() === 'mermaid') return <MermaidDiagram source={source} />

  const copyCode = async () => {
    try {
      await copyText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{language}</span>
        <button type="button" className="markdown-code-copy" onClick={copyCode} aria-label={copied ? '代码已复制' : '复制代码'}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre><code className={className} {...props}>{children}</code></pre>
    </div>
  )
}

function MermaidDiagram({ source }) {
  const diagramRef = useRef(null)
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [status, setStatus] = useState('loading')
  const [themeVersion, setThemeVersion] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    if (typeof MutationObserver === 'undefined') return undefined
    const observer = new MutationObserver(() => setThemeVersion(version => version + 1))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false

    const renderDiagram = async () => {
      setStatus('loading')
      try {
        // Mermaid is split from the main article bundle and is only fetched for
        // a fenced ```mermaid block. Strict mode prevents diagram text from
        // injecting arbitrary HTML into the blog page.
        const { default: mermaid } = await import('mermaid')
        const dark = document.documentElement.classList.contains('theme-dark')
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'default',
          flowchart: { htmlLabels: false, useMaxWidth: true },
        })
        const result = await mermaid.render(`blog-mermaid-${instanceId}-${themeVersion}`, source)
        if (disposed || !diagramRef.current) return
        diagramRef.current.innerHTML = result.svg
        result.bindFunctions?.(diagramRef.current)
        setStatus('ready')
      } catch {
        if (!disposed) setStatus('error')
      }
    }

    void renderDiagram()
    return () => { disposed = true }
  }, [instanceId, source, themeVersion])

  if (status === 'error') {
    return (
      <div className="markdown-mermaid-error" role="note">
        Mermaid 图表语法无法渲染。请检查此代码块的语法。
        <pre><code>{source}</code></pre>
      </div>
    )
  }

  return (
    <div className={`markdown-mermaid ${status === 'loading' ? 'is-loading' : ''}`} aria-busy={status === 'loading'}>
      {status === 'loading' && <span className="markdown-mermaid-loading">正在绘制图表...</span>}
      <div ref={diagramRef} className="markdown-mermaid-canvas" />
    </div>
  )
}

function MarkdownImage({ src, alt, title, ...props }) {
  return (
    <figure className="markdown-image-figure">
      <OptimizedImage
        {...props}
        src={src}
        alt={alt}
        title={title}
        loading="lazy"
        sizes="(min-width: 1024px) 768px, (min-width: 768px) 85vw, 100vw"
        wrapperClassName="block"
      />
      {(title || alt) && <figcaption>{title || alt}</figcaption>}
    </figure>
  )
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('copy failed')
}

function isSafeMarkdownHref(href) {
  if (!href) return false
  const value = String(href).trim()
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('./') || value.startsWith('../')) return true
  return /^(?:https?:|mailto:|tel:)/i.test(value)
}
