import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, ListTree, Lock, LogIn, Share2, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import OptimizedImage from '../components/OptimizedImage'
import CommentSection from '../components/CommentSection'
import { useUserAuth } from '../contexts/UserAuthContext'
import { KATEX_OPTIONS, normalizeMarkdownMath } from '../utils/markdownMath'

export default function ArticleDetailPage() {
  const { id } = useParams()
  const { user, loading: authLoading, authFetch, openLogin } = useUserAuth()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shareStatus, setShareStatus] = useState('idle')
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const tocItems = useMemo(() => buildToc(article?.content || ''), [article?.content])
  const headingIdsByLine = useMemo(() => new Map(
    parseToc(article?.content || '').map(item => [item.sourceLine, item.id]),
  ), [article?.content])
  const renderedContent = useMemo(() => normalizeMarkdownMath(article?.content || ''), [article?.content])

  useEffect(() => {
    if (authLoading) return undefined
    let active = true
    setLoading(true)
    setPassword('')
    setUnlockError('')
    authFetch(`/api/public/articles/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active) {
          setArticle(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setArticle(null)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [id, authLoading, authFetch, user?.id])

  const handleShare = async () => {
    const shareUrl = window.location.href
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = shareUrl
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!copied) throw new Error('copy failed')
      }
      setShareStatus('copied')
      window.setTimeout(() => setShareStatus('idle'), 2000)
    } catch {
      setShareStatus('failed')
      window.setTimeout(() => setShareStatus('idle'), 2500)
    }
  }

  const handleUnlock = async (event) => {
    event.preventDefault()
    if (!password.trim() || unlocking) return
    setUnlocking(true)
    setUnlockError('')
    try {
      const res = await authFetch(`/api/public/articles/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || '密码错误，请重试')
      }
      const data = await res.json()
      setArticle(data)
      setPassword('')
    } catch (err) {
      setUnlockError(err.message || '解锁失败，请重试')
    } finally {
      setUnlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent"
          />
          <p className="text-gray-500 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-4xl dark:bg-slate-800">📄</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-slate-100">文章不存在</h2>
          <p className="mb-6 text-gray-500 dark:text-slate-400">该文章可能已被删除或移除</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 font-medium text-white transition-all hover:scale-105 hover:shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            返回博客
          </Link>
        </div>
      </div>
    )
  }

  if (article.loginRequired || (article.requiresLogin && !user)) {
    return (
      <div className="min-h-screen bg-transparent px-4 pb-12 pt-28">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/70 md:p-8">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <LogIn className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              {article.category && (
                <span className="mb-3 inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">{article.category}</span>
              )}
              <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-slate-100 md:text-4xl">{article.title}</h1>
              {article.summary && <p className="mt-3 text-gray-600 dark:text-slate-300">{article.summary}</p>}
              <p className="mt-5 text-sm leading-relaxed text-gray-500 dark:text-slate-400">作者已将这篇文章设为登录后可查看。登录后即可阅读正文并参与评论。</p>
              <button
                type="button"
                onClick={() => openLogin(`/blog/${id}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <LogIn className="h-4 w-4" />
                登录后查看
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (article.requiresPassword) {
    return (
      <div className="min-h-screen bg-transparent px-4 pb-12 pt-28">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/70 md:p-8">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              {article.category && (
                <span className="mb-3 inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                  {article.category}
                </span>
              )}
              <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-slate-100 md:text-4xl">{article.title}</h1>
              {article.summary && <p className="mt-3 text-gray-600 dark:text-slate-300">{article.summary}</p>}
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-400 dark:text-slate-500">
                <span>{new Date(article.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>·</span>
                <span>{article.views || 0} 阅读</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">这篇文章已加锁，请输入访问密码</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="输入文章密码"
              />
              <button
                type="submit"
                disabled={unlocking || !password.trim()}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 font-medium text-white shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {unlocking ? '验证中...' : '解锁阅读'}
              </button>
            </div>
            {unlockError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{unlockError}</p>}
          </form>
        </div>
      </div>
    )
  }

  const resolveHeadingId = (node, children) => {
    const sourceLine = node?.position?.start?.line
    return (sourceLine ? headingIdsByLine.get(sourceLine) : undefined) || headingIdFromChildren(children)
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-[92rem] px-4 pb-8 pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_18rem] lg:gap-6">
        <div className="rounded-3xl border border-white/50 bg-white/60 px-5 py-6 shadow-lg shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/50 md:px-8 lg:col-start-2">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>

          <div className="mb-4">
            {article.category && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-3">
                <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                  {article.category}
                </span>
              </motion.div>
            )}
            <h1 className="text-4xl font-bold leading-tight text-gray-900 dark:text-slate-100 md:text-5xl">
              {article.title}
            </h1>
          </div>

          <div className="flex items-center gap-4 border-b border-gray-100 pb-6 text-sm text-gray-400 dark:border-slate-800 dark:text-slate-500">
            <span>{new Date(article.createdAt).toLocaleDateString('zh-CN')}</span>
            <span>·</span>
            <span>{article.views || 0} 阅读</span>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-auto max-w-[92rem] px-4 pb-12 pt-8"
      >
        <div className={article.contentType === 'static' ? '' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_18rem]'}>
          <div className={`rounded-3xl border border-white/60 bg-white/75 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60 ${article.contentType === 'static' ? 'mx-auto max-w-[80rem] p-2 md:p-3' : 'px-5 py-6 md:px-8 md:py-8 lg:col-start-2'}`}>
            {article.contentType === 'static' ? (
              article.staticSiteUrl ? (
                <iframe
                  title={article.title}
                  src={article.staticSiteUrl}
                  sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads allow-presentation"
                  allow="autoplay; fullscreen; picture-in-picture"
                  referrerPolicy="no-referrer"
                  className="h-[75vh] min-h-[480px] w-full rounded-2xl border-0 bg-white md:min-h-[620px]"
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-gray-50 px-6 text-center text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                  静态前端资源暂时不可用，请稍后重试。
                </div>
              )
            ) : (
            <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="article-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, KATEX_OPTIONS], rehypeHighlight]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="article-table-wrap">
                      <table {...props} />
                    </div>
                  ),
                  h2: ({ node, children, ...props }) => {
                    return <h2 id={resolveHeadingId(node, children)} {...props}>{children}</h2>
                  },
                  h3: ({ node, children, ...props }) => {
                    return <h3 id={resolveHeadingId(node, children)} {...props}>{children}</h3>
                  },
                  h4: ({ node, children, ...props }) => {
                    return <h4 id={resolveHeadingId(node, children)} {...props}>{children}</h4>
                  },
                  h5: ({ node, children, ...props }) => {
                    return <h5 id={resolveHeadingId(node, children)} {...props}>{children}</h5>
                  },
                  h6: ({ node, children, ...props }) => {
                    return <h6 id={resolveHeadingId(node, children)} {...props}>{children}</h6>
                  },
                  img: ({ node, ...props }) => (
                    <OptimizedImage {...props} loading="lazy" sizes="(min-width: 768px) 768px, 100vw" wrapperClassName="block" />
                  )
                }}
              >
                {renderedContent}
              </ReactMarkdown>
            </motion.article>
            )}
          </div>

          {article.contentType !== 'static' && tocItems.length > 0 && (
            <aside className="hidden lg:col-start-3 lg:block">
              <ArticleTableOfContents items={tocItems} />
            </aside>
          )}
        </div>

        {article.contentType !== 'static' && <CommentSection articleId={article.id || id} />}

        {article.tags && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-12 border-t border-gray-100 pt-8 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-5 w-5 text-gray-400" />
              {article.tags.split(',').map((tag, index) => (
                <Link key={index} to={`/blog?tag=${encodeURIComponent(tag.trim())}`} className="rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  #{tag.trim()}
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 flex items-center justify-end">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleShare} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-white shadow-lg">
            {shareStatus === 'copied' ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
            <span>{shareStatus === 'copied' ? '已复制分享链接' : shareStatus === 'failed' ? '复制失败，请手动复制' : '分享'}</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}

function ArticleTableOfContents({ items }) {
  const tree = useMemo(() => buildTocTree(items), [items])
  const branchIds = useMemo(() => collectBranchIds(tree), [tree])
  const ancestorMap = useMemo(() => buildAncestorMap(tree), [tree])
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    setCollapsedIds(new Set())
    const syncHash = () => {
      let hash = ''
      try {
        hash = decodeURIComponent(window.location.hash.slice(1))
      } catch {
        hash = ''
      }
      const nextActiveId = items.some(item => item.id === hash) ? hash : (items[0]?.id || '')
      setActiveId(nextActiveId)
      const ancestors = ancestorMap.get(nextActiveId) || []
      if (ancestors.length) {
        setCollapsedIds(current => {
          if (!ancestors.some(ancestorId => current.has(ancestorId))) return current
          const next = new Set(current)
          ancestors.forEach(ancestorId => next.delete(ancestorId))
          return next
        })
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [ancestorMap, items])

  const toggleBranch = id => {
    setCollapsedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleHeadingClick = (event, id) => {
    const heading = document.getElementById(id)
    if (!heading) return
    event.preventDefault()
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`)
    setActiveId(id)
    const ancestors = ancestorMap.get(id) || []
    if (ancestors.length) {
      setCollapsedIds(current => {
        if (!ancestors.some(ancestorId => current.has(ancestorId))) return current
        const next = new Set(current)
        ancestors.forEach(ancestorId => next.delete(ancestorId))
        return next
      })
    }
  }

  return (
    <div className="sticky top-40 flex max-h-[calc(100vh-11rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 pb-3 dark:border-slate-800">
        <ListTree className="h-4 w-4 text-indigo-500" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-slate-100">文章目录</div>
        <span className="text-xs tabular-nums text-gray-400 dark:text-slate-500">{items.length}</span>
        {branchIds.length > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setCollapsedIds(new Set())}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
              aria-label="展开全部目录"
              title="展开全部"
            >
              <ChevronsDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsedIds(new Set(branchIds))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
              aria-label="折叠全部目录"
              title="折叠全部"
            >
              <ChevronsUp className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <nav className="article-toc-scroll mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-label="文章目录" tabIndex={0}>
        <ul className="space-y-0.5">
          {tree.map(node => (
            <TocTreeItem
              key={node.id}
              node={node}
              depth={0}
              activeId={activeId}
              collapsedIds={collapsedIds}
              toggleBranch={toggleBranch}
              handleHeadingClick={handleHeadingClick}
            />
          ))}
        </ul>
      </nav>
    </div>
  )
}

function TocTreeItem({ node, depth, activeId, collapsedIds, toggleBranch, handleHeadingClick }) {
  const hasChildren = node.children.length > 0
  const collapsed = collapsedIds.has(node.id)
  const childrenId = `toc-children-${node.id}`
  const active = activeId === node.id

  return (
    <li>
      <div className={`flex items-start rounded-lg transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/80'}`} style={{ paddingInlineStart: `${Math.min(depth, 4) * 0.7}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleBranch(node.id)}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-indigo-300"
            aria-expanded={!collapsed}
            aria-controls={childrenId}
            aria-label={`${collapsed ? '展开' : '折叠'} ${node.text}`}
            title={collapsed ? '展开子目录' : '折叠子目录'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}
        <a
          href={`#${encodeURIComponent(node.id)}`}
          onClick={event => handleHeadingClick(event, node.id)}
          aria-current={active ? 'location' : undefined}
          title={node.text}
          className={`min-w-0 flex-1 break-words px-1.5 py-1.5 text-sm leading-5 transition-colors focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300'}`}
        >
          {node.text}
        </a>
      </div>
      {hasChildren && !collapsed && (
        <ul id={childrenId} className="space-y-0.5">
          {node.children.map(child => (
            <TocTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsedIds={collapsedIds}
              toggleBranch={toggleBranch}
              handleHeadingClick={handleHeadingClick}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function buildToc(markdown) {
  return parseToc(markdown).map(({ sourceLine: _sourceLine, ...item }) => item)
}

function parseToc(markdown) {
  const counts = new Map()
  const items = []
  let fence = null

  const lines = String(markdown || '').split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) fence = { char: marker[0], length: marker.length }
      else if (marker[0] === fence.char && marker.length >= fence.length) fence = null
      continue
    }
    if (fence) continue

    const match = /^\s*(#{2,6})[\t ]+(.+?)(?:[\t ]+#+[\t ]*)?$/.exec(line)
    if (!match) continue
    const text = stripMarkdown(match[2])
    if (!text) continue
    const baseId = slugify(text)
    const count = counts.get(baseId) || 0
    counts.set(baseId, count + 1)
    items.push({
      level: match[1].length,
      text,
      id: count ? `${baseId}-${count + 1}` : baseId,
      sourceLine: lineIndex + 1,
    })
  }

  return items
}

export function buildTocTree(items) {
  const roots = []
  const stack = []
  for (const item of items) {
    const node = { ...item, children: [] }
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  return roots
}

function collectBranchIds(nodes) {
  const ids = []
  for (const node of nodes) {
    if (node.children.length) {
      ids.push(node.id)
      ids.push(...collectBranchIds(node.children))
    }
  }
  return ids
}

function buildAncestorMap(nodes, ancestors = [], map = new Map()) {
  for (const node of nodes) {
    map.set(node.id, ancestors)
    buildAncestorMap(node.children, [...ancestors, node.id], map)
  }
  return map
}

function headingIdFromChildren(children) {
  return slugify(childrenToText(children))
}

function childrenToText(children) {
  if (Array.isArray(children)) {
    return children.map(childrenToText).join('')
  }
  if (children?.props?.children) {
    return childrenToText(children.props.children)
  }
  return String(children || '')
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_`~]/g, '')
    .trim()
}

function slugify(text) {
  const value = stripMarkdown(text)
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}
