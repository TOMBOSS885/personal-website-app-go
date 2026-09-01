import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import LoadingIndicator from '../../components/LoadingIndicator'

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }

export default function AuditLogManager() {
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filters, setFilters] = useState({ eventType: '', success: '', search: '' })
  const [data, setData] = useState(EMPTY_PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), size: '50' })
    if (filters.eventType) params.set('eventType', filters.eventType)
    if (filters.success) params.set('success', filters.success)
    if (filters.search.trim()) params.set('search', filters.search.trim())
    params.set('_refresh', String(refreshKey))
    return params.toString()
  }, [filters, page, refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/admin/audit-logs?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.message || `加载失败（HTTP ${response.status}）`)
        setData({ ...EMPTY_PAGE, ...body })
      })
      .catch(nextError => {
        if (nextError.name !== 'AbortError') setError(nextError.message || '操作日志加载失败')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [query])

  const updateFilter = (key, value) => {
    setPage(0)
    setFilters(previous => ({ ...previous, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <ClipboardList className="h-7 w-7 text-indigo-500" />操作日志
        </h1>
        <button type="button" onClick={() => setRefreshKey(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <select value={filters.eventType} onChange={event => updateFilter('eventType', event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <option value="">全部类型</option><option value="authentication">登录认证</option><option value="admin_request">后台请求</option>
        </select>
        <select value={filters.success} onChange={event => updateFilter('success', event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <option value="">全部结果</option><option value="1">成功</option><option value="0">失败</option>
        </select>
        <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="搜索账号、路径、动作或 IP" className="min-w-64 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
        <span className="text-sm text-gray-500 dark:text-slate-400">共 {data.totalElements || 0} 条，保存最近一年</span>
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="flex min-h-64 items-center justify-center text-indigo-600 dark:text-indigo-300"><LoadingIndicator size={32} label="加载操作日志" /></div> : (
        <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto"><table className="w-full min-w-[1240px] text-left text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400"><tr>{['时间', '类型', '账号', '动作', '对象', '路径', 'IP', '结果', '详情'].map(header => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {data.content?.length ? data.content.map(item => <tr key={item.id}>
              <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-slate-300">{formatDate(item.createdAt)}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{item.eventType === 'authentication' ? '登录认证' : '后台请求'}</td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">{item.username || '未登录'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{item.action}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{item.resourceType ? `${item.resourceType}${item.resourceId ? ` #${item.resourceId}` : ''}` : '-'}</td>
              <td className="max-w-72 truncate px-4 py-3 text-gray-600 dark:text-slate-400" title={item.route}>{item.route}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{item.ipAddress}</td>
              <td className={`px-4 py-3 font-medium ${item.success ? 'text-emerald-600' : 'text-red-600'}`}>{item.success ? '成功' : `失败 (${item.statusCode})`}</td>
              <td className="px-4 py-3"><AuditDetails item={item} /></td>
            </tr>) : <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">暂无操作日志</td></tr>}
          </tbody></table></div>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-slate-800"><span className="text-gray-500 dark:text-slate-400">第 {data.totalPages ? data.number + 1 : 0} / {data.totalPages || 0} 页</span><div className="flex gap-2"><button type="button" disabled={!data.number} onClick={() => setPage(previous => Math.max(0, previous - 1))} className="rounded border border-gray-200 px-3 py-1.5 text-gray-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">上一页</button><button type="button" disabled={data.last || !data.totalPages} onClick={() => setPage(previous => previous + 1)} className="rounded border border-gray-200 px-3 py-1.5 text-gray-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">下一页</button></div></div>
        </section>
      )}
    </div>
  )
}

function AuditDetails({ item }) {
  const details = item.details
  if (!details && !item.userAgent && !item.message) return <span className="text-gray-400">-</span>
  const changes = details?.changes && typeof details.changes === 'object' ? Object.entries(details.changes) : []
  return <details className="max-w-[34rem]"><summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 dark:text-indigo-300">查看详情</summary><div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-slate-400"><div>客户端：{item.userAgent || '-'}</div>{item.message && <div>说明：{item.message}</div>}{changes.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-200 dark:border-slate-700"><th className="py-1 pr-3">字段</th><th className="py-1 pr-3">修改前</th><th className="py-1">修改后</th></tr></thead><tbody>{changes.map(([field, change]) => <tr key={field} className="border-b border-gray-100 align-top dark:border-slate-800"><td className="py-1 pr-3 font-medium text-gray-700 dark:text-slate-300">{fieldLabel(field)}</td><td className="max-w-48 whitespace-pre-wrap break-words py-1 pr-3">{formatValue(change?.before)}</td><td className="max-w-48 whitespace-pre-wrap break-words py-1">{formatValue(change?.after)}</td></tr>)}</tbody></table></div> : details && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] dark:bg-slate-800">{JSON.stringify(details, null, 2)}</pre>}</div></details>
}

function fieldLabel(field) {
  return ({ title: '标题', summary: '摘要', content: '正文', name: '名称', description: '描述', category: '分类', tags: '标签', cover_image: '封面', tech_stack: '技术栈', github_url: 'GitHub', demo_url: '演示地址', published: '发布状态', featured: '精选状态', display_order: '显示顺序', series_name: '系列', series_order: '系列顺序', proficiency: '熟练度', enabled: '启用状态', icon: '图标', gradient: '渐变样式' }[field] || field)
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '空'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
