import 'katex/dist/katex.min.css'
import { cloneElement, isValidElement, memo, useEffect, useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { Check, Copy, Link as LinkIcon } from 'lucide-react'
import OptimizedImage from './OptimizedImage'
import { KATEX_OPTIONS, normalizeMarkdownMath, remarkSingleLineDisplayMath } from '../utils/markdownMath'
import { remarkGithubAlerts, remarkSafeHtml } from '../utils/markdownPlugins'

function MarkdownArticleRenderer({ content, resolveHeadingId, onRendered }) {
  useEffect(() => {
    onRendered?.()
  }, [content, onRendered])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkSingleLineDisplayMath, remarkSafeHtml, remarkGithubAlerts]}
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

// Article reading progress updates on every scroll event. Keep the Markdown
// tree mounted while that unrelated state changes so expensive Mermaid nodes
// are not recreated during scrolling.
export default memo(MarkdownArticleRenderer)

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

const mermaidDiagramCache = new Map()
let mermaidRenderSequence = 0

function MermaidDiagram({ source }) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [status, setStatus] = useState(() => getMermaidCache(source, getMermaidThemeKey()) ? 'ready' : 'loading')
  const [diagramSvg, setDiagramSvg] = useState(() => getMermaidCache(source, getMermaidThemeKey()) || '')
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
      const dark = document.documentElement.classList.contains('theme-dark')
      const cachedSrc = getMermaidCache(source, dark ? 'dark' : 'light')
      if (cachedSrc) {
        setDiagramSvg(cachedSrc)
        setStatus('ready')
        return
      }

      // Keep an already-rendered image visible while a theme variant is
      // generated. This prevents a transient loading placeholder during
      // unrelated DOM updates and theme changes.
      setStatus(current => current === 'ready' ? current : 'loading')
      try {
        // Mermaid is split from the main article bundle and is only fetched for
        // a fenced ```mermaid block. Strict mode prevents diagram text from
        // injecting arbitrary HTML into the blog page.
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'default',
          flowchart: { htmlLabels: false, useMaxWidth: true },
        })
        const result = await mermaid.render(`blog-mermaid-${instanceId}-${++mermaidRenderSequence}`, source)
        if (disposed || typeof result.svg !== 'string') return
        // Mermaid labels containing <br/> use foreignObject markup. Browsers do
        // not reliably decode those SVGs through data: or blob: image URLs, so
        // keep Mermaid's strict-mode output inline after an additional pass
        // that removes executable elements, event handlers and external links.
        const nextSvg = sanitizeMermaidSvg(result.svg)
        if (!nextSvg) {
          if (!disposed) setStatus('error')
          return
        }
        mermaidDiagramCache.set(getMermaidCacheKey(source, dark ? 'dark' : 'light'), nextSvg)
        setDiagramSvg(nextSvg)
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
      {diagramSvg && (
        <div
          className="markdown-mermaid-canvas"
          role="img"
          aria-label="Mermaid diagram"
          dangerouslySetInnerHTML={{ __html: diagramSvg }}
        />
      )}
    </div>
  )
}

export function sanitizeMermaidSvg(svg) {
  if (typeof svg !== 'string' || !/^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg.trim())) return ''
  if (typeof DOMParser === 'undefined') return ''

  // Mermaid's foreignObject labels are valid HTML but are not always valid
  // standalone XML (notably when labels contain <br/>). Parse in an inert HTML
  // document so those labels survive, then retain only the verified SVG root.
  const document = new DOMParser().parseFromString(svg, 'text/html')
  const root = document.body.querySelector('svg')
  if (!root) return ''

  root.querySelectorAll('script, iframe, object, embed, audio, video, link, meta').forEach(node => node.remove())
  root.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on')) node.removeAttribute(attribute.name)
      if ((name === 'href' || name === 'xlink:href') && value && !value.startsWith('#')) {
        node.removeAttribute(attribute.name)
      }
    })
  })

  return root.outerHTML
}

export function getMermaidCacheKey(source, theme = 'light') {
  return `${theme}:${String(source || '')}`
}

function getMermaidThemeKey() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light'
}

function getMermaidCache(source, theme) {
  return mermaidDiagramCache.get(getMermaidCacheKey(source, theme)) || ''
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
