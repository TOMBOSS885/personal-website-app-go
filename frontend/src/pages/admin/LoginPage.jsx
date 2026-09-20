import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Moon, ShieldCheck, Smartphone, Sun, User, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import LoadingIndicator from '../../components/LoadingIndicator'
import TotpCodeInput from '../../components/TotpCodeInput'
import { getAdminBasePath } from '../../utils/adminEntry'
import { isTwoFactorRestartRequired, twoFactorMessage } from '../../utils/twoFactor'

export default function LoginPage() {
  const navigate = useNavigate()
  const { colorMode, toggleColorMode } = useTheme()
  const { admin, loading: sessionLoading, login, verifyTwoFactor, cancelPendingLogin } = useAdminAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginStep, setLoginStep] = useState('password')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [pendingUsername, setPendingUsername] = useState('')
  const adminBasePath = getAdminBasePath()

  useEffect(() => {
    if (!sessionLoading && admin) navigate(adminBasePath, { replace: true })
  }, [admin, adminBasePath, navigate, sessionLoading])

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(username.trim(), password)
      if (result.requiresTwoFactor) {
        setPendingUsername(result.username || username.trim())
        setPassword('')
        setTwoFactorCode('')
        setLoginStep('two-factor')
      } else {
        navigate(adminBasePath, { replace: true })
      }
    } catch (requestError) {
      setError(twoFactorMessage(requestError, requestError instanceof Error ? requestError.message : '登录失败，请稍后重试'))
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFactorSubmit = async event => {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setError('请输入身份验证器显示的 6 位动态验证码')
      return
    }

    setLoading(true)
    try {
      await verifyTwoFactor(twoFactorCode)
      navigate(adminBasePath, { replace: true })
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.code : ''
      setTwoFactorCode('')
      setError(twoFactorMessage(requestError, requestError instanceof Error ? requestError.message : '验证失败，请稍后重试'))
      if (isTwoFactorRestartRequired(code)) {
        setLoginStep('password')
        setPendingUsername('')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancelTwoFactor = async () => {
    setLoading(true)
    try {
      await cancelPendingLogin()
    } finally {
      setLoginStep('password')
      setTwoFactorCode('')
      setPendingUsername('')
      setError('')
      setLoading(false)
    }
  }

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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-indigo-600 shadow-lg">
            {loginStep === 'two-factor' ? <ShieldCheck className="h-8 w-8 text-white" /> : <Lock className="h-8 w-8 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{loginStep === 'two-factor' ? '二步验证' : '管理后台'}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {loginStep === 'two-factor' ? '完成身份验证后进入后台' : '使用唯一管理员账号登录'}
          </p>
        </div>

        <form onSubmit={loginStep === 'two-factor' ? handleTwoFactorSubmit : handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">
          {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

          {loginStep === 'password' ? <>
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">用户名</span>
              <span className="relative block">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input value={username} onChange={event => setUsername(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" autoComplete="username" required disabled={loading} />
              </span>
            </label>

            <label className="mb-6 block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">密码</span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" autoComplete="current-password" required disabled={loading} />
              </span>
            </label>

            <button type="submit" disabled={loading || sessionLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {loading && <LoadingIndicator size={20} />}
              {loading ? '登录中...' : '登录'}
            </button>
          </> : <>
            <div className="mb-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
              <span>请输入身份验证器 APP 为 <strong className="font-semibold text-slate-800 dark:text-white">{pendingUsername || '管理员'}</strong> 生成的 6 位验证码。</span>
            </div>
            <TotpCodeInput value={twoFactorCode} onChange={setTwoFactorCode} disabled={loading} autoFocus idPrefix="admin-login-totp" />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleCancelTwoFactor} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />取消
              </button>
              <button type="submit" disabled={loading || twoFactorCode.length !== 6} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {loading && <LoadingIndicator size={18} />}
                {loading ? '验证中...' : '验证并进入后台'}
              </button>
            </div>
          </>}
        </form>

        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-600">PHP Session + MySQL</p>
      </div>
    </main>
  )
}
