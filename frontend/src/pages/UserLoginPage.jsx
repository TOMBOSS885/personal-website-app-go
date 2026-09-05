import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react'
import { getAdminBasePath } from '../utils/adminEntry'
import { useUserAuth } from '../contexts/UserAuthContext'
import { OAUTH_PROVIDERS, normalizeOAuthProviders, oauthFeedback, oauthStartUrl } from '../utils/oauth'

const QQ_EMAIL = /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@qq\.com$/i

export default function UserLoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const redirect = useMemo(() => {
    const value = new URLSearchParams(location.search).get('redirect')
    return normalizeRedirect(value)
  }, [location.search])
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [providers, setProviders] = useState([])
  const [oauthLoading, setOauthLoading] = useState(true)
  const [registrationVerification, setRegistrationVerification] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [codeSending, setCodeSending] = useState(false)
  const [codeMessage, setCodeMessage] = useState('')
  const feedback = useMemo(() => oauthFeedback(location.search), [location.search])
  const { login, register, checkSession } = useUserAuth()

  useEffect(() => {
    if (mode !== 'register') return undefined
    let active = true
    fetch('/api/public/registration-settings', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { registrationEmailVerificationEnabled: false })
      .then(data => { if (active) setRegistrationVerification(Boolean(data.registrationEmailVerificationEnabled)) })
      .catch(() => { if (active) setRegistrationVerification(false) })
    return () => { active = false }
  }, [mode])

  useEffect(() => {
    if (codeCooldown <= 0) return undefined
    const timer = window.setInterval(() => setCodeCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [codeCooldown])

  useEffect(() => {
    let active = true
    fetch('/api/auth/oauth/providers', { cache: 'no-store', credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : { providers: [] })
      .then(data => { if (active) setProviders(normalizeOAuthProviders(data.providers).filter(item => item.enabled && item.configured)) })
      .catch(() => { if (active) setProviders([]) })
      .finally(() => { if (active) setOauthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (feedback?.type !== 'success') return
    let active = true
    void checkSession().then(authenticated => {
      if (active && authenticated) navigate(redirect, { replace: true })
    })
    return () => { active = false }
  }, [feedback?.type, checkSession, navigate, redirect])

  const submit = async event => {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!QQ_EMAIL.test(normalized)) {
      setError('请使用有效的 QQ 邮箱地址。')
      return
    }
    if (password.length < 10 || password.length > 128) {
      setError('密码长度必须为 10 至 128 位。')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(normalized, password)
      else {
        if (registrationVerification && !/^\d{6}$/.test(emailCode)) {
          setError('请输入 6 位邮箱验证码。')
          setBusy(false)
          return
        }
        if (!nickname.trim()) { setError('请输入昵称。'); setBusy(false); return }
        await register(normalized, password, emailCode, nickname.trim())
      }
      navigate(redirect, { replace: true })
    } catch (nextError) {
      setError(nextError.message || '操作失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  const sendCode = async () => {
    const normalized = email.trim().toLowerCase()
    if (!QQ_EMAIL.test(normalized)) { setError('请先输入有效的 QQ 邮箱地址。'); return }
    if (codeCooldown > 0 || codeSending) return
    setCodeSending(true); setError(''); setCodeMessage('')
    try {
      const response = await fetch('/api/auth/user-register/email-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email: normalized }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw Object.assign(new Error(data.message || '验证码发送失败'), { code: data.code })
      setCodeCooldown(60)
      setCodeMessage(data.message || '验证码已发送，请查收邮箱。')
    } catch (nextError) {
      setError(nextError.message || '验证码发送失败')
    } finally { setCodeSending(false) }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-2xl border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/85 sm:p-8">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"><ArrowLeft className="h-4 w-4" />返回首页</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{mode === 'login' ? '账号登录' : '注册账号'}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">普通账号仅支持 QQ 邮箱注册。</p>
        {feedback && <p role="status" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>{feedback.message}</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">QQ 邮箱<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="name@qq.com" /></label>
          {mode === 'register' && <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">昵称<input type="text" value={nickname} onChange={event => setNickname(event.target.value.slice(0, 80))} autoComplete="nickname" required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="用于显示作者名称" /></label>}
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="至少 10 位" /></label>
          {mode === 'register' && registrationVerification && <div><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">邮箱验证码<div className="mt-1 flex gap-2"><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={emailCode} onChange={event => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="6 位验证码" /><button type="button" onClick={() => void sendCode()} disabled={codeSending || codeCooldown > 0} className="shrink-0 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{codeSending ? '发送中...' : codeCooldown > 0 ? `${codeCooldown}s 后重发` : '发送验证码'}</button></div></label>{codeMessage && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{codeMessage}</p>}</div>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{busy ? '处理中...' : mode === 'login' ? '登录' : '注册并登录'}</button>
        </form>
        {mode === 'login' && !oauthLoading && providers.length > 0 && <div className="mt-6"><div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500"><span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" /><span>其他登录方式</span><span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{providers.map(provider => { const Icon = OAUTH_PROVIDERS[provider.provider].icon; const returnPath = `/login?redirect=${encodeURIComponent(redirect)}`; return <a key={provider.provider} href={oauthStartUrl(provider.provider, 'login', returnPath)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10"><Icon className="h-4 w-4" />{provider.name}</a> })}</div><p className="mt-3 text-center text-xs text-gray-400 dark:text-slate-500">仅已绑定的第三方账号可直接登录</p></div>}
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setEmailCode(''); setCodeMessage(''); setCodeCooldown(0) }} className="mt-5 w-full text-center text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-300">{mode === 'login' ? '还没有账号？注册' : '已有账号？返回登录'}</button>
        <Link to={`${getAdminBasePath()}/login`} className="mt-3 block text-center text-xs text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-300">管理员登录入口</Link>
      </section>
    </main>
  )
}

function normalizeRedirect(value) {
  if (!value || !value.startsWith('/')) return '/'
  try {
    // URL normalization also catches backslash variants such as `/\\evil.com`.
    const target = new URL(value, window.location.origin)
    if (target.origin !== window.location.origin) return '/'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/'
  }
}

export { normalizeRedirect }
