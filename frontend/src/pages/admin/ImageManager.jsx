import { useEffect, useMemo, useRef, useState } from 'react'
import { Edit2, Image as ImageIcon, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import LoadingIndicator from '../../components/LoadingIndicator'
import OptimizedImage from '../../components/OptimizedImage'
import { optimizeCoverImage } from '../../utils/imageCompression'

function formatSize(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ImageManager() {
  const [images, setImages] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/article-images', { cache: 'no-store' })
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data.message || '加载图片失败')
      setImages(Array.isArray(data) ? data : [])
    } catch (exception) { setError(exception.message || '加载图片失败') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    return keyword ? images.filter(image => `${image.name || ''} ${image.url || ''}`.toLocaleLowerCase().includes(keyword)) : images
  }, [images, query])

  const upload = async file => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const optimized = await optimizeCoverImage(file)
      const body = new FormData(); body.append('file', optimized)
      const response = await fetch('/api/admin/article-images', { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '上传失败')
      await load()
    } catch (exception) { setError(exception.message || '上传失败') } finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }

  const rename = async image => {
    const newName = window.prompt('输入新的文件名（不能修改扩展名）', image.name)
    if (!newName || newName.trim() === image.name) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/article-images/${encodeURIComponent(image.name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName: newName.trim() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '重命名失败')
      await load()
    } catch (exception) { setError(exception.message || '重命名失败') } finally { setBusy(false) }
  }

  const remove = async image => {
    if (!window.confirm(`确定删除“${image.name}”吗？仍被文章或项目引用的图片无法删除。`)) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/article-images/${encodeURIComponent(image.name)}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '删除失败')
      await load()
    } catch (exception) { setError(exception.message || '删除失败') } finally { setBusy(false) }
  }

  return <section>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><ImageIcon className="h-7 w-7 text-indigo-600" />图片管理</h1><p className="mt-1 text-sm text-gray-500">管理文章和项目封面，上传时沿用封面压缩与尺寸限制。</p></div><div className="flex gap-2"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => void upload(event.target.files?.[0])} className="hidden" /><button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white disabled:opacity-60"><Upload className="h-4 w-4" />上传图片</button><button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:text-slate-200"><RefreshCw className="h-4 w-4" />刷新</button></div></div>
    <div className="mb-5 relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文件名或 URL" className="admin-input w-full pl-9" /></div>
    {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    {loading ? <div className="flex justify-center py-20"><LoadingIndicator size={28} label="加载图片" /></div> : filtered.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 py-20 text-center text-sm text-gray-500 dark:border-slate-700">暂无匹配图片</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{filtered.map(image => <article key={image.url} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><OptimizedImage src={image.url} alt={image.name} className="h-full w-full object-cover" wrapperClassName="block aspect-[16/10] w-full overflow-hidden bg-gray-100 dark:bg-slate-800" fallback={<div className="flex aspect-[16/10] items-center justify-center text-gray-400"><ImageIcon className="h-8 w-8" /></div>} /><div className="p-3"><p className="truncate text-sm font-medium text-gray-800 dark:text-slate-100" title={image.name}>{image.name}</p><p className="mt-1 text-xs text-gray-500">{formatSize(image.size)} · {image.updatedAt ? new Date(image.updatedAt).toLocaleDateString() : ''}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void rename(image)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Edit2 className="h-3.5 w-3.5" />重命名</button><button type="button" onClick={() => void remove(image)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />删除</button></div></div></article>)}</div>}
  </section>
}
