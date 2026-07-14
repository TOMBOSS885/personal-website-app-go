import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUserAuth } from '../contexts/UserAuthContext'

const CODE_COOLDOWN_SECONDS = 60
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,30}$/u

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

function validPassword(password) {
  const length = new TextEncoder().encode(password).length
  return length >= 8 && length <= 72 && !/[\u0000-\u001f\u007f]/.test(password)
}

export default function UserLoginPage() {
  const { user, loading, requestCode, login, register, resetPassword } = useUserAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [cooldownEmail, setCooldownEmail] = useState('')
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

  const changeMode = nextMode => {
    if (sending) return
    setMode(nextMode)
    setCode('')
    setPassword('')
    setConfirmPassword('')
    setMessage('')
    setError('')
  }

  const handleRequestCode = async () => {
    const requestedEmail = email.trim()
    const normalizedRequestedEmail = requestedEmail.toLowerCase()
    const purpose = mode === 'register' ? 'register' : 'reset'
    const activeCooldown = cooldownEmail === normalizedRequestedEmail ? cooldown : 0
    if (!requestedEmail || sending || activeCooldown > 0 || mode === 'login') return
    setSending(true)
    setError('')
    setMessage('')
    try {
      await requestCode(requestedEmail, purpose)
      setCooldownEmail(normalizedRequestedEmail)
      setCooldown(CODE_COOLDOWN_SECONDS)
      setMessage('验证码已发送，请检查收件箱和垃圾邮件目录。')
    } catch (requestError) {
      if (requestError.status === 429) {
        const retryAfter = Math.ceil(Number(requestError.data?.retryAfter ?? requestError.data?.remainingSeconds))
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setCooldownEmail(normalizedRequestedEmail)
          setCooldown(retryAfter)
        }
      }
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (submitting) return
    setMessage('')
    setError('')

    if (mode !== 'login') {
      if (!validPassword(password)) {
        setError('密码长度需为 8-72 字节，且不能包含控制字符。')
        return
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致。')
        return
      }
      if (code.length !== 6) {
        setError('请输入 6 位邮箱验证码。')
        return
      }
    }
    if (mode === 'register' && !USERNAME_PATTERN.test(username.trim())) {
      setError('用户名需为 2-30 位文字、字母、数字、下划线或短横线。')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(identifier, password)
      } else if (mode === 'register') {
        await register({ email, code, username, password })
      } else {
        await resetPassword({ email, code, password })
        setIdentifier(email.trim())
        setPassword('')
        setConfirmPassword('')
        setCode('')
        setMode('login')
        setMessage('密码已设置，请使用新密码登录。')
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const activeCooldown = cooldownEmail === email.trim().toLowerCase() ? cooldown : 0
  const title = isLogin ? '用户登录' : isRegister ? '创建账号' : '重设密码'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-24 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-950 dark:text-gray-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回网站
        </Link>

        <section className="rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-indigo-500/10 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/90 sm:p-8">
          <div className="mb-6 grid grid-cols-3 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist" aria-label="账号操作">
            <ModeButton active={isLogin} disabled={sending} icon={LogIn} label="登录" onClick={() => changeMode('login')} />
            <ModeButton active={isRegister} disabled={sending} icon={UserPlus} label="注册" onClick={() => changeMode('register')} />
            <ModeButton active={mode === 'reset'} disabled={sending} icon={KeyRound} label="重设密码" onClick={() => changeMode('reset')} />
          </div>

          <div className="mb-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              {isLogin ? <LogIn className="h-5 w-5" /> : isRegister ? <UserPlus className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {isLogin ? '使用用户名或邮箱和密码登录。' : isRegister ? '验证邮箱并设置用户名和密码。' : '验证注册邮箱后设置新密码。'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isLogin ? (
              <TextField
                label="用户名或邮箱"
                value={identifier}
                onChange={setIdentifier}
                icon={UserRound}
                autoComplete="username"
                maxLength={254}
                placeholder="用户名或 name@example.com"
              />
            ) : (
              <>
                <TextField
                  label="邮箱地址"
                  value={email}
                  onChange={setEmail}
                  icon={Mail}
                  type="email"
                  disabled={sending}
                  autoComplete="email"
                  maxLength={254}
                  placeholder="name@example.com"
                />
                {isRegister && (
                  <TextField
                    label="用户名"
                    value={username}
                    onChange={setUsername}
                    icon={UserRound}
                    autoComplete="username"
                    maxLength={30}
                    placeholder="2-30 位唯一用户名"
                  />
                )}
                <CodeField
                  code={code}
                  setCode={setCode}
                  email={email}
                  sending={sending}
                  cooldown={activeCooldown}
                  onRequest={handleRequestCode}
                />
              </>
            )}

            <PasswordField
              label={isLogin ? '密码' : '设置密码'}
              value={password}
              onChange={setPassword}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && (
              <PasswordField
                label="确认密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            )}

            {message && (
              <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {message}
              </div>
            )}
            {error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

            <button
              type="submit"
              disabled={submitting || (isLogin ? !identifier.trim() || !password : !email.trim() || !password || !confirmPassword || code.length !== 6 || (isRegister && !username.trim()))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? '正在提交...' : isLogin ? '登录' : isRegister ? '完成注册' : '设置新密码'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

function ModeButton({ active, disabled, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-200' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

function TextField({ label, value, onChange, icon: Icon, type = 'text', ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          {...props}
          type={type}
          required
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>
    </label>
  )
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type={visible ? 'text' : 'password'}
          required
          minLength={8}
          maxLength={72}
          autoComplete={autoComplete}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-11 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          title={visible ? '隐藏密码' : '显示密码'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}

function CodeField({ code, setCode, email, sending, cooldown, onRequest }) {
  return (
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
          onClick={onRequest}
          disabled={!email.trim() || sending || cooldown > 0}
          aria-label={sending ? '正在发送验证码' : cooldown > 0 ? `${cooldown} 秒后可重新发送验证码` : '获取验证码'}
          className="inline-flex min-w-28 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
        >
          {sending ? <Loader className="h-4 w-4 animate-spin" /> : cooldown > 0 ? `${cooldown} 秒` : '获取验证码'}
        </button>
      </div>
    </label>
  )
}
