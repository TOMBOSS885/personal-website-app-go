import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, ExternalLink, Link2, Loader2, Save } from 'lucide-react'
import { safeDownloadHref } from '../../utils/safeUrl'

const API_BASE = ''
const EMPTY_SETTINGS = {
  enabled: false,
  downloadUrl: '',
  version: '',
}

export default function ClientDownloadManager() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const token = sessionStorage.getItem('token')
  const previewHref = useMemo(() => safeDownloadHref(settings.downloadUrl), [settings.downloadUrl])

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_BASE}/api/admin/client-download`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || '加载客户端配置失败')
        return res.json()
      })
      .then(data => {
        setSettings({
          enabled: Boolean(data.enabled),
          downloadUrl: data.downloadUrl || '',
          version: data.version || '',
        })
      })
      .catch(error => {
        if (error.name !== 'AbortError') setMessage({ type: 'error', text: error.message })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [token])

  const handleSubmit = async event => {
    event.preventDefault()
    setMessage(null)

    if (settings.enabled && !previewHref) {
      setMessage({ type: 'error', text: '请输入有效的 HTTP 或 HTTPS 下载地址' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/client-download`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || '保存客户端配置失败')

      setSettings({
        enabled: Boolean(data.enabled),
        downloadUrl: data.downloadUrl || '',
        version: data.version || '',
      })
      setMessage({ type: 'success', text: '客户端配置已保存' })
      window.dispatchEvent(new CustomEvent('client-download:updated'))
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 flex items-start gap-3 sm:items-center">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
          style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
        >
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">客户端发布</h1>
          <p className="mt-1 text-sm text-gray-500">管理网站导航中的客户端下载入口</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>加载中...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="font-semibold text-gray-900">下载入口</h2>
                <p className="mt-1 text-sm text-gray-500">关闭后，前台不会显示下载按钮</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3 self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))}
                  className="peer sr-only"
                />
                <span className="relative h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2" />
                <span className="text-sm font-medium text-gray-700">{settings.enabled ? '已启用' : '已关闭'}</span>
              </label>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Link2 className="h-4 w-4" />
                  下载地址
                </span>
                <input
                  type="url"
                  value={settings.downloadUrl}
                  onChange={event => setSettings(current => ({ ...current, downloadUrl: event.target.value }))}
                  required={settings.enabled}
                  maxLength={2048}
                  placeholder="https://example.com/releases/client.exe"
                  className="admin-input"
                  autoComplete="url"
                />
              </label>

              <label className="block sm:max-w-xs">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">版本号</span>
                <input
                  type="text"
                  value={settings.version}
                  onChange={event => setSettings(current => ({ ...current, version: event.target.value }))}
                  maxLength={100}
                  placeholder="例如：v1.0.0"
                  className="admin-input"
                />
              </label>

              {settings.downloadUrl && (
                <div className="flex min-w-0 flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-gray-400">当前目标</p>
                    <p className="mt-1 truncate text-sm text-gray-600" title={settings.downloadUrl}>{settings.downloadUrl}</p>
                  </div>
                  {previewHref && (
                    <a
                      href={previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      测试链接
                    </a>
                  )}
                </div>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div aria-live="polite" className="min-h-5 text-sm">
                {message?.type === 'success' && (
                  <span className="inline-flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {message.text}
                  </span>
                )}
                {message?.type === 'error' && <span className="text-red-600">{message.text}</span>}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? '保存中...' : '保存配置'}
              </button>
            </footer>
          </>
        )}
      </form>
    </div>
  )
}
