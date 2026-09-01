import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Image as ImageIcon, Palette, RefreshCw, Settings2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import OptimizedImage from './OptimizedImage'
import LoadingIndicator from './LoadingIndicator'

const API_BASE = ''

const STYLE_OPTIONS = [
  { value: 'gradient', label: '渐变' },
  { value: 'solid', label: '纯色' },
  { value: 'image', label: '图片' },
]

export default function HomeBackgroundCustomizer() {
  const location = useLocation()
  const { setCustomTheme, getActiveTheme, surfaceMode, setSurfaceMode } = useTheme()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [backgroundImages, setBackgroundImages] = useState([])
  const backgroundRequestRef = useRef(null)

  const activeTheme = getActiveTheme()

  const fetchBackgroundImages = async () => {
    // Opening the image picker and switching to image mode can happen in the
    // same render. Reuse the in-flight request so a slow shared host does not
    // receive duplicate requests for the same immutable list.
    if (backgroundRequestRef.current) return backgroundRequestRef.current

    setLoading(true)
    const request = fetch(`${API_BASE}/api/public/theme/background-images`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const images = Array.isArray(data) ? data : []
        setBackgroundImages(images)
        return images
      })
      .catch(() => {
        setBackgroundImages([])
        return []
      })
      .finally(() => {
        setLoading(false)
        if (backgroundRequestRef.current === request) {
          backgroundRequestRef.current = null
        }
      })

    backgroundRequestRef.current = request
    return request
  }

  useEffect(() => {
    if (open && activeTheme.backgroundStyle === 'image' && backgroundImages.length === 0) {
      fetchBackgroundImages()
    }
  }, [open, activeTheme.backgroundStyle])

  useEffect(() => {
    document.documentElement.classList.toggle('background-customizer-open', open)
    return () => document.documentElement.classList.remove('background-customizer-open')
  }, [open])

	if (location.pathname === '/login' || location.pathname === '/account') return null

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
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    })
    fetchBackgroundImages()
  }

  return (
    <div className="floating-tool floating-tool--background">
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
            className="absolute bottom-14 right-0 max-h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/95 dark:shadow-black/30"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
                <Palette className="h-4 w-4" style={{ color: 'var(--theme-primary)' }} />
                背景样式
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
                  <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">透明与毛玻璃</div>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-200/70 p-1 dark:bg-slate-800" role="group" aria-label="卡片显示模式">
                      {[
                        { value: 'glass', label: '毛玻璃' },
                        { value: 'transparent', label: '全透明' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSurfaceMode(option.value)}
                          aria-pressed={surfaceMode === option.value}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${surfaceMode === option.value
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white'
                            : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <RangeSetting
                      label="壁纸透明度"
                      value={activeTheme.backgroundImageOpacity}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={value => updateTheme({ backgroundImageOpacity: value })}
                    />
                    <RangeSetting
                      label="背景模糊度"
                      value={activeTheme.backgroundBlur}
                      min={0}
                      max={24}
                      suffix="px"
                      onChange={value => updateTheme({ backgroundBlur: value })}
                    />
                    <RangeSetting
                      label="卡片透明度"
                      value={activeTheme.cardOpacity}
                      min={20}
                      max={100}
                      suffix="%"
                      disabled={surfaceMode === 'transparent'}
                      onChange={value => updateTheme({ cardOpacity: value })}
                    />
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
                      {loading ? <LoadingIndicator size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}
                      刷新
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                      <LoadingIndicator size={16} className="mr-2" />
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
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
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

function RangeSetting({ label, value, min, max, suffix, disabled = false, onChange }) {
  const normalizedValue = Number.isFinite(Number(value)) ? Number(value) : min
  return (
    <label className={`block transition-opacity ${disabled ? 'opacity-45' : ''}`}>
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-gray-600 dark:text-slate-300">
        <span>{label}</span>
        <output className="min-w-12 rounded-md bg-white px-2 py-0.5 text-right tabular-nums text-gray-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
          {normalizedValue}{suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={normalizedValue}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        className="theme-range w-full cursor-pointer"
        aria-label={label}
      />
    </label>
  )
}
