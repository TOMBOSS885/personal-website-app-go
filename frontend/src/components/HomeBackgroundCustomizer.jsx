import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Image as ImageIcon, Loader, Palette, RefreshCw, Settings2, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import OptimizedImage from './OptimizedImage'

const API_BASE = ''

const STYLE_OPTIONS = [
  { value: 'gradient', label: '渐变' },
  { value: 'solid', label: '纯色' },
  { value: 'image', label: '图片' },
]

const IMAGE_LAYOUT_OPTIONS = [
  { value: 'cover', repeat: 'no-repeat', label: '填充' },
  { value: 'contain', repeat: 'no-repeat', label: '完整' },
  { value: '100% 100%', repeat: 'no-repeat', label: '拉伸' },
  { value: 'auto', repeat: 'no-repeat', label: '原始' },
  { value: 'auto', repeat: 'repeat', label: '平铺' },
]

const IMAGE_POSITION_OPTIONS = [
  { value: 'center', label: '居中' },
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
]

export default function HomeBackgroundCustomizer() {
  const { setCustomTheme, getActiveTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [backgroundImages, setBackgroundImages] = useState([])

  const activeTheme = getActiveTheme()

  const fetchBackgroundImages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/public/theme/background-images`)
      const data = res.ok ? await res.json() : []
      setBackgroundImages(Array.isArray(data) ? data : [])
    } catch {
      setBackgroundImages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && activeTheme.backgroundStyle === 'image' && backgroundImages.length === 0) {
      fetchBackgroundImages()
    }
  }, [open, activeTheme.backgroundStyle])

  const updateTheme = (patch) => {
    const nextTheme = {
      ...activeTheme,
      ...patch,
    }
    setCustomTheme(nextTheme)
  }

  const changeStyle = (style) => {
    if (style === 'gradient') {
      updateTheme({
        backgroundStyle: 'gradient',
        background: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})`,
      })
      return
    }

    if (style === 'solid') {
      updateTheme({
        backgroundStyle: 'solid',
        background: activeTheme.background && !activeTheme.background.includes('gradient')
          ? activeTheme.background
          : activeTheme.primary,
      })
      return
    }

    updateTheme({
      backgroundStyle: 'image',
      backgroundSize: activeTheme.backgroundSize || 'cover',
      backgroundPosition: activeTheme.backgroundPosition || 'center',
      backgroundRepeat: activeTheme.backgroundRepeat || 'no-repeat',
    })
    fetchBackgroundImages()
  }

  return (
    <div className="fixed bottom-24 right-4 z-[60] sm:right-6">
      <motion.button
        type="button"
        onClick={() => setOpen(value => !value)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="group relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-white/80 px-3 text-white shadow-2xl shadow-indigo-500/30 ring-4 ring-white/25 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-indigo-500/45 sm:px-4"
        style={{ background: 'var(--theme-gradient)' }}
        title="背景设置"
      >
        {open ? <X className="h-5 w-5 shrink-0" /> : <Settings2 className="h-5 w-5 shrink-0" />}
        <span className="hidden whitespace-nowrap text-sm font-semibold tracking-normal sm:inline">
          {open ? '关闭' : '背景'}
        </span>
        {!open && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow-lg shadow-emerald-400/50" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="absolute bottom-14 right-0 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Palette className="h-4 w-4" style={{ color: 'var(--theme-primary)' }} />
                背景样式
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
                {STYLE_OPTIONS.map(option => {
                  const selected = activeTheme.backgroundStyle === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeStyle(option.value)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        selected ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              {activeTheme.backgroundStyle === 'solid' && (
                <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">颜色</span>
                  <input
                    type="color"
                    value={activeTheme.background || activeTheme.primary || '#ffffff'}
                    onChange={(event) => updateTheme({ background: event.target.value, backgroundStyle: 'solid' })}
                    className="h-9 w-14 cursor-pointer rounded-lg border border-white bg-transparent"
                  />
                </label>
              )}

              {activeTheme.backgroundStyle === 'image' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-800">布局</div>
                    <div className="grid grid-cols-5 gap-2">
                      {IMAGE_LAYOUT_OPTIONS.map(option => {
                        const selected = activeTheme.backgroundSize === option.value
                          && activeTheme.backgroundRepeat === option.repeat
                        return (
                          <button
                            key={`${option.value}-${option.repeat}`}
                            type="button"
                            onClick={() => updateTheme({
                              backgroundStyle: 'image',
                              backgroundSize: option.value,
                              backgroundRepeat: option.repeat,
                            })}
                            className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                              selected
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-gray-900'
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-800">位置</div>
                    <div className="grid grid-cols-5 gap-2">
                      {IMAGE_POSITION_OPTIONS.map(option => {
                        const selected = activeTheme.backgroundPosition === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateTheme({
                              backgroundStyle: 'image',
                              backgroundPosition: option.value,
                            })}
                            className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                              selected
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-gray-900'
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <ImageIcon className="h-4 w-4" />
                      已上传背景
                    </div>
                    <button
                      type="button"
                      onClick={fetchBackgroundImages}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      刷新
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </div>
                  ) : backgroundImages.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                      暂无背景图片
                    </div>
                  ) : (
                    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                      {backgroundImages.map(image => {
                        const selected = activeTheme.backgroundImage === image.url
                        return (
                          <button
                            key={image.url}
                            type="button"
                            onClick={() => updateTheme({
                              backgroundStyle: 'image',
                              backgroundImage: image.url,
                              backgroundSize: activeTheme.backgroundSize || 'cover',
                              backgroundPosition: activeTheme.backgroundPosition || 'center',
                              backgroundRepeat: activeTheme.backgroundRepeat || 'no-repeat',
                            })}
                            className={`group relative overflow-hidden rounded-xl border bg-gray-50 text-left transition-all ${
                              selected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100 hover:border-indigo-200'
                            }`}
                            title={image.name}
                          >
                            <div className="aspect-video">
                              <OptimizedImage
                                src={image.url}
                                alt={image.name}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                wrapperClassName="block h-full w-full"
                              />
                            </div>
                            {selected && (
                              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-600 shadow">
                                <Check className="h-4 w-4" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
