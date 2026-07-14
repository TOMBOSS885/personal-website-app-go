import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Eye, KeyRound, LockKeyhole, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { publicApi, resolveServerUrl } from '../../shared/api/client'
import type { Article } from '../../shared/api/types'
import { ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { RemoteImage } from '../../shared/components/RemoteImage'
import { formatDate, splitCommaList } from '../../shared/lib/format'
import { openExternalUrl } from '../../shared/lib/platform'
import { useSettings } from '../../shared/settings/SettingsContext'
import { CommentsSection } from './CommentsSection'

export function ArticleDetailPage() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const [unlocked, setUnlocked] = useState<Article | null>(null)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const query = useQuery({
    queryKey: ['article', settings.serverUrl, id],
    queryFn: ({ signal }) => publicApi.article(settings.serverUrl, id, signal),
    enabled: Boolean(id),
  })
  const unlock = useMutation({
    mutationFn: () => publicApi.unlockArticle(settings.serverUrl, id, password),
    onSuccess: (article) => {
      setUnlocked(article)
      setPassword('')
    },
  })

  useEffect(() => {
    setUnlocked(null)
    setPassword('')
  }, [id, settings.serverUrl])

  const article = unlocked ?? query.data
  const toc = useMemo(() => buildToc(article?.content), [article?.content])

  if (query.isPending) return <LoadingState label="正在打开文章" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!article) return null

  const requiresPassword = article.requiresPassword && !unlocked
  const staticUrl = resolveServerUrl(settings.serverUrl, article.staticSiteUrl)
  const share = async () => {
    const url = resolveServerUrl(settings.serverUrl, `/blog/${article.id}`)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  let headingRenderIndex = 0

  return (
    <div className="page article-reader-page">
      <Link className="back-link" to="/articles"><ArrowLeft size={16} /> 返回文章</Link>
      <header className="article-header">
        <div className="article-header-copy">
          <div className="article-kicker"><span>{article.category || '随笔'}</span><span>{formatDate(article.createdAt)}</span></div>
          <h2>{article.title}</h2>
          <p>{article.summary || (requiresPassword ? '这篇文章需要访问密码。' : '')}</p>
          <div className="article-byline">
            <span><Eye size={15} /> {article.views ?? 0} 次阅读</span>
            {article.contentType === 'static' && <span>交互式页面</span>}
            {article.isLocked && <span><LockKeyhole size={14} /> 受保护</span>}
          </div>
        </div>
        {article.coverImage && <RemoteImage className="article-header-cover" source={article.coverImage} alt={article.title} />}
      </header>

      {requiresPassword ? (
        <section className="unlock-panel">
          <span className="unlock-icon"><KeyRound size={24} /></span>
          <h3>输入访问密码</h3>
          <p>密码只用于本次解锁，不会保存在设备上。</p>
          <form onSubmit={(event) => { event.preventDefault(); unlock.mutate() }}>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="文章访问密码" autoFocus />
            <button className="button button-primary" type="submit" disabled={!password || unlock.isPending}>
              {unlock.isPending ? '正在验证' : '解锁阅读'}
            </button>
          </form>
          {unlock.isError && <span className="form-error">{unlock.error.message}</span>}
        </section>
      ) : article.contentType === 'static' ? (
        staticUrl ? (
          <section className="static-reader">
            <iframe
              title={article.title}
              src={staticUrl}
              sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads allow-presentation"
              referrerPolicy="no-referrer"
            />
          </section>
        ) : <ErrorState error={new Error('静态文章地址暂不可用')} />
      ) : (
        <div className={`reader-layout${toc.length ? '' : ' no-toc'}`}>
          <article className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                a: ({ node: _node, href, children, ...props }) => {
                  if (href?.startsWith('#')) return <a href={href} {...props}>{children}</a>
                  const target = resolveServerUrl(settings.serverUrl, href)
                  return <a href={target} {...props} onClick={(event) => { event.preventDefault(); void openExternalUrl(target) }}>{children}</a>
                },
                img: ({ node: _node, src, alt }) => <RemoteImage source={src} alt={alt || ''} loading="lazy" />,
                h2: ({ node: _node, children, ...props }) => {
                  const idValue = toc[headingRenderIndex]?.id || slugify(childrenToText(children))
                  headingRenderIndex += 1
                  return <h2 id={idValue} {...props}>{children}</h2>
                },
                h3: ({ node: _node, children, ...props }) => {
                  const idValue = toc[headingRenderIndex]?.id || slugify(childrenToText(children))
                  headingRenderIndex += 1
                  return <h3 id={idValue} {...props}>{children}</h3>
                },
              }}
            >
              {article.content}
            </ReactMarkdown>
          </article>
          {toc.length > 0 && (
            <aside className="article-toc">
              <strong>文章目录</strong>
              <nav>{toc.map((item) => <a key={`${item.level}-${item.id}`} className={item.level === 3 ? 'nested' : ''} href={`#${item.id}`}>{item.text}</a>)}</nav>
            </aside>
          )}
        </div>
      )}

      {!requiresPassword && article.contentType !== 'static' && <CommentsSection articleId={article.id} />}

      {!requiresPassword && (
        <footer className="article-footer">
          <div className="tag-row">{splitCommaList(article.tags).map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <button className="button button-secondary" onClick={share}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? '链接已复制' : '分享文章'}
          </button>
        </footer>
      )}
    </div>
  )
}

function buildToc(markdown?: string) {
  const counts = new Map<string, number>()
  return String(markdown ?? '').split(/\r?\n/).flatMap((line) => {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim())
    if (!match) return []
    const text = match[2].replace(/[#*_`~[\]()]/g, '').trim()
    const base = slugify(text)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    return [{ level: match[1].length, text, id: count ? `${base}-${count + 1}` : base }]
  })
}

function childrenToText(children: ReactNode): string {
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  return ''
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section'
}
