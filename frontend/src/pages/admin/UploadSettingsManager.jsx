import { useEffect, useState } from 'react'
import { Loader, RotateCcw, Save, UploadCloud } from 'lucide-react'

const API_BASE = ''

const DEFAULT_SETTINGS = {
  articleImageMaxMB: 10,
  articleSiteZipMaxMB: 30,
  articleSiteTotalMB: 100,
  articleSiteFileCount: 1000,
  themeBackgroundMaxMB: 10,
  avatarImageMaxMB: 5,
  musicFileMaxMB: 50,
  lyricsFileMaxMB: 1,
  musicBatchMaxCount: 50,
  live2dTotalMaxMB: 200,
  live2dFileMaxCount: 300,
  imageMaxDimension: 8192,
  imageMaxPixels: 40000000,
  avatarMaxDimension: 4096,
  avatarMaxPixels: 16000000,
  avatarMinDimension: 64,
}

const FIELD_GROUPS = [
  {
    title: '静态前端包',
    desc: '控制文章静态 HTML/CSS/JS ZIP 的上传和解压限制。',
    fields: [
      { key: 'articleSiteZipMaxMB', label: 'ZIP 最大大小', unit: 'MB', min: 1, max: 200, hint: '上传压缩包的大小上限。' },
      { key: 'articleSiteTotalMB', label: '解压总大小', unit: 'MB', min: 1, max: 1000, hint: '防止 ZIP 解压后异常膨胀。' },
      { key: 'articleSiteFileCount', label: '解压文件数量', unit: '个', min: 1, max: 5000, hint: 'ZIP 解压后最多允许包含的文件数。' },
    ],
  },
  {
    title: '文件大小',
    desc: '控制不同上传入口允许的单文件或总包大小。',
    fields: [
      { key: 'articleImageMaxMB', label: '文章图片最大大小', unit: 'MB', min: 1, max: 100, hint: '文章封面和文章内图片上传。' },
      { key: 'themeBackgroundMaxMB', label: '背景图片最大大小', unit: 'MB', min: 1, max: 100, hint: '主题背景图上传。' },
      { key: 'avatarImageMaxMB', label: '头像最大大小', unit: 'MB', min: 1, max: 50, hint: '后台个人信息头像上传。' },
      { key: 'musicFileMaxMB', label: '音乐单文件最大大小', unit: 'MB', min: 1, max: 500, hint: '每首音乐文件的大小上限。' },
      { key: 'lyricsFileMaxMB', label: '歌词文件最大大小', unit: 'MB', min: 1, max: 10, hint: '每首音乐关联的 .lrc 歌词文件大小上限。' },
      { key: 'live2dTotalMaxMB', label: 'Live2D 单次总大小', unit: 'MB', min: 1, max: 1000, hint: '一次上传整个 Live2D 模型文件夹的总大小。' },
    ],
  },
  {
    title: '批量数量',
    desc: '控制一次上传中允许携带的文件数量。',
    fields: [
      { key: 'musicBatchMaxCount', label: '音乐批量上传数量', unit: '个', min: 1, max: 200, hint: '一次最多选择多少首音乐。' },
      { key: 'live2dFileMaxCount', label: 'Live2D 文件数量', unit: '个', min: 1, max: 2000, hint: '一次 Live2D 文件夹上传最多包含多少个文件。' },
    ],
  },
  {
    title: '图片尺寸',
    desc: '用于防止超高分辨率图片拖慢解码或占用过多内存。',
    fields: [
      { key: 'imageMaxDimension', label: '普通图片最大边长', unit: 'px', min: 512, max: 20000, hint: '文章图片、背景图片的宽或高上限。' },
      { key: 'imageMaxPixels', label: '普通图片最大像素数', unit: 'px', min: 1000000, max: 200000000, step: 1000000, hint: '宽 x 高的总像素上限。' },
      { key: 'avatarMinDimension', label: '头像最小边长', unit: 'px', min: 32, max: 12000, hint: '头像宽和高都不能小于该值。' },
      { key: 'avatarMaxDimension', label: '头像最大边长', unit: 'px', min: 128, max: 12000, hint: '头像宽或高不能超过该值。' },
      { key: 'avatarMaxPixels', label: '头像最大像素数', unit: 'px', min: 500000, max: 80000000, step: 500000, hint: '头像宽 x 高的总像素上限。' },
    ],
  },
]

const FIXED_RULES = [
  { label: '静态前端入口', value: 'ZIP 中必须包含 index.html，支持单一 dist/build 外层目录' },
  { label: '文章图片格式', value: 'jpg, jpeg, png, gif, webp' },
  { label: '背景图片格式', value: 'jpg, jpeg, png, gif, webp, avif' },
  { label: '头像格式', value: 'jpg, jpeg, png, webp' },
  { label: '音乐格式', value: 'mp3, wav, ogg, m4a, aac, flac' },
  { label: 'Live2D 入口文件', value: '必须包含 model.json 或 .model3.json' },
  { label: 'Live2D 禁止类型', value: 'html, js, css, svg, php, exe, bat, sh 等脚本或可执行文件' },
]

function normalizeSettings(data) {
  return { ...DEFAULT_SETTINGS, ...(data || {}) }
}

export default function UploadSettingsManager() {
  const token = localStorage.getItem('token')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/upload-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || '获取上传限制失败')
        return
      }
      setSettings(normalizeSettings(data))
    } catch (err) {
      console.error('Fetch upload settings failed:', err)
      setError('获取上传限制失败')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (key, value) => {
    setSettings(current => ({
      ...current,
      [key]: Number(value),
    }))
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/upload-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || '保存上传限制失败')
        return
      }
      setSettings(normalizeSettings(data))
      setMessage('上传限制已保存，下一次上传会立即生效。')
    } catch (err) {
      console.error('Save upload settings failed:', err)
      setError('保存上传限制失败')
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS)
    setMessage('')
    setError('')
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <UploadCloud className="h-7 w-7" style={{ color: 'var(--theme-primary)' }} />
            上传限制
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            调整图片、音乐和 Live2D 的上传大小、数量和图片尺寸限制。
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          恢复默认值
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        当前后端还有一个全局 multipart 内存阈值：256MB。它是服务启动时的解析内存阈值，不是单文件限制；后台这里修改的是业务上传限制，保存后无需重启。
      </div>

      <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">固定安全规则</h2>
        <p className="mt-1 text-sm text-gray-500">
          文件格式和危险文件拦截属于安全白名单，不建议在后台开放任意修改。
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {FIXED_RULES.map(rule => (
            <div key={rule.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="text-sm font-semibold text-gray-800">{rule.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-gray-500">{rule.value}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-gray-500 shadow-sm">
          <Loader className="mx-auto mb-3 h-6 w-6 animate-spin" style={{ color: 'var(--theme-primary)' }} />
          正在加载上传限制...
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-5">
          {FIELD_GROUPS.map(group => (
            <section key={group.title} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{group.desc}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.fields.map(field => (
                  <label key={field.key} className="block rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-800">{field.label}</span>
                      <span className="text-xs text-gray-400">{field.unit}</span>
                    </div>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step || 1}
                      value={settings[field.key] ?? ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      className="admin-input"
                      required
                    />
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">
                      {field.hint} 范围：{field.min.toLocaleString()} - {field.max.toLocaleString()} {field.unit}
                    </p>
                  </label>
                ))}
              </div>
            </section>
          ))}

          <div className="sticky bottom-4 z-10 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
            >
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? '保存中...' : '保存上传限制'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
