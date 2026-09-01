import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowUpRight, CalendarDays } from 'lucide-react'
import LoadingIndicator from '../components/LoadingIndicator'

export default function ArchivePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/public/articles/archive', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(setData)
      .catch(error => { if (error.name !== 'AbortError') setData(null) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen px-4 pb-20 pt-28">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12"><span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Archive className="h-4 w-4" />内容时间线</span><h1 className="mt-3 text-4xl font-bold text-gray-900 dark:text-slate-100 md:text-5xl">文章归档</h1><p className="mt-4 max-w-2xl text-gray-600 dark:text-slate-300">按年月回看所有公开文章，不让早期内容沉到分页深处。</p></header>
        {loading ? <div className="flex justify-center py-24"><LoadingIndicator size={40} label="加载归档" /></div> : !data?.years?.length ? <EmptyState /> : (
          <div className="space-y-12">{data.years.map(year => <section key={year.year} className="grid gap-5 md:grid-cols-[8rem_minmax(0,1fr)]"><div><div className="sticky top-28"><div className="text-3xl font-bold text-gray-900 dark:text-slate-100">{year.year}</div><div className="mt-1 text-sm text-gray-500 dark:text-slate-400">{year.count} 篇文章</div></div></div><div className="space-y-6 border-l border-gray-200 pl-5 dark:border-slate-700 md:pl-8">{year.months.map(month => <div key={month.month}><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-slate-400"><CalendarDays className="h-4 w-4" />{Number(month.month)} 月</h2><div className="adaptive-surface divide-y divide-gray-100 overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md dark:divide-slate-800 dark:border-slate-700/50 dark:bg-slate-950/60">{month.articles.map(article => <Link key={article.id} to={`/blog/${article.id}`} className="group flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-white/70 dark:hover:bg-slate-900/70"><span className="min-w-0"><span className="block font-semibold text-gray-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">{article.title}</span><span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">{new Date(article.createdAt).toLocaleDateString('zh-CN')}{article.category ? ` · ${article.category}` : ''}</span></span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-indigo-600" /></Link>)}</div></div>)}</div></section>)}</div>
        )}
      </div>
    </div>
  )
}

function EmptyState() { return <div className="adaptive-surface rounded-2xl border border-white/60 bg-white/70 py-20 text-center text-gray-500 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-950/60 dark:text-slate-400">暂时还没有可归档的文章。</div> }
