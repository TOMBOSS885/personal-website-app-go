import { useEffect, useState } from 'react'
import { Mail, Save, Send, ShieldCheck } from 'lucide-react'
import LoadingIndicator from '../../components/LoadingIndicator'

const defaults = {
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 465,
  smtpUsername: '',
  smtpPasswordConfigured: false,
  smtpFromEmail: '',
  smtpFromName: '',
  smtpSecurity: 'ssl',
  registrationEmailVerificationEnabled: false,
  lastTestAt: null,
  lastTestSuccess: null,
}

export default function MailServiceManager() {
  const [settings, setSettings] = useState(defaults)
  const [password, setPassword] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/mail-settings', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || '加载邮件配置失败')
        setSettings({ ...defaults, ...data })
      })
      .catch(error => setMessage(error.message || '加载邮件配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const update = (key, value) => setSettings(current => ({ ...current, [key]: value }))

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload = { ...settings, smtpPassword: password }
      const response = await fetch('/api/admin/mail-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '保存失败')
      setSettings({ ...defaults, ...data })
      setPassword('')
      setMessage('邮件配置已保存')
    } catch (error) {
      setMessage(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async event => {
    event.preventDefault()
    setTesting(true)
    setTestMessage('')
    try {
      const response = await fetch('/api/admin/mail-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: testEmail.trim() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '测试邮件发送失败')
      setTestMessage(data.message || '测试邮件发送成功')
      setSettings(current => ({ ...current, lastTestAt: new Date().toISOString(), lastTestSuccess: true }))
    } catch (error) {
      setTestMessage(error.message || '测试邮件发送失败')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-500"><LoadingIndicator size={20} className="mr-2" />加载中...</div>

  return (
    <div className="max-w-4xl space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><Mail className="h-7 w-7 text-indigo-600" />邮件服务</h1><p className="mt-1 text-sm text-gray-500 dark:text-slate-400">配置 SMTP 后可发送注册邮箱验证码和测试邮件。</p></div>
      <form onSubmit={save} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-gray-900 dark:text-slate-100">SMTP 服务配置</h2><p className="mt-1 text-xs text-gray-500">密码仅在服务端加密保存，不会返回或显示。</p></div><label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300"><input type="checkbox" checked={Boolean(settings.smtpEnabled)} onChange={event => { const enabled = event.target.checked; update('smtpEnabled', enabled); if (!enabled) update('registrationEmailVerificationEnabled', false) }} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />启用 SMTP</label></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="SMTP 服务器"><input value={settings.smtpHost} onChange={event => update('smtpHost', event.target.value)} placeholder="smtp.qq.com" className={inputClass} /></Field>
          <Field label="端口"><input type="number" min="1" max="65535" value={settings.smtpPort} onChange={event => update('smtpPort', Number(event.target.value))} className={inputClass} /></Field>
          <Field label="用户名"><input type="email" value={settings.smtpUsername} onChange={event => update('smtpUsername', event.target.value)} className={inputClass} /></Field>
          <Field label="密码或授权码"><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={settings.smtpPasswordConfigured ? '已配置，如需更换请重新输入' : '请输入授权码'} autoComplete="new-password" className={inputClass} /></Field>
          <Field label="发件邮箱"><input type="email" value={settings.smtpFromEmail} onChange={event => update('smtpFromEmail', event.target.value)} className={inputClass} /></Field>
          <Field label="发件人名称"><input value={settings.smtpFromName} onChange={event => update('smtpFromName', event.target.value)} placeholder="本站" className={inputClass} /></Field>
          <Field label="安全连接"><select value={settings.smtpSecurity} onChange={event => update('smtpSecurity', event.target.value)} className={inputClass}><option value="ssl">SSL/TLS（通常 465）</option><option value="starttls">STARTTLS（通常 587）</option><option value="none">无加密</option></select></Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-slate-800"><label className={`inline-flex items-center gap-2 text-sm font-medium ${settings.smtpEnabled ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400'}`}><input type="checkbox" checked={Boolean(settings.registrationEmailVerificationEnabled)} disabled={!settings.smtpEnabled} onChange={event => update('registrationEmailVerificationEnabled', event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />新账号注册邮箱验证码验证</label><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <LoadingIndicator size={16} /> : <Save className="h-4 w-4" />}{saving ? '保存中...' : '保存设置'}</button></div>
        {message && <p role="status" className="mt-4 text-sm text-gray-600 dark:text-slate-300">{message}</p>}
      </form>
      <form onSubmit={sendTest} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><Send className="h-5 w-5 text-indigo-600" /><h2 className="font-semibold text-gray-900 dark:text-slate-100">发送测试邮件</h2></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="email" required value={testEmail} onChange={event => setTestEmail(event.target.value)} placeholder="test@example.com" className={`${inputClass} flex-1`} /><button type="submit" disabled={testing || !settings.smtpEnabled} className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 px-4 py-2.5 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{testing ? <LoadingIndicator size={16} /> : <Send className="h-4 w-4" />}{testing ? '发送中...' : '发送测试邮件'}</button></div>{testMessage && <p role="status" className="mt-3 text-sm text-gray-600 dark:text-slate-300">{testMessage}</p>}{settings.lastTestAt && <p className="mt-2 text-xs text-gray-400">最近测试：{settings.lastTestSuccess ? '成功' : '失败'}，{new Date(settings.lastTestAt).toLocaleString()}</p>}</form>
      <div className="flex gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>注册邮箱验证只影响新账号注册，不影响现有账号登录或第三方登录。关闭后注册流程恢复原样。</p></div>
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
function Field({ label, children }) { return <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{label}{children}</label> }
