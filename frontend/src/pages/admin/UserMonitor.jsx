import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  UserRoundPlus,
} from 'lucide-react'

const PAGE_SIZE = 20

const TABS = [
  { id: 'users', label: '注册用户', icon: Users },
  { id: 'activities', label: '活动审计', icon: Activity },
  { id: 'comments', label: '评论审核', icon: MessageSquare },
]

const ACTION_LABELS = {
  login: '登录',
  login_success: '登录成功',
  login_failed: '登录失败',
  logout: '退出登录',
  register: '注册',
  send_code: '发送验证码',
  update_profile: '修改资料',
  update_username: '修改用户名',
  upload_avatar: '上传头像',
  create_comment: '发表评论',
  delete_comment: '删除评论',
  play_music: '播放音乐',
}

const emptyPage = { rows: [], total: 0 }

function authHeaders(json = false) {
  const token = sessionStorage.getItem('token')
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(Boolean(options.body)), ...options.headers },
  })
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const data = await response.json()
      message = data.message || data.error || message
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(message)
  }
  if (response.status === 204) return null
  return response.json()
}

function normalizePage(data, keys) {
  if (Array.isArray(data)) return { rows: data, total: data.length }
  const rows = [data?.content, ...keys.map(key => data?.[key]), data?.items, data?.list]
    .find(Array.isArray) || []
  return {
    rows,
    total: Number(data?.totalElements ?? data?.total ?? data?.count ?? rows.length) || 0,
  }
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}

function valueOf(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) return object[key]
  }
  return undefined
}

export default function UserMonitor() {
  const [activeTab, setActiveTab] = useState('users')
  const [summary, setSummary] = useState({})
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState('')

  const [usersPage, setUsersPage] = useState(emptyPage)
  const [usersLoading, setUsersLoading] = useState(false)
  const [userKeyword, setUserKeyword] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [userPage, setUserPage] = useState(0)

  const [activitiesPage, setActivitiesPage] = useState(emptyPage)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activityKeyword, setActivityKeyword] = useState('')
  const [activitySearch, setActivitySearch] = useState('')
  const [activityAction, setActivityAction] = useState('')
  const [activityPage, setActivityPage] = useState(0)

  const [commentsPage, setCommentsPage] = useState(emptyPage)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentKeyword, setCommentKeyword] = useState('')
  const [commentSearch, setCommentSearch] = useState('')
  const [commentStatus, setCommentStatus] = useState('')
  const [commentPage, setCommentPage] = useState(0)
  const [mutatingId, setMutatingId] = useState(null)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      setSummary(await request('/api/admin/users/summary'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(userPage), size: String(PAGE_SIZE) })
      if (userSearch) params.set('keyword', userSearch)
      if (userStatus) params.set('status', userStatus)
      setUsersPage(normalizePage(await request(`/api/admin/users?${params}`), ['users']))
    } catch (err) {
      setUsersPage(emptyPage)
      setError(err.message)
    } finally {
      setUsersLoading(false)
    }
  }, [userPage, userSearch, userStatus])

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(activityPage), size: String(PAGE_SIZE) })
      if (activitySearch) params.set('keyword', activitySearch)
      if (activityAction) params.set('action', activityAction)
      setActivitiesPage(normalizePage(await request(`/api/admin/user-activities?${params}`), ['activities']))
    } catch (err) {
      setActivitiesPage(emptyPage)
      setError(err.message)
    } finally {
      setActivitiesLoading(false)
    }
  }, [activityAction, activityPage, activitySearch])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(commentPage), size: String(PAGE_SIZE) })
      if (commentSearch) params.set('keyword', commentSearch)
      if (commentStatus) params.set('status', commentStatus)
      setCommentsPage(normalizePage(await request(`/api/admin/comments?${params}`), ['comments']))
    } catch (err) {
      setCommentsPage(emptyPage)
      setError(err.message)
    } finally {
      setCommentsLoading(false)
    }
  }, [commentPage, commentSearch, commentStatus])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { if (activeTab === 'users') loadUsers() }, [activeTab, loadUsers])
  useEffect(() => { if (activeTab === 'activities') loadActivities() }, [activeTab, loadActivities])
  useEffect(() => { if (activeTab === 'comments') loadComments() }, [activeTab, loadComments])

  const stats = useMemo(() => [
    {
      label: '注册用户',
      value: valueOf(summary, 'totalUsers', 'users', 'total') ?? 0,
      note: '历史注册总数',
      icon: Users,
      tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    },
    {
      label: '近期新增',
      value: valueOf(summary, 'new7Days', 'newUsers7d', 'recentUsers', 'newUsers') ?? 0,
      note: '最近 7 天',
      icon: UserRoundPlus,
      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      label: '今日活跃',
      value: valueOf(summary, 'active24Hours') ?? 0,
      note: '最近 24 小时',
      icon: Activity,
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    },
    {
      label: '近期活跃',
      value: valueOf(summary, 'active7Days', 'activeUsers7d', 'activeUsers', 'recentActiveUsers') ?? 0,
      note: '最近 7 天',
      icon: Activity,
      tone: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
    },
    {
      label: '已禁用用户',
      value: valueOf(summary, 'disabledUsers') ?? 0,
      note: '当前不可登录',
      icon: UserMinus,
      tone: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
    },
    {
      label: '文章评论',
      value: valueOf(summary, 'totalComments', 'comments') ?? 0,
      note: '全部文章评论',
      icon: MessageSquare,
      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    },
  ], [summary])

  const updateUserStatus = async (user) => {
    const id = valueOf(user, 'id', 'userId')
    const current = valueOf(user, 'status') || (user.disabled ? 'disabled' : 'active')
    const next = current === 'disabled' ? 'active' : 'disabled'
    const verb = next === 'disabled' ? '禁用' : '启用'
    if (!window.confirm(`确定${verb}用户“${valueOf(user, 'username', 'name', 'email') || id}”吗？`)) return
    setMutatingId(`user-${id}`)
    setError('')
    try {
      await request(`/api/admin/users/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      await Promise.all([loadUsers(), loadSummary()])
    } catch (err) {
      setError(err.message)
    } finally {
      setMutatingId(null)
    }
  }

  const updateCommentStatus = async (comment) => {
    const id = valueOf(comment, 'id', 'commentId')
    const current = valueOf(comment, 'status') || (comment.hidden ? 'hidden' : 'visible')
    const next = current === 'hidden' ? 'visible' : 'hidden'
    setMutatingId(`comment-${id}`)
    setError('')
    try {
      await request(`/api/admin/comments/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      await Promise.all([loadComments(), loadSummary()])
    } catch (err) {
      setError(err.message)
    } finally {
      setMutatingId(null)
    }
  }

  const deleteComment = async (comment) => {
    const id = valueOf(comment, 'id', 'commentId')
    if (!window.confirm('删除后无法恢复，确定永久删除这条评论吗？')) return
    setMutatingId(`comment-${id}`)
    setError('')
    try {
      await request(`/api/admin/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await Promise.all([loadComments(), loadSummary()])
    } catch (err) {
      setError(err.message)
    } finally {
      setMutatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
            <ShieldCheck className="h-7 w-7" style={{ color: 'var(--theme-primary)' }} />
            用户监控
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">管理用户状态，追踪账户活动并审核文章评论。</p>
        </div>
        <button
          type="button"
          onClick={() => Promise.all([loadSummary(), activeTab === 'users' ? loadUsers() : activeTab === 'activities' ? loadActivities() : loadComments()])}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          刷新数据
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="用户统计">
        {stats.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-slate-100">{summaryLoading ? '-' : value}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{note}</p>
              </div>
              <span className={`rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" /></span>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 pt-3 dark:border-slate-800" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <UsersTab
            data={usersPage}
            loading={usersLoading}
            keyword={userKeyword}
            setKeyword={setUserKeyword}
            status={userStatus}
            setStatus={(value) => { setUserStatus(value); setUserPage(0) }}
            submit={() => { setUserPage(0); setUserSearch(userKeyword.trim()) }}
            page={userPage}
            setPage={setUserPage}
            onToggle={updateUserStatus}
            mutatingId={mutatingId}
          />
        )}
        {activeTab === 'activities' && (
          <ActivitiesTab
            data={activitiesPage}
            loading={activitiesLoading}
            keyword={activityKeyword}
            setKeyword={setActivityKeyword}
            action={activityAction}
            setAction={(value) => { setActivityAction(value); setActivityPage(0) }}
            submit={() => { setActivityPage(0); setActivitySearch(activityKeyword.trim()) }}
            page={activityPage}
            setPage={setActivityPage}
          />
        )}
        {activeTab === 'comments' && (
          <CommentsTab
            data={commentsPage}
            loading={commentsLoading}
            keyword={commentKeyword}
            setKeyword={setCommentKeyword}
            status={commentStatus}
            setStatus={(value) => { setCommentStatus(value); setCommentPage(0) }}
            submit={() => { setCommentPage(0); setCommentSearch(commentKeyword.trim()) }}
            page={commentPage}
            setPage={setCommentPage}
            onToggle={updateCommentStatus}
            onDelete={deleteComment}
            mutatingId={mutatingId}
          />
        )}
      </section>
    </div>
  )
}

function FilterBar({ children, keyword, setKeyword, submit, placeholder }) {
  return (
    <form
      onSubmit={(event) => { event.preventDefault(); submit() }}
      className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto] dark:border-slate-800"
    >
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>
      {children}
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
        <Search className="h-4 w-4" />筛选
      </button>
    </form>
  )
}

function UsersTab({ data, loading, keyword, setKeyword, status, setStatus, submit, page, setPage, onToggle, mutatingId }) {
  return (
    <div role="tabpanel">
      <FilterBar keyword={keyword} setKeyword={setKeyword} submit={submit} placeholder="搜索用户名或邮箱">
        <Select value={status} onChange={setStatus} options={[['', '全部状态'], ['active', '正常'], ['disabled', '已禁用']]} />
      </FilterBar>
      <DataState loading={loading} empty={!data.rows.length} emptyText="暂无匹配用户">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <TableHead labels={['用户', '状态', '注册时间', '最近活跃', '登录次数', '操作']} />
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {data.rows.map(user => {
                const id = valueOf(user, 'id', 'userId')
                const userState = valueOf(user, 'status') || (user.disabled ? 'disabled' : 'active')
                return (
                  <tr key={id} className="text-gray-700 dark:text-slate-200">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {valueOf(user, 'avatarUrl', 'avatar') ? (
                          <img src={valueOf(user, 'avatarUrl', 'avatar')} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-300">
                            {String(valueOf(user, 'username', 'name', 'email') || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-slate-100">{valueOf(user, 'username', 'name') || '未设置用户名'}</div>
                          <div className="flex max-w-xs items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                            <span className="truncate">{user.email || '-'}</span>
                            {user.emailVerified === false && <span className="shrink-0 text-amber-600 dark:text-amber-300">未验证</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={userState} /></td>
                    <td className="whitespace-nowrap px-5 py-3">{formatTime(valueOf(user, 'createdAt', 'registeredAt'))}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatTime(valueOf(user, 'lastActiveAt', 'lastLoginAt', 'updatedAt'))}</td>
                    <td className="px-5 py-3">{valueOf(user, 'loginCount') ?? 0}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        disabled={mutatingId === `user-${id}`}
                        onClick={() => onToggle(user)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${userState === 'disabled' ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300' : 'border-red-200 text-red-600 dark:border-red-900 dark:text-red-300'}`}
                      >
                        {mutatingId === `user-${id}` ? <Loader className="h-3.5 w-3.5 animate-spin" /> : userState === 'disabled' ? <UserCheck className="h-3.5 w-3.5" /> : <UserMinus className="h-3.5 w-3.5" />}
                        {userState === 'disabled' ? '启用' : '禁用'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DataState>
      <Pagination page={page} total={data.total} setPage={setPage} />
    </div>
  )
}

function ActivitiesTab({ data, loading, keyword, setKeyword, action, setAction, submit, page, setPage }) {
  const options = [['', '全部操作'], ...Object.entries(ACTION_LABELS)]
  return (
    <div role="tabpanel">
      <FilterBar keyword={keyword} setKeyword={setKeyword} submit={submit} placeholder="搜索用户、邮箱、IP 或详情">
        <Select value={action} onChange={setAction} options={options} />
      </FilterBar>
      <DataState loading={loading} empty={!data.rows.length} emptyText="暂无用户活动记录">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <TableHead labels={['时间', '用户', '操作', '详情', 'IP 地址']} />
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {data.rows.map((item, index) => (
                <tr key={valueOf(item, 'id', 'activityId') ?? index} className="text-gray-700 dark:text-slate-200">
                  <td className="whitespace-nowrap px-5 py-3">{formatTime(valueOf(item, 'createdAt', 'occurredAt', 'timestamp'))}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900 dark:text-slate-100">{valueOf(item, 'username', 'userName') || '-'}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{item.email || '-'}</div>
                  </td>
                  <td className="px-5 py-3"><span className="rounded-md bg-gray-100 px-2 py-1 text-xs dark:bg-slate-800">{ACTION_LABELS[item.action] || item.action || '-'}</span></td>
                  <td className="max-w-sm px-5 py-3 text-gray-500 dark:text-slate-400">{valueOf(item, 'detail', 'description', 'message') || '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">{valueOf(item, 'ip', 'ipAddress') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      <Pagination page={page} total={data.total} setPage={setPage} />
    </div>
  )
}

function CommentsTab({ data, loading, keyword, setKeyword, status, setStatus, submit, page, setPage, onToggle, onDelete, mutatingId }) {
  return (
    <div role="tabpanel">
      <FilterBar keyword={keyword} setKeyword={setKeyword} submit={submit} placeholder="搜索评论、文章或用户">
        <Select value={status} onChange={setStatus} options={[['', '全部状态'], ['visible', '公开'], ['hidden', '已隐藏']]} />
      </FilterBar>
      <DataState loading={loading} empty={!data.rows.length} emptyText="暂无匹配评论">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {data.rows.map(comment => {
            const id = valueOf(comment, 'id', 'commentId')
            const state = valueOf(comment, 'status') || (comment.hidden ? 'hidden' : 'visible')
            const busy = mutatingId === `comment-${id}`
            return (
              <article key={id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{valueOf(comment, 'username', 'userName') || '未知用户'}</span>
                      <span className="text-gray-400">评论了</span>
                      <span className="font-medium text-indigo-600 dark:text-indigo-300">{valueOf(comment, 'articleTitle', 'postTitle') || '文章'}</span>
                      <StatusBadge status={state} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-slate-200">{valueOf(comment, 'content', 'body') || '-'}</p>
                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">{formatTime(valueOf(comment, 'createdAt', 'publishedAt'))}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onToggle(comment)}
                      title={state === 'hidden' ? '恢复显示' : '隐藏评论'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {busy ? <Loader className="h-4 w-4 animate-spin" /> : state === 'hidden' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(comment)}
                      title="永久删除"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </DataState>
      <Pagination page={page} total={data.total} setPage={setPage} />
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
    </select>
  )
}

function TableHead({ labels }) {
  return (
    <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-slate-950 dark:text-slate-400">
      <tr>{labels.map(label => <th key={label} className="whitespace-nowrap px-5 py-3">{label}</th>)}</tr>
    </thead>
  )
}

function DataState({ loading, empty, emptyText, children }) {
  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-gray-500"><Loader className="mr-2 h-5 w-5 animate-spin" />加载中...</div>
  if (empty) return <div className="py-16 text-center text-sm text-gray-400">{emptyText}</div>
  return children
}

function StatusBadge({ status }) {
  const disabled = status === 'disabled' || status === 'hidden'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${disabled ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
      {status === 'disabled' ? '已禁用' : status === 'hidden' ? '已隐藏' : status === 'visible' ? '公开' : '正常'}
    </span>
  )
}

function Pagination({ page, total, setPage }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total ? page * PAGE_SIZE + 1 : 0
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>共 {total} 条，当前 {from}-{to}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 0} onClick={() => setPage(value => Math.max(0, value - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 dark:border-slate-700" title="上一页"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-20 text-center">{page + 1} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 dark:border-slate-700" title="下一页"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
