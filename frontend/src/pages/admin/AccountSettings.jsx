import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Link2, Loader, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { getAdminBasePath } from '../../utils/adminEntry'

const API_BASE = ''

export default function AccountSettings() {
  const navigate = useNavigate()
  const { logout } = useAdminAuth()
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [entryLoading, setEntryLoading] = useState(true)
  const [entrySaving, setEntrySaving] = useState(false)
  const [entryMessage, setEntryMessage] = useState('')
  const [entryError, setEntryError] = useState('')
  const [entryForm, setEntryForm] = useState({ adminPathSuffix: '', currentPassword: '' })
  const adminBasePath = getAdminBasePath()
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/security-settings`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || '读取后台地址失败')
        setEntryForm(current => ({ ...current, adminPathSuffix: data.adminPathSuffix || '' }))
      })
      .catch(requestError => setEntryError(requestError instanceof Error ? requestError.message : '读取后台地址失败'))
      .finally(() => setEntryLoading(false))
  }, [])

  const handleEntrySubmit = async event => {
    event.preventDefault()
    setEntryMessage('')
    setEntryError('')
    const suffix = entryForm.adminPathSuffix.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(suffix)) {
      setEntryError('后缀必须为 8 到 64 位，只能包含字母、数字、连字符和下划线')
      return
    }

    setEntrySaving(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/security-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPathSuffix: suffix, currentPassword: entryForm.currentPassword }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '保存后台地址失败')
      setEntryMessage('后台地址已更新，正在跳转到新地址...')
      window.setTimeout(() => window.location.replace(`/${data.adminPathSuffix}/account`), 700)
    } catch (requestError) {
      setEntryError(requestError instanceof Error ? requestError.message : '保存后台地址失败')
    } finally {
      setEntrySaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (form.newPassword.length < 10) {
      setError('新密码至少需要 10 位')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`${API_BASE}/api/admin/account/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.message || '密码修改失败')
        return
      }

      setMessage(data.message || '密码修改成功，请重新登录')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      await logout()
      window.setTimeout(() => navigate(`${adminBasePath}/login`), 1200)
    } catch (err) {
      console.error('Change password failed:', err)
      setError('密码修改失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const passwordType = showPassword ? 'text' : 'password'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7" style={{ color: 'var(--theme-primary)' }} />
          账号安全
        </h1>
        <p className="mt-1 text-sm text-gray-500">修改后台登录密码，建议不要继续使用默认密码。</p>
      </div>

      <div className="mb-6 max-w-2xl rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">后台安全地址</h2>
            <p className="text-sm text-gray-500">修改后旧地址立即失效，请保存好新地址。</p>
          </div>
        </div>

        {entryError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{entryError}</div>}
        {entryMessage && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{entryMessage}</div>}

        <form onSubmit={handleEntrySubmit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            地址后缀
            <div className="mt-1 flex">
              <span className="rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-gray-500">/</span>
              <input
                value={entryForm.adminPathSuffix}
                onChange={event => setEntryForm(current => ({ ...current, adminPathSuffix: event.target.value }))}
                className="min-w-0 flex-1 rounded-r-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                minLength={8}
                maxLength={64}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]{7,63}"
                autoComplete="off"
                required
                disabled={entryLoading || entrySaving}
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            当前管理员密码
            <input
              type="password"
              value={entryForm.currentPassword}
              onChange={event => setEntryForm(current => ({ ...current, currentPassword: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              autoComplete="current-password"
              required
              disabled={entryLoading || entrySaving}
            />
          </label>

          <button type="submit" disabled={entryLoading || entrySaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {entrySaving && <Loader className="h-4 w-4 animate-spin" />}
            {entrySaving ? '保存中...' : '更新后台地址'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'var(--theme-gradient)' }}
          >
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">修改密码</h2>
            <p className="text-sm text-gray-500">需要先验证当前密码。</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
            <input
              type={passwordType}
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              autoComplete="current-password"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
            <input
              type={passwordType}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              autoComplete="new-password"
              minLength={10}
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
            <input
              type={passwordType}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              autoComplete="new-password"
              minLength={10}
              required
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPassword ? '隐藏密码' : '显示密码'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {saving ? '保存中...' : '保存新密码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
