import { useEffect, useState } from 'react'
import { Loader, Save, UploadCloud } from 'lucide-react'

const defaults = {
  articleImageMaxMB: 5,
  themeBackgroundMaxMB: 5,
  avatarImageMaxMB: 2,
  imageMaxDimension: 8192,
  imageMaxPixels: 40000000,
  avatarMaxDimension: 4096,
  avatarMaxPixels: 16000000,
  avatarMinDimension: 64,
  articleSiteZipMaxMB: 12,
  articleSiteTotalMB: 40,
  articleSiteFileCount: 400,
}
const fields = [
  ['articleImageMaxMB', '文章图片上限', 'MB', 1, 10],
  ['themeBackgroundMaxMB', '主题背景上限', 'MB', 1, 10],
  ['avatarImageMaxMB', '头像上限', 'MB', 1, 5],
  ['imageMaxDimension', '普通图片最大边长', 'px', 512, 12000],
  ['imageMaxPixels', '普通图片最大像素数', 'px', 1000000, 80000000],
  ['avatarMinDimension', '头像最小边长', 'px', 32, 1024],
  ['avatarMaxDimension', '头像最大边长', 'px', 128, 8000],
  ['avatarMaxPixels', '头像最大像素数', 'px', 500000, 40000000],
  ['articleSiteZipMaxMB', '静态前端 ZIP 上限', 'MB', 1, 20],
  ['articleSiteTotalMB', '静态前端解压上限', 'MB', 5, 100],
  ['articleSiteFileCount', '静态前端文件数量', '个', 10, 1000],
]

export default function UploadSettingsManager() {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/upload-settings').then(response => response.json()).then(data => setSettings({ ...defaults, ...data })).finally(() => setLoading(false))
  }, [])

  const submit = async event => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/upload-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '保存失败')
      setSettings({ ...defaults, ...data })
      setMessage('上传限制已保存')
    } catch (error) {
      setMessage(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-500"><Loader className="mr-2 h-5 w-5 animate-spin" />加载中...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><UploadCloud className="h-7 w-7 text-indigo-600" />上传限制</h1><p className="mt-1 text-sm text-gray-500">共享主机空间有限，建议保持保守上限。</p></div>
      <form onSubmit={submit} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(([key, label, unit, min, max]) => <label key={key} className="block text-sm font-medium text-gray-700 dark:text-slate-300">{label}<div className="mt-1 flex"><input type="number" min={min} max={max} value={settings[key]} onChange={event => setSettings(current => ({ ...current, [key]: Number(event.target.value) }))} className="min-w-0 flex-1 rounded-l-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /><span className="rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 dark:border-slate-700 dark:bg-slate-800">{unit}</span></div></label>)}
        </div>
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">图片允许 JPG、PNG、GIF、WebP；静态前端上限还会受到主机 PHP 的 upload_max_filesize、post_max_size 和剩余空间限制。</p>
        <div className="mt-6 flex items-center justify-end gap-4">{message && <span className="text-sm text-gray-600 dark:text-slate-300">{message}</span>}<button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? '保存中...' : '保存设置'}</button></div>
      </form>
    </div>
  )
}
