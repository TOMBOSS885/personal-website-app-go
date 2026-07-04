import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Folder, Loader, Search, Zap } from 'lucide-react'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const keyword = params.get('q') || ''
    setQuery(keyword)
    if (!keyword.trim()) {
      setResults([])
      return
    }

    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/public/search?q=${encodeURIComponent(keyword.trim())}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : [])
      .then(data => setResults(Array.isArray(data) ? data : []))
      .catch(() => {
        if (!controller.signal.aborted) setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [params])

  const submitSearch = (event) => {
    event.preventDefault()
    const keyword = query.trim()
    if (keyword) {
      setParams({ q: keyword })
    } else {
      setParams({})
    }
  }

  return (
    <div className="min-h-screen px-4 pb-20 pt-28">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60 md:p-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-slate-100">
            <Search className="h-8 w-8" style={{ color: 'var(--theme-primary)' }} />
            全站搜索
          </h1>
          <form onSubmit={submitSearch} className="mt-6 flex gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文章、项目、技能..."
              className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-500/20"
              autoFocus
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-medium text-white"
              style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
            >
              <Search className="h-5 w-5" />
              搜索
            </button>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/60 bg-white/75 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 dark:text-slate-400">
              <Loader className="mr-2 h-5 w-5 animate-spin" />
              搜索中...
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-slate-400">
              {params.get('q') ? '没有找到相关内容' : '输入关键词开始搜索'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {results.map((item) => {
                const Icon = item.type === 'article' ? FileText : item.type === 'project' ? Folder : Zap
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={item.url}
                    className="group flex gap-4 px-5 py-4 transition hover:bg-white/80 dark:hover:bg-slate-900"
                  >
                    <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-gray-900 transition group-hover:text-indigo-600 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-sm text-gray-500 dark:text-slate-400">
                        {typeLabel(item.type)} · {item.description || '暂无描述'}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function typeLabel(type) {
  if (type === 'article') return '文章'
  if (type === 'project') return '项目'
  if (type === 'skill') return '技能'
  return type
}
