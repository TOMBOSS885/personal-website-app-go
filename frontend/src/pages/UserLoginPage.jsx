import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUserAuth } from '../contexts/UserAuthContext'

const CODE_COOLDOWN_SECONDS = 60

function safeReturnPath(search) {
  const path = new URLSearchParams(search).get('returnTo') || '/'
	if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.startsWith('/login')) return '/'
	try {
		const origin = window.location.origin
		const resolved = new URL(path, origin)
		if (resolved.origin !== origin) return '/'
		return `${resolved.pathname}${resolved.search}${resolved.hash}`
	} catch {
		return '/'
	}
}

export default function UserLoginPage() {
  const { user, loading, requestCode, login } = useUserAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) navigate(safeReturnPath(location.search), { replace: true })
  }, [loading, user, location.search, navigate])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleRequestCode = async () => {
    if (!email.trim() || sending || cooldown > 0) return
    setSending(true)
    setError('')
    setMessage('')
    try {
      await requestCode(email)
      setCooldown(CODE_COOLDOWN_SECONDS)
      setMessage('验证码已发送，请检查收件箱和垃圾邮件目录。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
		try {
			await login(email, code)
		} catch (loginError) {
      setError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-24 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-950 dark:text-gray-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回网站
        </Link>

        <section className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-500/10 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/90 sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              <LogIn className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white">邮箱登录</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">首次验证邮箱会自动创建账号，无需设置密码。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">邮箱地址</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">验证码</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位验证码"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleRequestCode}
				  disabled={!email.trim() || sending || cooldown > 0}
				  aria-label={sending ? '正在发送验证码' : cooldown > 0 ? `${cooldown} 秒后可重新发送验证码` : '获取验证码'}
                  className="inline-flex min-w-28 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                >
                  {sending ? <Loader className="h-4 w-4 animate-spin" /> : cooldown > 0 ? `${cooldown} 秒` : '获取验证码'}
                </button>
              </div>
            </label>

            {message && (
              <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {message}
              </div>
            )}
            {error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

            <button
              type="submit"
              disabled={submitting || code.length !== 6 || !email.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? '正在登录...' : '安全登录'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
