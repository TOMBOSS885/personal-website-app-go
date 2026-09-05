import { useEffect, useId, useRef, useState } from 'react'
import { Check, Image as ImageIcon, RefreshCw, Upload, X } from 'lucide-react'
import LoadingIndicator from './LoadingIndicator'
import OptimizedImage from './OptimizedImage'
import { optimizeCoverImage } from '../utils/imageCompression'

export default function CoverImagePicker({ value = '', onChange, apiPath = '/api/admin/article-images', csrfToken = '', label = '封面' }) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const titleId = useId()

  const loadImages = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(apiPath, { credentials: 'same-origin', cache: 'no-store' })
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data.message || '加载封面失败')
      setImages(Array.isArray(data) ? data : [])
    } catch (exception) { setImages([]); setError(exception.message || '加载封面失败') } finally { setLoading(false) }
  }

  useEffect(() => { if (open) void loadImages() }, [open])
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const upload = async file => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const optimized = await optimizeCoverImage(file)
      const body = new FormData(); body.append('file', optimized)
      const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
      const response = await fetch(apiPath, { method: 'POST', credentials: 'same-origin', headers, body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '封面上传失败')
      onChange?.(data.url || '')
      setOpen(false)
    } catch (exception) { setError(exception.message || '封面上传失败') } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const filtered = images.filter(image => {
    const text = `${image?.name || ''} ${image?.url || ''}`.toLocaleLowerCase()
    return !query.trim() || text.includes(query.trim().toLocaleLowerCase())
  })

  return <div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="block min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-slate-300">{label}
        <input value={value} onChange={event => onChange?.(event.target.value)} placeholder="封面 URL" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <div className="flex items-end gap-2 pt-5">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => void upload(event.target.files?.[0])} className="hidden" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{uploading ? <LoadingIndicator size={16} /> : <Upload className="h-4 w-4" />}{uploading ? '压缩并上传中...' : '上传新封面'}</button>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"><ImageIcon className="h-4 w-4" />选择已有封面</button>
      </div>
    </div>
    {value && <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
      <OptimizedImage src={value} alt="当前文章封面" className="h-full w-full object-cover" wrapperClassName="block h-16 w-28 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-slate-800" fallback={<span className="flex h-16 w-28 items-center justify-center bg-gray-100 text-gray-400 dark:bg-slate-800"><ImageIcon className="h-5 w-5" /></span>} />
      <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={value}>{value}</span>
      <button type="button" onClick={() => onChange?.('')} title="移除封面" className="rounded-md p-2 text-gray-500 hover:bg-white dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
    </div>}
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800"><h2 id={titleId} className="font-semibold text-gray-900 dark:text-slate-100">选择已有封面</h2><button type="button" onClick={() => setOpen(false)} title="关闭" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></header>
        <div className="flex flex-wrap gap-3 border-b border-gray-100 p-4 dark:border-slate-800"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索图片名称或 URL" className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={() => void loadImages()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-200">{loading ? <LoadingIndicator size={15} /> : <RefreshCw className="h-4 w-4" />}刷新</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{error ? <p role="alert" className="py-12 text-center text-sm text-red-600">{error}</p> : loading ? <div className="flex min-h-48 items-center justify-center"><LoadingIndicator size={24} label="加载封面" /></div> : filtered.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">暂无匹配封面</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filtered.map(image => { const selected = value === image.url; return <button key={image.url} type="button" onClick={() => { onChange?.(image.url); setOpen(false) }} className={`group overflow-hidden rounded-lg border text-left ${selected ? 'border-indigo-600 ring-2 ring-indigo-500/30' : 'border-gray-200 hover:border-indigo-400'} dark:border-slate-700`}><OptimizedImage src={image.url} alt={image.name || '封面'} className="h-full w-full object-cover" wrapperClassName="block aspect-[16/10] w-full overflow-hidden bg-gray-100 dark:bg-slate-800" fallback={<span className="flex aspect-[16/10] items-center justify-center bg-gray-100 text-gray-400 dark:bg-slate-800"><ImageIcon className="h-7 w-7" /></span>} /> <span className="flex items-center justify-between gap-2 p-2 text-xs"><span className="truncate" title={image.name}>{image.name}</span>{selected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}</span></button> })}</div>}</div>
      </section>
    </div>}
  </div>
}
