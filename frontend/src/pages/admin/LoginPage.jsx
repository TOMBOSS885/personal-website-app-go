import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader, Lock, Mail, Moon, RefreshCw, ShieldCheck, Sun, User } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const API_BASE = ''
const RESEND_COOLDOWN_SECONDS = 60

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()
  const { colorMode, toggleColorMode } = useTheme()

  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendSeconds(current => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  const resetVerification = () => {
    setVerificationRequired(false)
    setMaskedEmail('')
    setCode('')
    setResendSeconds(0)
    setError('')
  }

  const beginVerification = (data, cooldown = RESEND_COOLDOWN_SECONDS) => {
    setVerificationRequired(true)
    setMaskedEmail(data.maskedEmail || maskedEmail)
    setCode('')
    setResendSeconds(Math.max(1, Number(data.retryAfter) || cooldown))
  }

  const submitCredentials = async ({ resend = false } = {}) => {
    setError('')
    resend ? setResending(true) : setLoading(true)

    try {
      const payload = { username, password }
      if (verificationRequired && !resend) payload.code = code

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let data = {}
      try {
        data = await res.json()
      } catch {
        // The status-based fallback below handles an empty or invalid response.
      }

      if (res.status === 202 && data.verificationRequired) {
        beginVerification(data)
        return
      }
      if (!res.ok) {
        if (data.verificationRequired) beginVerification(data)
        throw new Error(data.message || `登录失败（${res.status}）`)
      }
      if (!data.token) {
        throw new Error('登录响应无效，请稍后重试')
      }

      sessionStorage.setItem('token', data.token)
      localStorage.setItem('username', username)
      navigate('/admin')
    } catch (requestError) {
      console.error('Login error:', requestError)
      setError(requestError instanceof Error ? requestError.message : '登录失败，请稍后重试')
    } finally {
      resend ? setResending(false) : setLoading(false)
    }
  }

  const handleLogin = async event => {
    event.preventDefault()
    await submitCredentials()
  }

  const handleUsernameChange = event => {
    setUsername(event.target.value)
    if (verificationRequired) resetVerification()
  }

  const handlePasswordChange = event => {
    setPassword(event.target.value)
    if (verificationRequired) resetVerification()
  }

  const busy = loading || resending
  const submitDisabled = busy || (verificationRequired && code.length !== 6)

  return (
    <main className="admin-login relative flex min-h-[100svh] items-center justify-center overflow-y-auto bg-slate-100 px-4 py-16 transition-colors dark:bg-slate-950 sm:px-6">
      <button
        type="button"
        onClick={toggleColorMode}
        className="fixed right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:right-6 sm:top-6"
        title={colorMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
      >
        {colorMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg shadow-lg"
            style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow-lg)' }}
          >
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">管理后台</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {verificationRequired ? '完成邮箱安全验证后继续登录' : '登录以管理网站内容'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">
          {verificationRequired && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold">不常用 IP 安全验证</div>
                <div className="mt-1 break-all text-emerald-700 dark:text-emerald-300">验证码已发送至 {maskedEmail || '站长公开邮箱'}</div>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">用户名</span>
            <span className="relative block">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="请输入用户名"
                autoComplete="username"
                required
                disabled={busy}
              />
            </span>
          </label>

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">密码</span>
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="请输入密码"
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </span>
          </label>

          {verificationRequired && (
            <div className="mb-6">
              <label htmlFor="admin-login-code" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">邮箱验证码</label>
              <div className="flex min-w-0 gap-2">
                <span className="relative min-w-0 flex-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="admin-login-code"
                    value={code}
                    onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-3 text-lg tracking-[0.2em] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    disabled={busy}
                    autoFocus
                  />
                </span>
                <button
                  type="button"
                  onClick={() => submitCredentials({ resend: true })}
                  disabled={busy || resendSeconds > 0}
                  className="inline-flex h-[50px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resendSeconds > 0 ? `${resendSeconds}s` : '重发'}</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader className="h-5 w-5 animate-spin" />}
            {loading ? '验证中...' : verificationRequired ? '验证并登录' : '登录'}
          </button>

          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            登录后可在账号安全中修改密码
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-600">Powered by Go + React</p>
      </div>
    </main>
  )
}
