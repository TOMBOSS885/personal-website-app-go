import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Layers3 } from 'lucide-react'

export default function SeriesCollection({ series, compact = false }) {
  if (!series.length) {
    return (
      <div className="adaptive-surface rounded-2xl border border-white/60 bg-white/70 px-6 py-16 text-center backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-950/60">
        <Layers3 className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600" />
        <h2 className="mt-4 font-semibold text-gray-800 dark:text-slate-200">暂时还没有专题系列</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">发布文章时可在后台的“专题设置”中创建第一个专题。</p>
      </div>
    )
  }

  return (
    <div className={`grid gap-6 ${compact ? 'xl:grid-cols-2' : 'lg:grid-cols-2'}`}>
      {series.map((group, groupIndex) => (
        <section key={group.name} className="adaptive-surface overflow-hidden rounded-2xl border border-white/60 bg-white/75 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-950/65">
          <div className="border-b border-gray-100 p-6 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Layers3 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{group.name}</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-300">{group.count} 篇</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{group.summary || '按设定顺序连续阅读这一专题。'}</p>
              </div>
            </div>
          </div>
          <ol className="divide-y divide-gray-100 dark:divide-slate-800">
            {group.articles.map((article, index) => (
              <li key={article.id}>
                <Link to={`/blog/${article.id}`} className="group flex items-center gap-4 px-6 py-4 transition hover:bg-white/80 dark:hover:bg-slate-900/80">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 group-hover:bg-indigo-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-300">{article.seriesOrder > 0 ? article.seriesOrder : index + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800 group-hover:text-indigo-700 dark:text-slate-200 dark:group-hover:text-indigo-300">{article.title}</span>
                  {index === 0 && groupIndex === 0 ? <BookOpen className="h-4 w-4 shrink-0 text-indigo-500" /> : <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
