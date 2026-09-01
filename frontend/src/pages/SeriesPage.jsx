import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Layers3 } from 'lucide-react'
import LoadingIndicator from '../components/LoadingIndicator'
import SeriesCollection from '../components/SeriesCollection'

export default function SeriesPage() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/public/articles/series', { signal: controller.signal })
      .then(response => response.ok ? response.json() : [])
      .then(data => setSeries(Array.isArray(data) ? data : []))
      .catch(error => { if (error.name !== 'AbortError') setSeries([]) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return <div className="min-h-screen px-4 pb-20 pt-28"><div className="mx-auto max-w-6xl"><header className="mb-10"><span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300"><Layers3 className="h-4 w-4" />连续阅读</span><h1 className="mt-3 text-4xl font-bold text-gray-900 dark:text-slate-100 md:text-5xl">专题系列</h1><p className="mt-4 max-w-2xl text-gray-600 dark:text-slate-300">把同一主题的文章按顺序组织为清晰的学习路径。</p><Link to="/blog" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300"><FileText className="h-4 w-4" />返回博客栏目</Link></header>{loading ? <div className="flex justify-center py-24"><LoadingIndicator size={40} label="加载专题" /></div> : <SeriesCollection series={series} />}</div></div>
}
