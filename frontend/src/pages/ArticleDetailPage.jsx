import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Clock3, Link2, ListTree, Lock, MessageCircle, Share2, Tag } from 'lucide-react'
import LoadingIndicator from '../components/LoadingIndicator'
import { guestbookTargetUrl, guestMessageUrl } from '../utils/guestMessageTarget'
import { usePageMetadata } from '../utils/pageMetadata'
import { estimateArticleReading, getArticlePosition, isArticleFavorite, recordArticleVisit, saveArticlePosition, toggleArticleFavorite } from '../utils/readingLibrary'
import { safeStaticSiteSrc } from '../utils/safeUrl'
import { useUserAuth } from '../contexts/UserAuthContext'
import { oauthFeedback, withoutOAuthFeedback } from '../utils/oauth'

let markdownRendererPromise

function loadMarkdownRenderer() {
  if (!markdownRendererPromise) {
    markdownRendererPromise = import('../components/MarkdownArticleRenderer')
  }
  return markdownRendererPromise
}

const MarkdownArticleRenderer = lazy(loadMarkdownRenderer)

const STATIC_SITE_SIZE_MESSAGE = 'omblog:static-site-size'
const STATIC_SITE_MIN_HEIGHT = 480
const STATIC_SITE_MAX_HEIGHT = 50000

export function normalizeStaticSiteHeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.min(Math.max(Math.ceil(value), STATIC_SITE_MIN_HEIGHT), STATIC_SITE_MAX_HEIGHT)
}

export default function ArticleDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user, loading: userLoading } = useUserAuth()
  const bindingFeedback = useMemo(() => oauthFeedback(location.search), [location.search])
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shareStatus, setShareStatus] = useState('idle')
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [relatedMessages, setRelatedMessages] = useState([])
  const [staticSiteHeight, setStaticSiteHeight] = useState(null)
  const [markdownRenderVersion, setMarkdownRenderVersion] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const [favorite, setFavorite] = useState(false)
  const [resumeProgress, setResumeProgress] = useState(0)
  const staticSiteFrameRef = useRef(null)
  const readingProgressRef = useRef(0)
  const isStaticArticle = article?.contentType === 'static'
  const staticSiteSrc = useMemo(() => safeStaticSiteSrc(article?.staticSiteUrl), [article?.staticSiteUrl])
  const tocItems = useMemo(() => buildToc(isStaticArticle ? '' : article?.content || ''), [article?.content, isStaticArticle])
  const readingStats = useMemo(() => estimateArticleReading(isStaticArticle ? '' : article?.content || ''), [article?.content, isStaticArticle])
  const headingIdsByLine = useMemo(() => new Map(
    parseToc(article?.content || '').map(item => [item.sourceLine, item.id]),
  ), [article?.content])
  const articleMetadata = useMemo(() => article ? {
    title: `${article.title} - tombossking`,
    description: article.summary || 'tombossking 的博客文章。',
    image: article.coverImage || '',
    type: 'article',
    siteName: 'tombossking',
  } : null, [article])
  usePageMetadata(articleMetadata)

  useEffect(() => {
    if (!article?.id || article.requiresPassword || article.requiresLogin || (article.requiresThirdPartyBinding && !user?.hasOAuthIdentity && !article.adminAuthenticated)) return undefined
    setFavorite(isArticleFavorite(article.id))
    setResumeProgress(getArticlePosition(article.id))
    recordArticleVisit(article)

    let frame = 0
    const updateProgress = () => {
      frame = 0
      const articleElement = document.querySelector('.article-content')
      if (!articleElement) return
      const rect = articleElement.getBoundingClientRect()
      const start = window.scrollY + rect.top - Math.min(window.innerHeight * 0.2, 160)
      const distance = Math.max(articleElement.offsetHeight - window.innerHeight * 0.65, 1)
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / distance))
      readingProgressRef.current = progress
      setReadingProgress(progress)
    }
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress)
    }
    updateProgress()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (frame) window.cancelAnimationFrame(frame)
      saveArticlePosition(article.id, readingProgressRef.current)
    }
  }, [article?.id, article?.requiresPassword, article?.requiresLogin, article?.requiresThirdPartyBinding, article?.adminAuthenticated, user?.hasOAuthIdentity, markdownRenderVersion])

  useEffect(() => {
    if (!article?.id || article.requiresPassword || article.requiresLogin || (article.requiresThirdPartyBinding && !user?.hasOAuthIdentity && !article.adminAuthenticated)) return undefined
    const timer = window.setTimeout(() => saveArticlePosition(article.id, readingProgress), 800)
    return () => window.clearTimeout(timer)
  }, [article?.id, article?.requiresPassword, article?.requiresLogin, article?.requiresThirdPartyBinding, article?.adminAuthenticated, user?.hasOAuthIdentity, readingProgress])

  const handleMarkdownRendered = useCallback(() => {
    setMarkdownRenderVersion(current => current + 1)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setPassword('')
    setUnlockError('')
    // Start the optional Markdown renderer at the same time as the article
    // API request. This removes an otherwise sequential high-latency round.
    void loadMarkdownRenderer()
    fetch(`/api/public/articles/${id}`, { cache: 'no-store', credentials: 'same-origin' })
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
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    setRelatedMessages([])
    fetch(`/api/public/guest-messages?targetType=article&targetId=${encodeURIComponent(id)}&page=0&size=12`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => setRelatedMessages(Array.isArray(data?.content) ? data.content : []))
      .catch(error => {
        if (error.name !== 'AbortError') setRelatedMessages([])
      })
    return () => controller.abort()
  }, [id])

  useEffect(() => {
    setStaticSiteHeight(null)
    if (!isStaticArticle || !staticSiteSrc) return undefined

    const handleStaticSiteSize = (event) => {
      if (event.source !== staticSiteFrameRef.current?.contentWindow) return
      const message = event.data
      if (!message || typeof message !== 'object' || message.type !== STATIC_SITE_SIZE_MESSAGE) return
      const nextHeight = normalizeStaticSiteHeight(message.height)
      if (nextHeight === null) return
      setStaticSiteHeight(current => current === nextHeight ? current : nextHeight)
    }

    window.addEventListener('message', handleStaticSiteSize)
    return () => window.removeEventListener('message', handleStaticSiteSize)
  }, [isStaticArticle, staticSiteSrc])

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

  const handleFavorite = () => {
    setFavorite(toggleArticleFavorite(article))
  }

  const resumeReading = () => {
    const articleElement = document.querySelector('.article-content')
    if (!articleElement || resumeProgress <= 0) return
    const target = window.scrollY + articleElement.getBoundingClientRect().top + articleElement.offsetHeight * resumeProgress - window.innerHeight * 0.2
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    setResumeProgress(0)
  }

  const handleUnlock = async (event) => {
    event.preventDefault()
    if (!password.trim() || unlocking) return
    setUnlocking(true)
    setUnlockError('')
    try {
      const res = await fetch(`/api/public/articles/${id}/unlock`, {
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

  const resolveHeadingId = useCallback((node, children) => {
    const sourceLine = node?.position?.start?.line
    return (sourceLine ? headingIdsByLine.get(sourceLine) : undefined) || headingIdFromChildren(children)
  }, [headingIdsByLine])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <LoadingIndicator size={52} className="mx-auto mb-4 text-indigo-600 dark:text-indigo-300" label="加载文章" />
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

  if (article.requiresThirdPartyBinding && !article.adminAuthenticated && userLoading) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingIndicator size={52} label="验证账号权限" /></div>
  }

  if (article.requiresThirdPartyBinding && !article.adminAuthenticated && user && !user.hasOAuthIdentity) {
    const redirect = withoutOAuthFeedback(`${location.pathname}${location.search}`)
    return (
      <div className="min-h-screen bg-transparent px-4 pb-12 pt-28">
        <div className="mx-auto max-w-3xl rounded-lg border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/70 md:p-8">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100"><ArrowLeft className="h-4 w-4" />返回博客</Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{article.title}</h1>
          {article.summary && <p className="mt-3 text-gray-600 dark:text-slate-300">{article.summary}</p>}
          {bindingFeedback?.type === 'error' && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{bindingFeedback.message}</p>}
          <div className="mt-6 rounded-lg border border-violet-100 bg-violet-50/70 p-5 dark:border-violet-500/20 dark:bg-violet-500/10">
            <div className="flex items-start gap-3"><Link2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" /><div><p className="font-medium text-gray-800 dark:text-slate-100">该文章需要账号至少绑定一种第三方登录方式。</p><p className="mt-1 text-sm text-gray-600 dark:text-slate-300">完成官方授权绑定后即可返回阅读。</p></div></div>
            <Link to={`/account?return=${encodeURIComponent(redirect)}`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white hover:bg-violet-700"><Link2 className="h-4 w-4" />前往绑定</Link>
          </div>
        </div>
      </div>
    )
  }

  // Keep a client-side guard for stale/incorrect cached responses. The API
  // explicitly marks an administrator session so that admins can read gated
  // articles even though the public shell does not load admin context.
  if (article.requiresLogin || (article.requiresThirdPartyBinding && !article.adminAuthenticated && !user) || (article.loginRequired && !userLoading && !user && !article.adminAuthenticated)) {
    const redirect = `${location.pathname}${location.search}`
    return (
      <div className="min-h-screen bg-transparent px-4 pb-12 pt-28">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/70 md:p-8">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100"><ArrowLeft className="h-4 w-4" />返回博客</Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{article.title}</h1>
          {article.summary && <p className="mt-3 text-gray-600 dark:text-slate-300">{article.summary}</p>}
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <p className="text-gray-700 dark:text-slate-200">该文章登录后可查看。</p>
            <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700">登录后阅读</Link>
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

  return (
    <div className="min-h-screen bg-transparent">
      {!isStaticArticle && <div className="reading-progress" aria-hidden="true"><span style={{ transform: `scaleX(${readingProgress})` }} /></div>}
      <div className="mx-auto max-w-[92rem] px-4 pb-8 pt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_18rem] lg:gap-6">
        <div className="adaptive-surface rounded-3xl border border-white/50 bg-white/60 px-5 py-6 shadow-lg shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/50 md:px-8 lg:col-start-2">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 pb-6 text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
            <span>发布于 {new Date(article.createdAt).toLocaleDateString('zh-CN')}</span>
            {isMeaningfulUpdate(article.createdAt, article.updatedAt) && <span>更新于 {new Date(article.updatedAt).toLocaleDateString('zh-CN')}</span>}
            <span>·</span>
            <span>{article.views || 0} 阅读</span>
            {!isStaticArticle && <><span>·</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />约 {readingStats.minutes} 分钟 · {readingStats.wordCount.toLocaleString('zh-CN')} 字</span></>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleFavorite} className={`theme-action-surface inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${favorite ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200' : 'border-gray-200 bg-white/70 text-gray-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200'}`} aria-pressed={favorite}>
              <Bookmark className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />{favorite ? '已收藏' : '稍后读'}
            </button>
            {resumeProgress > 0.05 && <button type="button" onClick={resumeReading} className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">继续上次阅读（{Math.round(resumeProgress * 100)}%）</button>}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-auto max-w-[92rem] px-4 pb-12 pt-8"
      >
        <div className={isStaticArticle ? '' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_18rem]'}>
          <div className={isStaticArticle
            ? 'mx-auto max-w-[80rem] overflow-hidden bg-transparent'
            : 'adaptive-surface rounded-3xl border border-white/60 bg-white/75 px-5 py-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60 md:px-8 md:py-8 lg:col-start-2'}>
            {isStaticArticle ? (
              staticSiteSrc ? (
                <iframe
                  ref={staticSiteFrameRef}
                  title={article.title}
                  src={staticSiteSrc}
                  sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads allow-presentation"
                  allow="autoplay; fullscreen; picture-in-picture"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  style={{ height: staticSiteHeight ? `${staticSiteHeight}px` : '75vh' }}
                  className="block min-h-[480px] w-full border-0 bg-white md:min-h-[620px]"
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-gray-50 px-6 text-center text-gray-500 dark:bg-slate-900 dark:text-slate-400">静态前端资源暂时不可用，请稍后重试。</div>
              )
            ) : (
              <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="article-content">
                <Suspense fallback={<ArticleContentPreview content={article.content} />}>
                  <MarkdownArticleRenderer content={article.content} resolveHeadingId={resolveHeadingId} onRendered={handleMarkdownRendered} />
                </Suspense>
              </motion.article>
            )}
          </div>

          {!isStaticArticle && tocItems.length > 0 && (
            <aside className="hidden lg:col-start-3 lg:block">
              <ArticleTableOfContents items={tocItems} renderVersion={markdownRenderVersion} />
            </aside>
          )}
        </div>

        {article.navigation && (
          <section className="mx-auto mt-10 grid max-w-[56rem] gap-5 md:grid-cols-2" aria-label="文章导航">
            <ArticleNavigationCard label="上一篇" article={article.navigation.previous} direction="previous" />
            <ArticleNavigationCard label="下一篇" article={article.navigation.next} direction="next" />
            {article.navigation.series?.length > 1 && (
              <div className="adaptive-surface md:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold text-gray-900 dark:text-slate-100">专题：{article.navigation.seriesName}</h2><span className="text-xs text-gray-500 dark:text-slate-400">{article.navigation.series.length} 篇</span></div>
                <div className="flex flex-wrap gap-2">{article.navigation.series.map(item => <Link key={item.id} to={`/blog/${item.id}`} className={`rounded-lg px-3 py-2 text-sm transition ${item.current ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-500/20'}`}>{item.order > 0 ? `${item.order}. ` : ''}{item.title}</Link>)}</div>
              </div>
            )}
            {article.navigation.related?.length > 0 && (
              <div className="adaptive-surface md:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-950/60">
                <h2 className="mb-3 font-semibold text-gray-900 dark:text-slate-100">相关文章</h2>
                <div className="grid gap-3 sm:grid-cols-2">{article.navigation.related.map(item => <Link key={item.id} to={`/blog/${item.id}`} className="rounded-xl border border-gray-200/70 bg-white/50 p-3 transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-400"><p className="font-medium text-gray-800 dark:text-slate-100">{item.title}</p>{item.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-slate-400">{item.summary}</p>}</Link>)}</div>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="related-messages-heading" className="adaptive-surface mx-auto mt-10 max-w-[56rem] border-y border-white/60 bg-white/75 px-5 py-7 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/70 md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="related-messages-heading" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-slate-100"><MessageCircle className="h-5 w-5 text-emerald-500" />相关留言</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">引用这篇文章的访客留言</p>
            </div>
            <Link to={guestbookTargetUrl('article', article.id)} className="theme-action-surface inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-2 text-sm font-medium text-indigo-800 transition hover:border-indigo-400 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-100">写一条相关留言<ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          {relatedMessages.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500 dark:text-slate-400">暂时还没有相关留言。</p>
          ) : (
            <div className="mt-6 divide-y divide-gray-200/80 dark:divide-slate-700/70">
              {relatedMessages.map(message => <article key={message.id} className="py-5 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-gray-900 dark:text-slate-100">{message.nickname}</h3><time className="text-xs text-gray-500 dark:text-slate-400">{formatGuestMessageDate(message.createdAt)}</time></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 dark:text-slate-200">{message.content}</p><Link to={guestMessageUrl(message.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-200">查看原留言<ArrowUpRight className="h-4 w-4" /></Link></article>)}
            </div>
          )}
        </section>

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

function ArticleNavigationCard({ label, article, direction }) {
  if (!article) return <div className="hidden md:block" aria-hidden="true" />
  return (
    <Link to={`/blog/${article.id}`} className="adaptive-surface group rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-indigo-300 dark:border-slate-700/50 dark:bg-slate-950/60 dark:hover:border-indigo-400">
      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400"><span>{label}</span><span aria-hidden="true">{direction === 'previous' ? '←' : '→'}</span></div>
      <p className="mt-2 line-clamp-2 font-semibold text-gray-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">{article.title}</p>
      {article.summary && <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{article.summary}</p>}
    </Link>
  )
}

function formatGuestMessageDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function isMeaningfulUpdate(createdAt, updatedAt) {
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 24 * 60 * 60 * 1000
}

function ArticleContentPreview({ content }) {
  return (
    <div className="article-fast-preview">
      {toReadablePreview(content)}
    </div>
  )
}

function toReadablePreview(content) {
  return String(content || '')
    .replace(/^\s*(`{3,}|~{3,})[^\n]*$/gm, '')
    .replace(/^\s*#{1,6}[\t ]+/gm, '')
    .replace(/^\s*>[\t ]?/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function ArticleTableOfContents({ items, renderVersion }) {
  const tree = useMemo(() => buildTocTree(items), [items])
  const branchIds = useMemo(() => collectBranchIds(tree), [tree])
  const ancestorMap = useMemo(() => buildAncestorMap(tree), [tree])
  const tocScrollRef = useRef(null)
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

  useEffect(() => {
    const scrollingElement = document.scrollingElement || document.documentElement
    if (!scrollingElement) return undefined

    let headings = []
    let headingOffsets = []
    let updateFrame = 0
    let measureFrame = 0
    let disposed = false

    const getScrollTop = () => Math.max(window.scrollY || 0, scrollingElement.scrollTop || 0)

    const activateHeading = () => {
      updateFrame = 0
      if (disposed || !headingOffsets.length) return

      const scrollTop = getScrollTop()
      const documentHeight = Math.max(scrollingElement.scrollHeight, document.body?.scrollHeight || 0)
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const atBottom = scrollTop + viewportHeight >= documentHeight - 2
      const readingOffset = Math.min(Math.max(viewportHeight * 0.2, 96), 180)
      const index = atBottom
        ? headings.length - 1
        : findActiveHeadingIndex(headingOffsets, scrollTop + readingOffset)
      const nextId = headings[index]?.id
      if (!nextId) return

      setActiveId(current => current === nextId ? current : nextId)
      const ancestors = ancestorMap.get(nextId) || []
      if (ancestors.length) {
        setCollapsedIds(current => {
          if (!ancestors.some(ancestorId => current.has(ancestorId))) return current
          const next = new Set(current)
          ancestors.forEach(ancestorId => next.delete(ancestorId))
          return next
        })
      }
    }

    const scheduleUpdate = () => {
      if (disposed || updateFrame) return
      updateFrame = window.requestAnimationFrame(activateHeading)
    }

    const measureHeadings = () => {
      measureFrame = 0
      if (disposed) return
      // The renderer is lazy-loaded. Resolve headings here so the TOC also
      // attaches after the fallback is replaced by the rendered Markdown.
      headings = items
        .map(item => document.getElementById(item.id))
        .filter(Boolean)
      if (!headings.length) {
        headingOffsets = []
        return
      }
      const scrollTop = getScrollTop()
      headingOffsets = headings.map(heading => heading.getBoundingClientRect().top + scrollTop)
      scheduleUpdate()
    }

    const scheduleMeasure = () => {
      if (disposed || measureFrame) return
      measureFrame = window.requestAnimationFrame(measureHeadings)
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleMeasure, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    const articleBody = document.querySelector('.article-content')
    if (articleBody) resizeObserver?.observe(articleBody)
    const mutationObserver = typeof MutationObserver === 'undefined' || !articleBody
      ? null
      : new MutationObserver(scheduleMeasure)
    mutationObserver?.observe(articleBody, { childList: true, subtree: true, characterData: true })
    if (document.fonts?.ready) void document.fonts.ready.then(scheduleMeasure, scheduleMeasure)
    scheduleMeasure()

    return () => {
      disposed = true
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleMeasure)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (updateFrame) window.cancelAnimationFrame(updateFrame)
      if (measureFrame) window.cancelAnimationFrame(measureFrame)
    }
  }, [ancestorMap, items, renderVersion])

  useEffect(() => {
    const navigation = tocScrollRef.current
    if (!navigation || navigation.clientHeight === 0) return undefined

    const frame = window.requestAnimationFrame(() => {
      const activeRow = navigation.querySelector('[aria-current="location"]')?.closest('.article-toc-row')
      if (!activeRow) return
      const navigationRect = navigation.getBoundingClientRect()
      const rowRect = activeRow.getBoundingClientRect()
      const topOverflow = rowRect.top - navigationRect.top
      const bottomOverflow = rowRect.bottom - navigationRect.bottom
      if (topOverflow < 0) navigation.scrollTop += topOverflow
      else if (bottomOverflow > 0) navigation.scrollTop += bottomOverflow
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeId, collapsedIds])

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

      <nav ref={tocScrollRef} className="article-toc-scroll mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" aria-label="文章目录" tabIndex={0}>
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
      <div className={`article-toc-row flex items-start rounded-lg transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/80'}`} style={{ paddingInlineStart: `${Math.min(depth, 4) * 0.7}rem` }}>
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

export function findActiveHeadingIndex(offsets, readingPosition) {
  if (!offsets.length) return -1
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
