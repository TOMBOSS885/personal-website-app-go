import { useEffect, useState } from 'react'
import { Eye, Link2, Lock, Search, ShieldCheck, Trash2, Unlock, UserCheck, UserX, X } from 'lucide-react'
import LoadingIndicator from '../../components/LoadingIndicator'
import { safeDownloadHref } from '../../utils/safeUrl'

const PROVIDER_NAMES = { github: 'GitHub', qq: 'QQ', wechat: '微信', google: 'Google', microsoft: 'Microsoft' }

export function oauthProviderName(provider) {
  return PROVIDER_NAMES[provider] || provider || '第三方账号'
}

export function formatAdminDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function OAuthIdentityDetails({ identity }) {
  const avatarUrl = safeDownloadHref(identity.avatarUrl)
  const providerName = oauthProviderName(identity.provider)

  return <div className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400 dark:bg-slate-800">
      {avatarUrl ? <img src={avatarUrl} alt={`${providerName} 头像`} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <Link2 className="h-4 w-4" />}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{providerName}</span>
        <span className="min-w-0 truncate font-medium text-gray-900 dark:text-slate-100" title={identity.displayName || ''}>{identity.displayName || '未提供昵称'}</span>
      </div>
      <dl className="mt-1.5 grid gap-x-3 gap-y-1 text-xs text-gray-500 sm:grid-cols-[auto_1fr] dark:text-slate-400">
        <dt>平台 ID</dt><dd className="break-all font-mono text-[11px] text-gray-700 dark:text-slate-300">{identity.providerSubject || '-'}</dd>
        {identity.providerUnionId && <><dt>UnionID</dt><dd className="break-all font-mono text-[11px] text-gray-700 dark:text-slate-300">{identity.providerUnionId}</dd></>}
        <dt>绑定时间</dt><dd>{formatAdminDate(identity.boundAt)}</dd>
        <dt>最近登录</dt><dd>{formatAdminDate(identity.lastLoginAt)}</dd>
      </dl>
    </div>
  </div>
}

function OAuthIdentityDialog({ user, onClose }) {
  const identities = Array.isArray(user.oauthIdentities) ? user.oauthIdentities : []

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="oauth-identity-dialog-title" className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0"><h2 id="oauth-identity-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">第三方账号详情</h2><p className="mt-1 truncate text-sm text-gray-500 dark:text-slate-400">{user.email} · 用户 ID {user.id}</p></div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800" title="关闭" aria-label="关闭第三方账号详情"><X className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto px-5 py-5">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">{identities.map(identity => <OAuthIdentityDetails key={identity.id || identity.provider} identity={identity} />)}</div>
      </div>
    </section>
  </div>
}

function UserActions({ user, busy, onAction }) {
  return <div className="flex justify-end gap-1">
    {user.status === 'locked'
      ? <button title="解冻" onClick={() => onAction(user, 'unlock')} disabled={busy === user.id} className="rounded p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><Unlock className="h-4 w-4" /></button>
      : <button title="冻结 24 小时" onClick={() => onAction(user, 'lock')} disabled={busy === user.id} className="rounded p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-50"><Lock className="h-4 w-4" /></button>}
    {user.status === 'disabled'
      ? <button title="启用" onClick={() => onAction(user, 'enable')} disabled={busy === user.id} className="rounded p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><UserCheck className="h-4 w-4" /></button>
      : <button title="禁用" onClick={() => onAction(user, 'disable')} disabled={busy === user.id} className="rounded p-2 text-orange-600 hover:bg-orange-50 disabled:opacity-50"><UserX className="h-4 w-4" /></button>}
    <button title="重置密码" onClick={() => onAction(user, 'reset-password')} disabled={busy === user.id} className="rounded p-2 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"><ShieldCheck className="h-4 w-4" /></button>
    <button title="删除" onClick={() => onAction(user, 'delete')} disabled={busy === user.id} className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
  </div>
}

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, locked: 0, disabled: 0 })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ size: '100' })
      if (query.trim()) params.set('q', query.trim())
      if (status) params.set('status', status)
      const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '加载用户失败')
      setUsers(Array.isArray(data.content) ? data.content : [])
      if (data.summary) setSummary(data.summary)
    } catch (loadError) {
      setError(loadError.message || '加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [status])

  const action = async (user, name) => {
    if (name === 'delete' && !confirm(`确定删除 ${user.email}？此操作不可撤销。`)) return
    let newPassword = ''
    if (name === 'reset-password') {
      newPassword = window.prompt('请输入新密码（10 至 128 位）') || ''
      if (!newPassword) return
    }
    if (name === 'disable' && !confirm(`确定禁用 ${user.email}？`)) return
    setBusy(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: name === 'delete' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(name === 'delete' ? { confirm: true } : { action: name, newPassword }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '操作失败')
      await load()
    } catch (actionError) {
      alert(actionError.message || '操作失败')
    } finally {
      setBusy(null)
    }
  }

  const changeRole = async (user, role) => {
    if (role === user.role || !window.confirm(`确定将 ${user.email} 设置为 ${role} 吗？`)) return
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || '角色更新失败'); await load()
    } catch (error) { window.alert(error.message || '角色更新失败') }
  }

  return <div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><ShieldCheck className="h-7 w-7 text-indigo-600" />用户账号</h1><p className="mt-1 text-sm text-gray-500">管理站内账号及其第三方登录身份</p></div>
      <div className="flex gap-3 text-sm"><span className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-slate-800">总数 {summary.total}</span><span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">正常 {summary.active}</span><span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">冻结 {summary.locked}</span></div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2">
      <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && load()} placeholder="搜索邮箱、用户 ID、第三方昵称或平台 ID" className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div>
      <select value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">全部状态</option><option value="active">正常</option><option value="locked">冻结</option><option value="disabled">已禁用</option></select>
      <button type="button" onClick={load} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">搜索</button>
    </div>
    <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {loading ? <div className="py-16 text-center"><LoadingIndicator size={22} /></div> : error ? <div className="py-16 text-center text-red-600">{error}</div> : <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-left text-gray-500 dark:border-slate-800 dark:bg-slate-950"><tr><th className="px-5 py-3">账号</th><th className="px-5 py-3">角色</th><th className="px-5 py-3">状态</th><th className="w-[260px] px-5 py-3">第三方绑定</th><th className="px-5 py-3">注册时间</th><th className="px-5 py-3">最后登录</th><th className="px-5 py-3">访问次数</th><th className="px-5 py-3 text-right">操作</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">{users.map(user => {
          const identities = Array.isArray(user.oauthIdentities) ? user.oauthIdentities : []
          return <tr key={user.id} className="align-top">
            <td className="px-5 py-4"><div className="font-medium text-gray-900 dark:text-slate-100">{user.displayName || user.nickname || user.email}</div><div className="text-xs text-gray-400">{user.email} · ID: {user.id}</div></td>
            <td className="px-5 py-4"><select value={user.role || 'USER'} onChange={event => void changeRole(user, event.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></td>
            <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : user.status === 'locked' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{user.status === 'active' ? '正常' : user.status === 'locked' ? '冻结' : '已禁用'}</span></td>
            <td className="px-5 py-4">{identities.length ? <button type="button" onClick={() => setSelectedUser(user)} className="inline-flex max-w-full items-center gap-1.5 rounded-md p-1 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-800" title="查看第三方账号详情" aria-label={`查看 ${user.email} 的第三方账号详情`}>{identities.map(identity => <span key={identity.id || identity.provider} className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"><Link2 className="h-3 w-3" />{oauthProviderName(identity.provider)}</span>)}<Eye className="ml-1 h-4 w-4 shrink-0 text-gray-400" /></button> : <span className="text-xs text-gray-400">未绑定</span>}</td>
            <td className="whitespace-nowrap px-5 py-4 text-gray-500">{formatAdminDate(user.createdAt)}</td>
            <td className="whitespace-nowrap px-5 py-4 text-gray-500">{formatAdminDate(user.lastLoginAt)}</td>
            <td className="px-5 py-4">{user.visitCount || 0}</td>
            <td className="px-5 py-4 text-right"><UserActions user={user} busy={busy} onAction={action} /></td>
          </tr>
        })}</tbody>
      </table>}
    </div>
    {selectedUser && <OAuthIdentityDialog user={selectedUser} onClose={() => setSelectedUser(null)} />}
  </div>
}
