import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, Link2, ShieldCheck, Unlink, X } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoadingIndicator from '../components/LoadingIndicator'
import { useUserAuth } from '../contexts/UserAuthContext'
import { isAllowedOAuthAuthorizationUrl, isSafeInternalPath, OAUTH_PROVIDERS, normalizeOAuthProviders, oauthFeedback, withoutOAuthFeedback } from '../utils/oauth'

export default function UserAccountPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: userLoading, checkSession } = useUserAuth()
  const [providers, setProviders] = useState([])
  const [identities, setIdentities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unbindTarget, setUnbindTarget] = useState(null)
  const [bindTarget, setBindTarget] = useState(null)
  const [password, setPassword] = useState('')
  const [unbindBusy, setUnbindBusy] = useState(false)
  const [unbindError, setUnbindError] = useState('')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [nicknameBusy, setNicknameBusy] = useState(false)
  const [nicknameMessage, setNicknameMessage] = useState('')
  const feedback = useMemo(() => oauthFeedback(location.search), [location.search])
  const requestedReturn = useMemo(() => {
    const value = new URLSearchParams(location.search).get('return')
    return isSafeInternalPath(value) ? withoutOAuthFeedback(value) : ''
  }, [location.search])
  const handledSuccessRef = useRef(false)

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [providersResponse, identitiesResponse] = await Promise.all([
        fetch('/api/auth/oauth/providers', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/auth/oauth/identities', { cache: 'no-store', credentials: 'same-origin' }),
      ])
      const providersData = await providersResponse.json().catch(() => ({}))
      const identitiesData = await identitiesResponse.json().catch(() => ({}))
      if (!providersResponse.ok) throw new Error(providersData.message || '加载第三方登录配置失败')
      if (!identitiesResponse.ok) throw new Error(identitiesData.message || '加载账号绑定信息失败')
      setProviders(normalizeOAuthProviders(providersData.providers))
      setIdentities(Array.isArray(identitiesData.identities) ? identitiesData.identities : [])
    } catch (nextError) {
      setError(nextError.message || '加载账号信息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (!user.csrfToken) void checkSession()
    void loadAccount()
  }, [user?.id, user?.csrfToken, checkSession, loadAccount])

  useEffect(() => { setNickname(user?.nickname || '') }, [user?.nickname])

  const saveNickname = async event => {
    event.preventDefault(); setNicknameBusy(true); setNicknameMessage('')
    try {
      const response = await fetch('/api/me/nickname', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user?.csrfToken || '' }, body: JSON.stringify({ nickname }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || '昵称更新失败')
      setNicknameMessage('昵称已更新'); await checkSession()
    } catch (error) { setNicknameMessage(error.message || '昵称更新失败') } finally { setNicknameBusy(false) }
  }

  useEffect(() => {
    if (!user || feedback?.type !== 'success' || handledSuccessRef.current) return
    handledSuccessRef.current = true
    void checkSession().then(authenticated => {
      if (authenticated && requestedReturn) navigate(requestedReturn, { replace: true })
      else void loadAccount()
    })
  }, [user, feedback?.type, requestedReturn, checkSession, loadAccount, navigate])

  const requestBind = provider => {
    setBindTarget(provider)
    setPassword('')
    setUnbindError('')
  }

  const requestUnbind = identity => {
    setUnbindTarget(identity)
    setPassword('')
    setUnbindError('')
  }

  const closeUnbind = () => {
    if (unbindBusy) return
    setUnbindTarget(null)
    setBindTarget(null)
    setPassword('')
    setUnbindError('')
  }

  const confirmBind = async event => {
    event.preventDefault()
    if (!bindTarget || !password || unbindBusy) return
    setUnbindBusy(true)
    setUnbindError('')
    try {
      const returnPath = requestedReturn || '/account'
      const response = await fetch(`/api/auth/oauth/${bindTarget.provider}/bind-start`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user?.csrfToken || '' },
        body: JSON.stringify({ currentPassword: password, return: returnPath }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '无法开始绑定')
      if (!isAllowedOAuthAuthorizationUrl(bindTarget.provider, data.authorizationUrl)) throw new Error('服务器返回了无效的授权地址。')
      window.location.assign(data.authorizationUrl)
    } catch (nextError) {
      setUnbindError(nextError.message || '无法开始绑定，请稍后重试。')
      setUnbindBusy(false)
    }
  }

  const confirmUnbind = async event => {
    event.preventDefault()
    if (!unbindTarget || !password || unbindBusy) return
    setUnbindBusy(true)
    setUnbindError('')
    try {
      const response = await fetch(`/api/auth/oauth/${unbindTarget.provider}/unbind`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': user?.csrfToken || '',
        },
        body: JSON.stringify({ currentPassword: password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '解绑失败')
      setUnbindTarget(null)
      setBindTarget(null)
      setPassword('')
      setUnbindError('')
      await Promise.all([loadAccount(), checkSession()])
    } catch (nextError) {
      setUnbindError(nextError.message || '解绑失败，请稍后重试。')
    } finally {
      setUnbindBusy(false)
    }
  }

  if (userLoading) return <div className="flex min-h-screen items-center justify-center"><LoadingIndicator size={52} label="加载账号" /></div>
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />

  return (
    <main className="min-h-screen px-4 pb-16 pt-28">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"><ArrowLeft className="h-4 w-4" />返回首页</Link>
        <div className="border-b border-gray-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-300" /><h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">账号与登录方式</h1></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">站内账号 <span className="font-medium text-gray-800 dark:text-slate-200">{user.email}</span>，已绑定的第三方账号可用于登录。</p>
          <form onSubmit={saveNickname} className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium text-gray-700 dark:text-slate-300">昵称<input value={nickname} onChange={event => setNickname(event.target.value.slice(0, 80))} maxLength={80} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label><button type="submit" disabled={nicknameBusy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{nicknameBusy ? '保存中...' : '保存昵称'}</button></form>
          {nicknameMessage && <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{nicknameMessage}</p>}
        </div>

        {feedback && <div role="status" className={`mt-5 rounded-lg border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>{feedback.message}</div>}

        {loading ? <div className="flex justify-center py-16"><LoadingIndicator size={32} label="加载绑定信息" /></div> : error ? <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><p>{error}</p><button type="button" onClick={() => void loadAccount()} className="mt-3 rounded-lg border border-current px-3 py-2 text-sm font-medium">重新加载</button></div> : (
          <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white/85 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-slate-800"><h2 className="font-semibold text-gray-900 dark:text-slate-100">第三方账号</h2><p className="mt-1 text-xs text-gray-500 dark:text-slate-400">绑定时会跳转到对应平台完成官方授权。</p></div>
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {providers.map(provider => {
                const definition = OAUTH_PROVIDERS[provider.provider]
                const Icon = definition.icon
                const identity = identities.find(item => item.provider === provider.provider)
                const available = provider.enabled && provider.configured
                return <div key={provider.provider} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200"><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-slate-100">{provider.name}</h3>{identity ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" />已绑定</span> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-800 dark:text-slate-400">未绑定</span>}</div>{identity && <p className="mt-1 truncate text-sm text-gray-500 dark:text-slate-400">{identity.displayName || '已验证身份'}{identity.boundAt ? ` · 绑定于 ${new Date(identity.boundAt).toLocaleDateString('zh-CN')}` : ''}</p>}{!identity && !available && <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">尚未启用或配置</p>}</div></div>
                  {identity ? <button type="button" onClick={() => requestUnbind(identity)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-950/30"><Unlink className="h-4 w-4" />解绑</button> : available ? <button type="button" onClick={() => requestBind(provider)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"><Link2 className="h-4 w-4" />绑定<ExternalLink className="h-3.5 w-3.5" /></button> : <button type="button" disabled className="h-10 rounded-lg border border-gray-200 px-4 text-sm text-gray-400 dark:border-slate-700 dark:text-slate-500">暂不可用</button>}
                </div>
              })}
              {providers.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-slate-400">暂无可用的第三方登录方式</div>}
            </div>
          </section>
        )}
      </div>

      {(unbindTarget || bindTarget) && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeUnbind() }}><section role="dialog" aria-modal="true" aria-labelledby="oauth-confirm-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><h2 id="oauth-confirm-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">{bindTarget ? '绑定' : '解绑'} {OAUTH_PROVIDERS[(bindTarget || unbindTarget).provider]?.name || '第三方账号'}</h2><button type="button" onClick={closeUnbind} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="关闭"><X className="h-5 w-5" /></button></div><p className="mt-3 text-sm text-gray-600 dark:text-slate-300">这是敏感操作，请输入当前站内账号密码确认。</p><form onSubmit={bindTarget ? confirmBind : confirmUnbind} className="mt-5"><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">当前密码<input type="password" required autoFocus autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label>{unbindError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{unbindError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={closeUnbind} disabled={unbindBusy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">取消</button><button type="submit" disabled={unbindBusy || !password} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${bindTarget ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}>{unbindBusy && <LoadingIndicator size={15} />}确认{bindTarget ? '并前往授权' : '解绑'}</button></div></form></section></div>}
    </main>
  )
}
