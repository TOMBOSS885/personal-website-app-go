import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const API_BASE = ''

export default function AccountSettings() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (form.newPassword.length < 8) {
      setError('新密码至少需要 8 位')
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      sessionStorage.removeItem('token')
      localStorage.removeItem('username')
      window.setTimeout(() => navigate('/admin/login'), 1200)
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
              minLength={8}
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
              minLength={8}
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
