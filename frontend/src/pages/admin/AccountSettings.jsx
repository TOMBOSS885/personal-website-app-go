import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, ShieldCheck, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { getAdminBasePath, getAdminLoginPathFromSuffix } from '../../utils/adminEntry'
import { apiFailureError, formatTotpSecret } from '../../utils/twoFactor'
import LoadingIndicator from '../../components/LoadingIndicator'
import TotpCodeInput from '../../components/TotpCodeInput'

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
  const [totpLoading, setTotpLoading] = useState(true)
  const [totpBusy, setTotpBusy] = useState(false)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpSetup, setTotpSetup] = useState(null)
  const [totpSetupPassword, setTotpSetupPassword] = useState('')
  const [totpSetupCode, setTotpSetupCode] = useState('')
  const [totpDisableCode, setTotpDisableCode] = useState('')
  const [totpQrCode, setTotpQrCode] = useState('')
  const [totpMessage, setTotpMessage] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpSecretCopied, setTotpSecretCopied] = useState(false)
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

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/admin/two-factor/status`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw apiFailureError(data, '读取二步验证状态失败')
        if (active) setTotpEnabled(Boolean(data.enabled ?? data.twoFactorEnabled))
      })
      .catch(requestError => {
        if (active) setTotpError(requestError instanceof Error ? requestError.message : '读取二步验证状态失败')
      })
      .finally(() => {
        if (active) setTotpLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleTotpSetup = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpError('')
    if (!totpSetupPassword) {
      setTotpError('请输入当前管理员密码后再开始绑定')
      return
    }
    setTotpBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/two-factor/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: totpSetupPassword }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw apiFailureError(data, '生成二步验证密钥失败')
      if (!data.otpauthUri || !data.secret) throw new Error('服务器返回的二步验证信息不完整')
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUri, { width: 256, margin: 2, errorCorrectionLevel: 'M' })
      setTotpSetup({ secret: data.secret, otpauthUri: data.otpauthUri })
      setTotpQrCode(qrDataUrl)
      setTotpSetupPassword('')
      setTotpSetupCode('')
      setTotpSecretCopied(false)
    } catch (requestError) {
      setTotpError(requestError instanceof Error ? requestError.message : '生成二步验证密钥失败')
    } finally {
      setTotpBusy(false)
    }
  }

  const handleTotpConfirm = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpError('')
    if (!/^\d{6}$/.test(totpSetupCode)) {
      setTotpError('请输入身份验证器当前显示的 6 位验证码')
      return
    }
    setTotpBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/two-factor/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpSetupCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw apiFailureError(data, '二步验证绑定失败')
      setTotpEnabled(true)
      setTotpSetup(null)
      setTotpQrCode('')
      setTotpSetupCode('')
      setTotpSecretCopied(false)
      setTotpMessage(data.message || '二步验证已开启，今后进入后台需要输入动态验证码。')
    } catch (requestError) {
      if (requestError?.code === 'TWO_FACTOR_SETUP_EXPIRED') {
        setTotpSetup(null)
        setTotpQrCode('')
        setTotpSetupCode('')
      }
      setTotpError(requestError instanceof Error ? requestError.message : '二步验证绑定失败')
    } finally {
      setTotpBusy(false)
    }
  }

  const handleTotpDisable = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpError('')
    if (!/^\d{6}$/.test(totpDisableCode)) {
      setTotpError('请输入身份验证器当前显示的 6 位验证码')
      return
    }
    setTotpBusy(true)
    try {
      const response = await fetch(`${API_BASE}/api/admin/two-factor/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpDisableCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw apiFailureError(data, '关闭二步验证失败')
      setTotpEnabled(false)
      setTotpDisableCode('')
      setTotpMessage(data.message || '二步验证已关闭。')
    } catch (requestError) {
      setTotpError(requestError instanceof Error ? requestError.message : '关闭二步验证失败')
    } finally {
      setTotpBusy(false)
    }
  }

  const cancelTotpSetup = () => {
    setTotpSetup(null)
    setTotpQrCode('')
    setTotpSetupCode('')
    setTotpSetupPassword('')
    setTotpSecretCopied(false)
    setTotpError('')
  }

  const handleTotpToggle = () => {
    if (totpBusy || totpLoading) return
    setTotpMessage('')
    if (totpEnabled) {
      setTotpError('关闭二步验证需要输入身份验证器当前的 6 位验证码')
      window.requestAnimationFrame(() => document.getElementById('totp-disable-1')?.focus())
      return
    }
    if (totpSetup) {
      cancelTotpSetup()
      return
    }
    setTotpError('')
    window.requestAnimationFrame(() => document.getElementById('totp-setup-password')?.focus())
  }

  const copyTotpSecret = async () => {
    const secret = totpSetup?.secret
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setTotpSecretCopied(true)
      window.setTimeout(() => setTotpSecretCopied(false), 2000)
    } catch {
      setTotpError('复制密钥失败，请手动选择后复制')
    }
  }

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
      setEntryMessage('后台地址已更新，请使用新地址重新登录...')
      window.setTimeout(() => window.location.replace(getAdminLoginPathFromSuffix(data.adminPathSuffix)), 700)
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
        <p className="mt-1 text-sm text-gray-500">修改后台登录密码，并选择进入后台时是否需要 2FA 验证。</p>
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
            {entrySaving && <LoadingIndicator size={16} />}
            {entrySaving ? '保存中...' : '更新后台地址'}
          </button>
        </form>
      </div>

      <div className="mb-6 max-w-2xl rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">登录二步验证（2FA）</h2>
              <p className="text-sm text-gray-500">选择进入后台时是否需要身份验证器动态码。</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={totpEnabled || Boolean(totpSetup)}
            aria-label="进入后台时需要 2FA 验证"
            disabled={totpBusy || totpLoading}
            onClick={handleTotpToggle}
            className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${totpEnabled || totpSetup ? 'bg-emerald-500' : 'bg-gray-300'} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${totpEnabled || totpSetup ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {totpError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{totpError}</div>}
        {totpMessage && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{totpMessage}</div>}

        {totpLoading ? <div className="flex items-center gap-2 py-3 text-sm text-gray-500"><LoadingIndicator size={18} />读取状态中...</div> : totpEnabled ? <>
          <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="font-medium">进入后台时需要 2FA 验证</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs">已开启</span>
          </div>
          <form onSubmit={handleTotpDisable} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">关闭前请输入身份验证器当前的 6 位验证码
              <div className="mt-2"><TotpCodeInput value={totpDisableCode} onChange={setTotpDisableCode} disabled={totpBusy} idPrefix="totp-disable" /></div>
            </label>
            <button type="submit" disabled={totpBusy || totpDisableCode.length !== 6} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
              {totpBusy && <LoadingIndicator size={16} />}关闭二步验证
            </button>
          </form>
        </> : totpSetup ? <div className="space-y-5">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-medium">请用手机身份验证器扫描二维码</p>
            <p className="mt-1 text-indigo-700">支持 Google Authenticator、Microsoft Authenticator、1Password 等。无法扫码时请手动输入密钥。</p>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {totpQrCode && <img src={totpQrCode} alt="二步验证绑定二维码" className="h-52 w-52 rounded-lg border border-gray-200 bg-white p-2" />}
            <div className="min-w-0 flex-1 text-sm text-gray-600">
              <p className="mb-1 font-medium text-gray-700">手动密钥</p>
              <code className="block break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs tracking-wider text-gray-800">{formatTotpSecret(totpSetup.secret)}</code>
              <button type="button" onClick={copyTotpSecret} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                {totpSecretCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {totpSecretCopied ? '已复制' : '复制密钥'}
              </button>
              <p className="mt-3 text-xs text-gray-500">绑定完成前请勿关闭此页面。输入当前验证码并确认后才会正式启用。</p>
            </div>
          </div>
          <form onSubmit={handleTotpConfirm} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">输入 APP 显示的 6 位验证码完成绑定
              <div className="mt-2"><TotpCodeInput value={totpSetupCode} onChange={setTotpSetupCode} disabled={totpBusy} autoFocus idPrefix="totp-setup" /></div>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={totpBusy || totpSetupCode.length !== 6} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{totpBusy && <LoadingIndicator size={16} />}确认并开启</button>
              <button type="button" disabled={totpBusy} onClick={cancelTotpSetup} className="h-10 rounded-lg border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">取消绑定</button>
            </div>
          </form>
        </div> : <form onSubmit={handleTotpSetup} className="space-y-4">
          <p className="text-sm leading-6 text-gray-600">打开右侧开关或点击下方按钮后，需要先验证当前管理员密码，再用手机身份验证器扫码绑定。开启后每次进入后台都要输入 6 位动态验证码。</p>
          <label className="block text-sm font-medium text-gray-700">当前管理员密码
            <input id="totp-setup-password" type="password" value={totpSetupPassword} onChange={event => setTotpSetupPassword(event.target.value)} className="admin-input mt-2" autoComplete="current-password" required disabled={totpBusy} />
          </label>
          <button type="submit" disabled={totpBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{totpBusy && <LoadingIndicator size={16} />}开始绑定身份验证器</button>
        </form>}
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
              {saving && <LoadingIndicator size={16} />}
              {saving ? '保存中...' : '保存新密码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
