import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Eye,
  KeyRound,
  ListTree,
  LogIn,
  LockKeyhole,
  Share2,
} from 'lucide-react'
import { isValidElement, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { publicApi, resolveSameOriginServerUrl, resolveServerUrl } from '../../shared/api/client'
import type { Article } from '../../shared/api/types'
import { ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { RemoteImage } from '../../shared/components/RemoteImage'
import { formatDate, splitCommaList } from '../../shared/lib/format'
import { KATEX_OPTIONS, normalizeMarkdownMath } from '../../shared/lib/markdownMath'
import { openExternalUrl } from '../../shared/lib/platform'
import { useSettings } from '../../shared/settings/SettingsContext'
import { useUserAuth } from '../account/UserAuthContext'
import { CommentsSection } from './CommentsSection'

export function ArticleDetailPage() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const auth = useUserAuth()
  const [unlocked, setUnlocked] = useState<Article | null>(null)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const query = useQuery({
    queryKey: ['article', settings.serverUrl, id, auth.user?.id ?? 'guest'],
    queryFn: ({ signal }) => publicApi.article(settings.serverUrl, id, auth.accessToken, signal),
    enabled: Boolean(id) && !auth.loading,
  })
  const unlock = useMutation({
    mutationFn: () => publicApi.unlockArticle(settings.serverUrl, id, password, auth.accessToken),
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
  const renderedContent = useMemo(() => normalizeMarkdownMath(article?.content), [article?.content])
  const headingIdsByLine = useMemo(() => new Map(
    parseToc(article?.content).map((item) => [item.sourceLine, item.id]),
  ), [article?.content])

  if (query.isPending) return <LoadingState label="正在打开文章" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!article) return null

  const loginRequired = Boolean(article.loginRequired || (article.requiresLogin && !auth.isAuthenticated))
  const requiresPassword = !loginRequired && article.requiresPassword && !unlocked
  const staticUrl = resolveSameOriginServerUrl(settings.serverUrl, article.staticSiteUrl)
  const share = async () => {
    const url = resolveServerUrl(settings.serverUrl, `/blog/${article.id}`)
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  const resolveHeadingId = (node: { position?: { start?: { line?: number } } } | undefined, children: ReactNode) => {
    const sourceLine = node?.position?.start?.line
    return (sourceLine ? headingIdsByLine.get(sourceLine) : undefined) ?? slugify(childrenToText(children))
  }

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
            {article.requiresLogin && <span><LogIn size={14} /> 登录可见</span>}
          </div>
        </div>
        {article.coverImage && <RemoteImage className="article-header-cover" source={article.coverImage} alt={article.title} />}
      </header>

      {loginRequired ? (
        <section className="unlock-panel">
          <span className="unlock-icon"><LogIn size={24} /></span>
          <h3>登录后查看文章</h3>
          <p>作者已将正文和评论设为登录后可见，登录账号即可继续阅读。</p>
          <Link className="button button-primary" to="/account"><LogIn size={16} /> 登录账号</Link>
        </section>
      ) : requiresPassword ? (
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
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
            />
          </section>
        ) : <ErrorState error={new Error('静态文章地址暂不可用')} />
      ) : (
        <div className={`reader-layout${toc.length ? '' : ' no-toc'}`}>
          <article className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeSanitize, [rehypeKatex, KATEX_OPTIONS]]}
              components={{
                a: ({ node: _node, href, children, ...props }) => {
                  if (href?.startsWith('#')) return <a href={href} {...props}>{children}</a>
                  const target = resolveServerUrl(settings.serverUrl, href)
                  return <a href={target} {...props} onClick={(event) => { event.preventDefault(); void openExternalUrl(target) }}>{children}</a>
                },
                img: ({ node: _node, src, alt }) => <RemoteImage source={src} alt={alt || ''} loading="lazy" />,
                h2: ({ node, children, ...props }) => <h2 id={resolveHeadingId(node, children)} {...props}>{children}</h2>,
                h3: ({ node, children, ...props }) => <h3 id={resolveHeadingId(node, children)} {...props}>{children}</h3>,
                h4: ({ node, children, ...props }) => <h4 id={resolveHeadingId(node, children)} {...props}>{children}</h4>,
                h5: ({ node, children, ...props }) => <h5 id={resolveHeadingId(node, children)} {...props}>{children}</h5>,
                h6: ({ node, children, ...props }) => <h6 id={resolveHeadingId(node, children)} {...props}>{children}</h6>,
              }}
            >
              {renderedContent}
            </ReactMarkdown>
          </article>
          {toc.length > 0 && <ArticleTableOfContents items={toc} />}
        </div>
      )}

      {!loginRequired && !requiresPassword && article.contentType !== 'static' && <CommentsSection articleId={article.id} />}

      {!loginRequired && !requiresPassword && (
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

export type TocItem = {
  level: number
  text: string
  id: string
}

export type TocNode = TocItem & {
  children: TocNode[]
}

type TocSourceItem = TocItem & {
  sourceLine: number
}

type TocTreeItemProps = {
  node: TocNode
  depth: number
  activeId: string
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  onHeadingClick: (event: MouseEvent<HTMLButtonElement>, id: string) => void
}

function ArticleTableOfContents({ items }: { items: TocItem[] }) {
  const tree = useMemo(() => buildTocTree(items), [items])
  const branchIds = useMemo(() => collectBranchIds(tree), [tree])
  const ancestorMap = useMemo(() => buildAncestorMap(tree), [tree])
  const scrollRef = useRef<HTMLElement>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [activeId, setActiveId] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsedIds(new Set())
    setActiveId(items[0]?.id ?? '')
    setMobileOpen(false)
  }, [items])

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => Boolean(heading))
    const root = document.querySelector<HTMLElement>('.content-scroll')
    if (headings.length === 0 || !root) return undefined

    let headingOffsets: number[] = []
    let updateFrame = 0
    let measureFrame = 0
    let disposed = false

    const activateHeading = () => {
      updateFrame = 0
      if (disposed || headingOffsets.length === 0) return

      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      const readingOffset = Math.min(Math.max(root.clientHeight * 0.18, 72), 160)
      const index = atBottom
        ? headings.length - 1
        : findActiveHeadingIndex(headingOffsets, root.scrollTop + readingOffset)
      const nextId = headings[index]?.id
      if (!nextId) return

      setActiveId((current) => current === nextId ? current : nextId)
      setCollapsedIds((current) => removeCollapsedAncestors(current, ancestorMap.get(nextId) ?? []))
    }

    const scheduleUpdate = () => {
      if (disposed) return
      if (!updateFrame) updateFrame = window.requestAnimationFrame(activateHeading)
    }

    const measureHeadings = () => {
      measureFrame = 0
      if (disposed) return
      const rootTop = root.getBoundingClientRect().top
      headingOffsets = headings.map((heading) => heading.getBoundingClientRect().top - rootTop + root.scrollTop)
      scheduleUpdate()
    }

    const scheduleMeasure = () => {
      if (disposed) return
      if (!measureFrame) measureFrame = window.requestAnimationFrame(measureHeadings)
    }

    root.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleMeasure, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    const articleBody = headings[0].closest('.markdown-body')
    if (articleBody) resizeObserver?.observe(articleBody)
    void document.fonts?.ready.then(scheduleMeasure)
    scheduleMeasure()

    return () => {
      disposed = true
      root.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleMeasure)
      resizeObserver?.disconnect()
      if (updateFrame) window.cancelAnimationFrame(updateFrame)
      if (measureFrame) window.cancelAnimationFrame(measureFrame)
    }
  }, [ancestorMap, items])

  useEffect(() => {
    const navigation = scrollRef.current
    if (!navigation || navigation.clientHeight === 0) return undefined

    const frame = window.requestAnimationFrame(() => {
      const activeRow = navigation.querySelector<HTMLElement>('[aria-current="location"]')?.closest<HTMLElement>('.article-toc-row')
      if (!activeRow) return

      const navigationRect = navigation.getBoundingClientRect()
      const rowRect = activeRow.getBoundingClientRect()
      const topOverflow = rowRect.top - navigationRect.top
      const bottomOverflow = rowRect.bottom - navigationRect.bottom
      if (topOverflow < 0) navigation.scrollTop += topOverflow
      else if (bottomOverflow > 0) navigation.scrollTop += bottomOverflow
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeId, collapsedIds, mobileOpen])

  const toggleBranch = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleHeadingClick = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    const heading = document.getElementById(id)
    if (!heading) return

    event.preventDefault()
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    setActiveId(id)
    setCollapsedIds((current) => removeCollapsedAncestors(current, ancestorMap.get(id) ?? []))
    setMobileOpen(false)
  }

  return (
    <aside className={`article-toc${mobileOpen ? ' mobile-expanded' : ''}`}>
      <div className="article-toc-header">
        <ListTree size={15} aria-hidden="true" />
        <strong>文章目录</strong>
        <span>{items.length}</span>
        {branchIds.length > 0 && (
          <div className="article-toc-actions">
            <button type="button" onClick={() => setCollapsedIds(new Set())} aria-label="展开全部目录" title="展开全部">
              <ChevronsDown size={15} />
            </button>
            <button type="button" onClick={() => setCollapsedIds(new Set(branchIds))} aria-label="折叠全部目录" title="折叠全部">
              <ChevronsUp size={15} />
            </button>
          </div>
        )}
        <button
          type="button"
          className="mobile-toc-disclosure"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="article-toc-navigation"
          aria-label={mobileOpen ? '收起文章目录' : '展开文章目录'}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      <nav ref={scrollRef} id="article-toc-navigation" className="article-toc-scroll" aria-label="文章目录" tabIndex={0}>
        <ul>
          {tree.map((node) => (
            <TocTreeItem
              key={node.id}
              node={node}
              depth={0}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggle={toggleBranch}
              onHeadingClick={handleHeadingClick}
            />
          ))}
        </ul>
      </nav>
    </aside>
  )
}

function TocTreeItem({ node, depth, activeId, collapsedIds, onToggle, onHeadingClick }: TocTreeItemProps) {
  const hasChildren = node.children.length > 0
  const collapsed = collapsedIds.has(node.id)
  const active = activeId === node.id
  const childrenId = `toc-children-${node.id}`

  return (
    <li>
      <div className={`article-toc-row${active ? ' active' : ''}`} style={{ paddingInlineStart: `${Math.min(depth, 4) * 10}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="article-toc-toggle"
            onClick={() => onToggle(node.id)}
            aria-expanded={!collapsed}
            aria-controls={childrenId}
            aria-label={`${collapsed ? '展开' : '折叠'} ${node.text}`}
            title={collapsed ? '展开子目录' : '折叠子目录'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : <span className="article-toc-toggle-spacer" aria-hidden="true" />}
        <button
          type="button"
          className="article-toc-link"
          onClick={(event) => onHeadingClick(event, node.id)}
          aria-current={active ? 'location' : undefined}
          title={node.text}
        >
          {node.text}
        </button>
      </div>
      {hasChildren && !collapsed && (
        <ul id={childrenId}>
          {node.children.map((child) => (
            <TocTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onHeadingClick={onHeadingClick}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function buildToc(markdown?: string): TocItem[] {
  return parseToc(markdown).map(({ sourceLine: _sourceLine, ...item }) => item)
}

function parseToc(markdown?: string): TocSourceItem[] {
  const counts = new Map<string, number>()
  const items: TocSourceItem[] = []
  let fence: { character: string; length: number } | null = null

  const lines = String(markdown ?? '').split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) fence = { character: marker[0], length: marker.length }
      else if (marker[0] === fence.character && marker.length >= fence.length) fence = null
      continue
    }
    if (fence) continue

    const match = /^\s*(#{2,6})[\t ]+(.+?)(?:[\t ]+#+[\t ]*)?$/.exec(line)
    if (!match) continue
    const text = stripMarkdown(match[2])
    if (!text) continue
    const base = slugify(text)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    items.push({
      level: match[1].length,
      text,
      id: count ? `${base}-${count + 1}` : base,
      sourceLine: lineIndex + 1,
    })
  }

  return items
}

export function buildTocTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = []
  const stack: TocNode[] = []

  for (const item of items) {
    const node: TocNode = { ...item, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length > 0) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  }

  return roots
}

function collectBranchIds(nodes: TocNode[]): string[] {
  return nodes.flatMap((node) => node.children.length > 0 ? [node.id, ...collectBranchIds(node.children)] : [])
}

function buildAncestorMap(nodes: TocNode[], ancestors: string[] = [], map = new Map<string, string[]>()) {
  for (const node of nodes) {
    map.set(node.id, ancestors)
    buildAncestorMap(node.children, [...ancestors, node.id], map)
  }
  return map
}

function removeCollapsedAncestors(current: Set<string>, ancestors: string[]) {
  if (!ancestors.some((id) => current.has(id))) return current
  const next = new Set(current)
  ancestors.forEach((id) => next.delete(id))
  return next
}

export function findActiveHeadingIndex(offsets: number[], readingPosition: number): number {
  if (offsets.length === 0) return -1

  let low = 0
  let high = offsets.length - 1
  let active = 0
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle] <= readingPosition) {
      active = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return active
}

function childrenToText(children: ReactNode): string {
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (isValidElement<{ children?: ReactNode }>(children)) return childrenToText(children.props.children)
  return ''
}

function slugify(value: string): string {
  return stripMarkdown(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section'
}

function stripMarkdown(value: string): string {
  return String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_`~]/g, '')
    .trim()
}
