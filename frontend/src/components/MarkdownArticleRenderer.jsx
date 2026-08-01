import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import OptimizedImage from './OptimizedImage'
import { KATEX_OPTIONS, normalizeMarkdownMath } from '../utils/markdownMath'
import { remarkGithubAlerts, remarkSafeHtml } from '../utils/markdownPlugins'

export default function MarkdownArticleRenderer({ content, resolveHeadingId }) {
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
        h2: ({ node, children, ...props }) => <h2 id={resolveHeadingId(node, children)} {...props}>{children}</h2>,
        h3: ({ node, children, ...props }) => <h3 id={resolveHeadingId(node, children)} {...props}>{children}</h3>,
        h4: ({ node, children, ...props }) => <h4 id={resolveHeadingId(node, children)} {...props}>{children}</h4>,
        h5: ({ node, children, ...props }) => <h5 id={resolveHeadingId(node, children)} {...props}>{children}</h5>,
        h6: ({ node, children, ...props }) => <h6 id={resolveHeadingId(node, children)} {...props}>{children}</h6>,
        img: ({ node, ...props }) => (
          <OptimizedImage {...props} loading="lazy" sizes="(min-width: 768px) 768px, 100vw" wrapperClassName="block" />
        ),
      }}
    >
      {normalizeMarkdownMath(content || '')}
    </ReactMarkdown>
  )
}

function isSafeMarkdownHref(href) {
  if (!href) return false
  const value = String(href).trim()
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('./') || value.startsWith('../')) return true
  return /^(?:https?:|mailto:|tel:)/i.test(value)
}
