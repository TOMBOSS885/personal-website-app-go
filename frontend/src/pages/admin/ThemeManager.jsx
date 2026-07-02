import { useEffect, useState } from 'react'
import { Check, Eye, Image as ImageIcon, Loader, Palette, RefreshCw, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { getThemeBackground, useTheme } from '../../context/ThemeContext'
import OptimizedImage from '../../components/OptimizedImage'

const API_BASE = ''

export default function ThemeManager() {
  const {
    currentTheme,
    customTheme,
    presetThemes,
    setTheme,
    setCustomTheme,
    getActiveTheme,
  } = useTheme()

  const token = localStorage.getItem('token')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false)
  const [backgroundImages, setBackgroundImages] = useState([])
  const [previewTheme, setPreviewTheme] = useState(null)

  const activeTheme = previewTheme || getActiveTheme()

  const fetchBackgroundImages = async () => {
    setLoadingBackgrounds(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/theme/background-images`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = res.ok ? await res.json() : []
      setBackgroundImages(Array.isArray(data) ? data : [])
    } catch {
      setBackgroundImages([])
    } finally {
      setLoadingBackgrounds(false)
    }
  }

  useEffect(() => {
    if (activeTheme.backgroundStyle === 'image') {
      fetchBackgroundImages()
    }
  }, [activeTheme.backgroundStyle])

  const updateCustomTheme = (patch) => {
    const nextTheme = {
      ...getActiveTheme(),
      ...patch,
    }
    setCustomTheme(nextTheme)
    setPreviewTheme(nextTheme)
  }

  const handlePresetSelect = (key) => {
    setTheme(key)
    setPreviewTheme(null)
  }

  const handleColorChange = (key, color) => {
    updateCustomTheme({ [key]: color })
  }

  const handleBackgroundStyleChange = (style) => {
    const nextBackground = style === 'solid'
      ? activeTheme.primary
      : activeTheme.background

    updateCustomTheme({
      backgroundStyle: style,
      background: nextBackground,
    })
  }

  const handleBackgroundImageUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/admin/theme/background-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error || '上传失败')
      }

      const data = await res.json()
      setBackgroundImages(current => [data, ...current.filter(image => image.url !== data.url)])
      updateCustomTheme({
        backgroundStyle: 'image',
        backgroundImage: data.url,
      })
    } catch (err) {
      console.error('上传背景图片失败:', err)
      alert(`上传背景图片失败: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBackgroundImage = async (image, event) => {
    event.stopPropagation()
    if (!confirm(`确定删除背景图片 ${image.name} 吗？`)) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/theme/background-image/${encodeURIComponent(image.name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const error = await res.text()
        throw new Error(error || '删除失败')
      }

      setBackgroundImages(current => current.filter(item => item.url !== image.url))
      if (activeTheme.backgroundImage === image.url) {
        updateCustomTheme({ backgroundImage: '', backgroundStyle: 'image' })
      }
    } catch (err) {
      alert(`删除背景图片失败: ${err.message}`)
    }
  }

  const handleSaveToBackend = async () => {
    setSaving(true)
    try {
      const themeData = customTheme ? { custom: customTheme } : { preset: currentTheme }
      const res = await fetch(`${API_BASE}/api/admin/theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(themeData),
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error || '保存失败')
      }

      alert('主题配置已保存到服务器')
    } catch (err) {
      console.error('保存主题失败:', err)
      alert(`保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setTheme('purple-pink')
    setPreviewTheme(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="w-7 h-7" style={{ color: 'var(--theme-primary)' }} />
            主题管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">自定义网站颜色、背景和视觉样式</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
          <button
            onClick={handleSaveToBackend}
            disabled={saving}
            className="px-4 py-2 text-white rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">预设主题</h2>
            <div className="space-y-3">
              {Object.entries(presetThemes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => handlePresetSelect(key)}
                  className={`w-full p-3 rounded-xl border-2 transition-all ${
                    currentTheme === key && !customTheme
                      ? 'bg-opacity-10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={currentTheme === key && !customTheme ? {
                    borderColor: 'var(--theme-primary)',
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, white)',
                  } : {}}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
                      />
                      <span className="font-medium text-gray-900">{theme.name}</span>
                    </div>
                    {currentTheme === key && !customTheme && (
                      <Check className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">颜色自定义</h2>
            <div className="space-y-4">
              <ColorField label="主色调" value={activeTheme.primary} onChange={(value) => handleColorChange('primary', value)} />
              <ColorField label="次要色" value={activeTheme.secondary} onChange={(value) => handleColorChange('secondary', value)} />
              <ColorField label="强调色" value={activeTheme.accent} onChange={(value) => handleColorChange('accent', value)} />

              {activeTheme.backgroundStyle === 'solid' && (
                <ColorField label="背景颜色" value={activeTheme.background} onChange={(value) => handleColorChange('background', value)} />
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">实时预览</h2>
              <Eye className="w-5 h-5 text-gray-400" />
            </div>

            <div
              className="rounded-xl p-4 min-h-[300px] relative overflow-hidden"
              style={{
                background: getThemeBackground(activeTheme),
                color: activeTheme.textPrimary,
              }}
            >
              <div className="absolute inset-0 bg-white/55" />
              <div className="relative z-10">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})` }}
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">网站标题</h3>
                <p className="text-sm text-gray-600 mb-4">这里会显示当前主题和背景的实际效果。</p>
                <div className="flex gap-2 mb-4">
                  <button
                    className="px-4 py-2 rounded-lg text-white font-medium"
                    style={{ background: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})` }}
                  >
                    主要按钮
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg border bg-white/70 font-medium"
                    style={{ borderColor: activeTheme.primary, color: activeTheme.primary }}
                  >
                    次要按钮
                  </button>
                </div>
                <div className="rounded-lg p-3 bg-white/70 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeTheme.accent }} />
                    <span className="text-sm text-gray-700">状态指示器</span>
                  </div>
                </div>
              </div>
            </div>

            {customTheme && (
              <div className="mt-3 p-2 rounded-lg bg-purple-50 text-purple-700">
                <p className="text-xs">当前使用自定义主题</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">附加设置</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">背景样式</label>
            <select
              value={activeTheme.backgroundStyle}
              onChange={(event) => handleBackgroundStyleChange(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="gradient">渐变背景</option>
              <option value="solid">纯色背景</option>
              <option value="image">图片背景</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">圆角大小</label>
            <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
              <option value="small">小圆角 (8px)</option>
              <option value="medium">中圆角 (12px)</option>
              <option value="large">大圆角 (16px)</option>
            </select>
          </div>
        </div>

        {activeTheme.backgroundStyle === 'image' && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">背景图片</label>
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 px-4 py-2.5 rounded-xl text-white transition-all disabled:opacity-50" style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}>
                {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? '上传中...' : '上传图片'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              <input
                type="text"
                value={activeTheme.backgroundImage || ''}
                onChange={(event) => updateCustomTheme({ backgroundImage: event.target.value, backgroundStyle: 'image' })}
                placeholder="/uploads/theme-backgrounds/example.jpg 或 https://example.com/image.jpg"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">已上传背景</h3>
                <button
                  type="button"
                  onClick={fetchBackgroundImages}
                  disabled={loadingBackgrounds}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingBackgrounds ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              {loadingBackgrounds ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  加载背景图库...
                </div>
              ) : backgroundImages.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                  暂无已上传背景
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {backgroundImages.map(image => {
                    const selected = activeTheme.backgroundImage === image.url
                    return (
                      <button
                        key={image.url}
                        type="button"
                        onClick={() => updateCustomTheme({ backgroundImage: image.url, backgroundStyle: 'image' })}
                        className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                          selected ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100 hover:border-purple-200'
                        }`}
                        title={image.name}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => handleDeleteBackgroundImage(image, event)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              handleDeleteBackgroundImage(image, event)
                            }
                          }}
                          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 shadow transition-opacity hover:bg-red-50 group-hover:opacity-100"
                          title="删除背景"
                          aria-label={`删除背景 ${image.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </span>
                        <div className="aspect-video bg-gray-50">
                          <OptimizedImage src={image.url} alt={image.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" wrapperClassName="block h-full w-full" />
                        </div>
                        <div className="truncate px-2 py-1.5 text-xs text-gray-500">{image.name}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {activeTheme.backgroundImage ? (
              <div className="mt-4 h-40 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                <OptimizedImage src={activeTheme.backgroundImage} alt="背景预览" className="w-full h-full object-cover" wrapperClassName="block w-full h-full" />
              </div>
            ) : (
              <div className="mt-4 h-32 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 gap-2">
                <ImageIcon className="w-5 h-5" />
                选择或上传一张背景图片
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
        />
      </div>
    </div>
  )
}
