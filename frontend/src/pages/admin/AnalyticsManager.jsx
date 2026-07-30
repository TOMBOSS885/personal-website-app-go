import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Clock3, Eye, Loader, MonitorSmartphone, MousePointerClick, Users } from 'lucide-react'

const EMPTY = {
  summary: { totalViews: 0, periodViews: 0, periodVisitors: 0, todayViews: 0, todayVisitors: 0 },
  daily: [], topPages: [], referrers: [], devices: [], browsers: [], systems: [], hours: [], recent: [],
}

export default function AnalyticsManager() {
  const [range, setRange] = useState(30)
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/admin/analytics?range=${range}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || `加载失败（HTTP ${response.status}）`)
        setData({ ...EMPTY, ...body, summary: { ...EMPTY.summary, ...(body.summary || {}) } })
      })
      .catch(nextError => {
        if (nextError.name !== 'AbortError') setError(nextError.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [range])

  const maxDaily = useMemo(() => Math.max(1, ...data.daily.map(item => item.views)), [data.daily])
  const maxHourly = useMemo(() => Math.max(1, ...data.hours.map(item => item.views)), [data.hours])
  const summary = [
    { label: '累计访问', value: data.summary.totalViews, icon: Eye },
    { label: `近 ${range} 天访问`, value: data.summary.periodViews, icon: MousePointerClick },
    { label: `近 ${range} 天访客`, value: data.summary.periodVisitors, icon: Users },
    { label: '今日访问 / 访客', value: `${data.summary.todayViews} / ${data.summary.todayVisitors}`, icon: Clock3 },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <BarChart3 className="h-7 w-7 text-indigo-500" />访问统计
        </h1>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {[7, 30, 90].map(days => (
            <button key={days} type="button" onClick={() => setRange(days)} className={`h-8 rounded-md px-3 text-sm font-medium ${range === days ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              {days} 天
            </button>
          ))}
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader className="h-6 w-6 animate-spin text-indigo-500" /></div> : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm text-gray-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(value)}</p></div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><Icon className="h-5 w-5" /></div>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-5 font-semibold text-gray-900 dark:text-slate-100">每日趋势</h2>
            <div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-gray-100 pb-1 dark:border-slate-800">
              {data.daily.map((item, index) => (
                <div key={item.date} className="group flex h-full min-w-3 flex-1 items-end" title={`${item.date}：${item.views} 次访问，${item.visitors} 位访客`}>
                  <div className="w-full rounded-t-sm bg-indigo-500/75 transition-colors group-hover:bg-indigo-600" style={{ height: `${Math.max(item.views ? 4 : 1, (item.views / maxDaily) * 100)}%` }} />
                  {index % Math.max(1, Math.ceil(data.daily.length / 8)) === 0 && <span className="sr-only">{item.date}</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400"><span>{data.daily[0]?.date || '-'}</span><span>{data.daily.at(-1)?.date || '-'}</span></div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <DataTable title="热门页面" headers={['页面', '访问', '访客']} rows={data.topPages.map(item => [<PathLabel key={item.path} item={item} />, item.views, item.visitors])} />
            <DataTable title="访问来源" headers={['来源', '访问']} rows={data.referrers.map(item => [item.name, item.views])} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Breakdown title="设备" icon={MonitorSmartphone} items={data.devices} />
            <Breakdown title="浏览器" icon={BarChart3} items={data.browsers} />
            <Breakdown title="操作系统" icon={MonitorSmartphone} items={data.systems} />
          </div>

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-5 font-semibold text-gray-900 dark:text-slate-100">时段分布</h2>
            <div className="grid h-36 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-1">
              {data.hours.map(item => <div key={item.hour} className="min-h-px rounded-t-sm bg-emerald-500/75" style={{ height: `${Math.max(item.views ? 5 : 1, (item.views / maxHourly) * 100)}%` }} title={`${String(item.hour).padStart(2, '0')}:00：${item.views} 次`} />)}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400"><span>00:00</span><span>12:00</span><span>23:00</span></div>
          </section>

          <DataTable title="最近访问" headers={['时间', '页面', '访客', '环境', '来源']} rows={data.recent.map(item => [
            formatDate(item.visitedAt), <PathLabel key={`${item.visitor}-${item.visitedAt}`} item={item} />, item.visitor,
            `${item.device} · ${item.browser} · ${item.os}${item.screenWidth ? ` · ${item.screenWidth}px` : ''}`,
            item.referrer || '直接访问',
          ])} />
        </>
      )}
    </div>
  )
}

function DataTable({ title, headers, rows }) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="border-b border-gray-100 px-5 py-4 font-semibold text-gray-900 dark:border-slate-800 dark:text-slate-100">{title}</h2>
      <div className="overflow-x-auto"><table className="w-full min-w-max text-left text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400"><tr>{headers.map(header => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-800">{rows.length ? rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-80 px-4 py-3 text-gray-700 dark:text-slate-300">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400">暂无数据</td></tr>}</tbody></table></div>
    </section>
  )
}

function Breakdown({ title, icon: Icon, items }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + Number(item.views || 0), 0))
  return <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-slate-100"><Icon className="h-4 w-4" />{title}</h2><div className="space-y-3">{items.map(item => <div key={item.name}><div className="mb-1 flex justify-between gap-3 text-sm text-gray-600 dark:text-slate-300"><span>{item.name}</span><span>{item.views}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"><div className="h-full bg-indigo-500" style={{ width: `${(item.views / total) * 100}%` }} /></div></div>)}</div></section>
}

function PathLabel({ item }) {
  return <div><div className="truncate font-medium text-gray-800 dark:text-slate-200">{item.title || item.path}</div>{item.title && <div className="truncate text-xs text-gray-400">{item.path}</div>}</div>
}

function formatNumber(value) {
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : value
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
