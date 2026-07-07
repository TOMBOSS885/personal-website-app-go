import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Lock, Share2, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import OptimizedImage from '../components/OptimizedImage'

export default function ArticleDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shareStatus, setShareStatus] = useState('idle')
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const tocItems = useMemo(() => buildToc(article?.content || ''), [article?.content])

  useEffect(() => {
    setLoading(true)
    setPassword('')
    setUnlockError('')
    fetch(`/api/public/articles/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setArticle(data)
        setLoading(false)
      })
      .catch(() => {
        import('../api/mockApi').then(module => {
          const foundArticle = module.default.getArticles().find(item => item.id === parseInt(id, 10))
          setArticle(foundArticle || null)
          setLoading(false)
        })
      })
  }, [id])

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

  let headingRenderIndex = 0

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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,56rem)_18rem]">
          <div className="rounded-3xl border border-white/60 bg-white/75 px-5 py-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60 md:px-8 md:py-8 lg:col-start-2">
            <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="article-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
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
                    const idValue = tocItems[headingRenderIndex]?.id || headingIdFromChildren(children)
                    headingRenderIndex += 1
                    return <h2 id={idValue} {...props}>{children}</h2>
                  },
                  h3: ({ node, children, ...props }) => {
                    const idValue = tocItems[headingRenderIndex]?.id || headingIdFromChildren(children)
                    headingRenderIndex += 1
                    return <h3 id={idValue} {...props}>{children}</h3>
                  },
                  img: ({ node, ...props }) => (
                    <OptimizedImage {...props} loading="lazy" sizes="(min-width: 768px) 768px, 100vw" wrapperClassName="block" />
                  )
                }}
              >
                {article.content}
              </ReactMarkdown>
            </motion.article>
          </div>

          {tocItems.length > 0 && (
            <aside className="hidden lg:col-start-3 lg:block">
              <div className="sticky top-28 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">文章目录</div>
                <nav className="mt-3 space-y-1">
                  {tocItems.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block rounded-lg px-2 py-1.5 text-sm text-gray-500 transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300 ${item.level === 3 ? 'pl-5' : ''}`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>

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

function buildToc(markdown) {
  const counts = new Map()
  return String(markdown || '')
    .split(/\r?\n/)
    .map(line => {
      const match = /^(#{2,3})\s+(.+)$/.exec(line.trim())
      if (!match) return null
      const text = stripMarkdown(match[2])
      const baseId = slugify(text)
      const count = counts.get(baseId) || 0
      counts.set(baseId, count + 1)
      return {
        level: match[1].length,
        text,
        id: count ? `${baseId}-${count + 1}` : baseId,
      }
    })
    .filter(Boolean)
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
  return String(text || '').replace(/[#*_`~[\]()]/g, '').trim()
}

function slugify(text) {
  const value = stripMarkdown(text)
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}
