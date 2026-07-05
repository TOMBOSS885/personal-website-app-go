import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, ChevronLeft, ChevronRight, RefreshCw, Save, Search, Settings, ShieldAlert, TrendingUp } from 'lucide-react'

const API = '/api/admin/security'
const PAGE_SIZES = [20, 30, 50, 100]

function authHeaders() {
  return {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  }
}

export default function SecurityManager() {
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10).replaceAll('-', ''))
  const [appliedDate, setAppliedDate] = useState(date)
  const [activeTab, setActiveTab] = useState('stats')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(30)
  const [eventType, setEventType] = useState('')
  const [severity, setSeverity] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      view: activeTab,
      keyword: appliedKeyword,
      date: appliedDate,
      page: String(page),
      size: String(size),
    })
    if (activeTab === 'events') {
      if (eventType) params.set('type', eventType)
      if (severity) params.set('severity', severity)
    }

    fetch(`${API}?${params}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(json => {
        setData(json)
        setSettings(json.settings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeTab, appliedDate, appliedKeyword, eventType, page, severity, size])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/rate-limit-settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      setSettings(json)
      load()
    } finally {
      setSaving(false)
    }
  }

  const applySearch = () => {
    setPage(0)
    setAppliedKeyword(keyword.trim())
    setAppliedDate(normalizeDate(date))
  }

  const switchTab = tab => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setPage(0)
  }

  const changeSize = nextSize => {
    setSize(nextSize)
    setPage(0)
  }

  const restrictions = data?.activeRestrictions || []
  const highAccess = data?.highAccess || []
  const highAccessRules = data?.highAccessRules || {}
  const stats = data?.stats || []
  const events = data?.events || []
  const total = activeTab === 'events' ? Number(data?.eventsTotal || 0) : Number(data?.statsTotal || 0)
  const totalPages = Math.max(1, Math.ceil(total / size))

  const rows = useMemo(() => {
    if (activeTab === 'events') {
      return events.map(item => [
        formatTime(item.createdAt),
        <SeverityBadge key={`severity-${item.id}`} severity={item.severity} />,
        eventTypeLabel(item.type),
        item.ip || '-',
        item.username || '-',
        item.message || '-',
      ])
    }
    return stats.map(item => [
      item.date,
      item.ip || '-',
      categoryLabel(item.category),
      item.musicTitle || '-',
      item.count,
      item.limitedCount,
      item.blockedCount,
      item.loginAttempts,
      item.loginFailures,
    ])
  }, [activeTab, events, stats])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">访问安全</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">限流、封禁、登录尝试和音乐流访问监控</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard icon={ShieldAlert} title="当前限制" value={restrictions.length} tone="amber" />
        <SummaryCard icon={TrendingUp} title="高访问标记" value={highAccess.length} tone="indigo" />
        <SummaryCard icon={Ban} title="封禁规则" value={`${settings?.dailyLimitTriggerThreshold || 5}次 / ${settings?.banDays || 30}天`} tone="red" />
      </div>

      <details className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-semibold text-gray-900 dark:text-slate-100">
          <Settings className="h-5 w-5 text-indigo-500" />
          高级限流设置
        </summary>
        {settings && (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ToggleField label="启用限流" checked={settings.enabled} onChange={enabled => setSettings({ ...settings, enabled })} />
            <NumberField label="网站公开接口 / 分钟" value={settings.publicPerMinute} onChange={publicPerMinute => setSettings({ ...settings, publicPerMinute })} />
            <NumberField label="音乐列表 / 分钟" value={settings.musicPerMinute} onChange={musicPerMinute => setSettings({ ...settings, musicPerMinute })} />
            <NumberField label="音乐流 / 分钟" value={settings.musicStreamPerMinute} onChange={musicStreamPerMinute => setSettings({ ...settings, musicStreamPerMinute })} />
            <NumberField label="登录失败次数" value={settings.loginMaxFailures} onChange={loginMaxFailures => setSettings({ ...settings, loginMaxFailures })} />
            <NumberField label="登录窗口秒数" value={settings.loginWindowSeconds} onChange={loginWindowSeconds => setSettings({ ...settings, loginWindowSeconds })} />
            <NumberField label="每日触发封禁次数" value={settings.dailyLimitTriggerThreshold} onChange={dailyLimitTriggerThreshold => setSettings({ ...settings, dailyLimitTriggerThreshold })} />
            <NumberField label="封禁天数" value={settings.banDays} onChange={banDays => setSettings({ ...settings, banDays })} />
            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        )}
      </details>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="搜索 IP、用户名、歌曲、路径或消息"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <input
          value={date}
          onChange={event => setDate(event.target.value.replaceAll('-', ''))}
          placeholder="20260705"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {activeTab === 'events' && (
          <>
            <select
              value={eventType}
              onChange={event => {
                setEventType(event.target.value)
                setPage(0)
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">全部事件</option>
              <option value="limit">触发限流</option>
              <option value="ban">封禁</option>
              <option value="login_success">登录成功</option>
              <option value="login_failure">登录失败</option>
              <option value="login_blocked">登录被限制</option>
            </select>
            <select
              value={severity}
              onChange={event => {
                setSeverity(event.target.value)
                setPage(0)
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">全部等级</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </>
        )}
        <button type="button" onClick={applySearch} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">搜索</button>
      </div>

      <Section title="当前限制与封禁">
        <DataTable columns={['类型', 'IP', '内容', '剩余时间', '等级']} rows={restrictions.map(item => [
          item.type,
          item.ip,
          item.category || item.value,
          `${item.remainingSeconds}s`,
          <SeverityBadge key={item.key} severity={item.severity} />,
        ])} empty="当前没有正在限制的 IP" />
      </Section>

      <Section title="高访问用户">
        <p className="mb-3 text-sm text-gray-500 dark:text-slate-400">
          动态规则：当天访问次数大于当前每分钟限流的 10 倍后标记。公开接口 &gt; {highAccessRules.public || '-'}，音乐列表 &gt; {highAccessRules.music || '-'}，音乐流 &gt; {highAccessRules.musicStream || '-'}，单曲流 &gt; {highAccessRules.musicStreamSong || '-'}。
        </p>
        <DataTable columns={['日期', 'IP', '类型', '歌曲', '次数']} rows={highAccess.map(item => [
          item.date,
          item.ip,
          categoryLabel(item.category),
          item.musicTitle || '-',
          item.count,
        ])} empty="暂无高访问用户" />
      </Section>

      <section className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">日志记录</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">选择一个日志类型后按页加载，避免日志过多时一次性请求太慢。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabButton active={activeTab === 'stats'} onClick={() => switchTab('stats')}>访问统计</TabButton>
            <TabButton active={activeTab === 'events'} onClick={() => switchTab('events')}>安全事件</TabButton>
            <select
              value={size}
              onChange={event => changeSize(Number(event.target.value))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {PAGE_SIZES.map(item => <option key={item} value={item}>{item} 条/页</option>)}
            </select>
          </div>
        </div>

        <DataTable
          columns={activeTab === 'events'
            ? ['时间', '等级', '类型', 'IP', '用户', '消息']
            : ['日期', 'IP', '类型', '歌曲', '访问', '限流', '封禁拦截', '登录尝试', '失败']}
          rows={rows}
          empty={loading ? '加载中...' : '暂无日志'}
        />
        <Pagination page={page} size={size} total={total} totalPages={totalPages} onPage={setPage} />
      </section>
    </div>
  )
}

function SummaryCard({ icon: Icon, title, value, tone }) {
  const tones = {
    amber: 'from-amber-500 to-orange-500',
    indigo: 'from-indigo-500 to-purple-500',
    red: 'from-red-500 to-rose-500',
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-r p-3 text-white ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm text-gray-500 dark:text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  )
}

function DataTable({ columns, rows, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-gray-400 dark:text-slate-500">
          <tr>{columns.map(column => <th key={column} className="border-b border-gray-100 px-3 py-2 dark:border-slate-800">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">{empty}</td></tr>
          ) : rows.map((row, index) => (
            <tr key={index} className="border-b border-gray-50 text-gray-700 last:border-0 dark:border-slate-800/70 dark:text-slate-300">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-xs truncate px-3 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({ page, size, total, totalPages, onPage }) {
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, total)
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>共 {total} 条，当前 {from}-{to}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPage(Math.max(0, page - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          上一页
        </button>
        <span className="rounded-lg bg-gray-100 px-3 py-2 text-gray-700 dark:bg-slate-800 dark:text-slate-200">{page + 1} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          下一页
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'}`}
    >
      {children}
    </button>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="grid gap-1 text-sm text-gray-500 dark:text-slate-400">
      <span>{label}</span>
      <input
        type="number"
        min="1"
        value={value || 1}
        onChange={event => onChange(Number(event.target.value))}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  )
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <span>{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-indigo-600" />
    </label>
  )
}

function SeverityBadge({ severity }) {
  const classes = {
    info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
    critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[severity] || classes.info}`}>{severity || 'info'}</span>
}

function categoryLabel(category) {
  const map = {
    public: '网站公开接口',
    music: '音乐列表',
    'music-stream': '音乐流',
    'music-stream-song': '歌曲流',
    login: '后台登录',
    ban: '封禁',
  }
  return map[category] || category
}

function eventTypeLabel(type) {
  const map = {
    limit: '触发限流',
    ban: '封禁',
    login_success: '登录成功',
    login_failure: '登录失败',
    login_blocked: '登录被限制',
  }
  return map[type] || type
}

function normalizeDate(value) {
  const normalized = String(value || '').replaceAll('-', '').trim()
  return /^\d{8}$/.test(normalized) ? normalized : new Date().toISOString().slice(0, 10).replaceAll('-', '')
}

function formatTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}
