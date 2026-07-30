import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader, Lock, Moon, Sun, User } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { getAdminBasePath } from '../../utils/adminEntry'

export default function LoginPage() {
  const navigate = useNavigate()
  const { colorMode, toggleColorMode } = useTheme()
  const { admin, loading: sessionLoading, login } = useAdminAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const adminBasePath = getAdminBasePath()

  useEffect(() => {
    if (!sessionLoading && admin) navigate(adminBasePath, { replace: true })
  }, [admin, adminBasePath, navigate, sessionLoading])

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(adminBasePath, { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败，请稍后重试')
    } finally {
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
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">管理后台</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">使用唯一管理员账号登录</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">
          {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

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
            {loading && <Loader className="h-5 w-5 animate-spin" />}
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-600">PHP Session + MySQL</p>
      </div>
    </main>
  )
}
