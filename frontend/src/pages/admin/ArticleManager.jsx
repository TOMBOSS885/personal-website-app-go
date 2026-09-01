import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Code2, Edit2, FileArchive, FileText, Image, Layers3, Lock, Plus, Save, Trash2, Upload, UploadCloud, X } from 'lucide-react'
import RichTextEditor from '../../components/RichTextEditor'
import LoadingIndicator from '../../components/LoadingIndicator'
import { optimizeCoverImage } from '../../utils/imageCompression'

const emptyForm = {
  title: '', summary: '', content: '', category: '', tags: '', seriesName: '', seriesOrder: 0, featured: false, displayOrder: 0, coverImage: '',
  published: true, contentType: 'markdown', staticSiteKey: '', staticSiteName: '',
  isLocked: false, accessPassword: '',
}
const DRAFT_KEY = 'php-shared-host:article-draft'
const PAGE_SIZE = 20

export function validateStaticSiteZipSelection(files) {
  const selected = Array.from(files || [])
  if (selected.length === 0) return { file: null, error: '请选择 ZIP 文件' }
  if (selected.length > 1) return { file: null, error: '一次只能上传一个 ZIP 文件' }
  const file = selected[0]
  if (!file?.name || !file.name.toLowerCase().endsWith('.zip')) {
    return { file: null, error: '静态前端必须使用 .zip 压缩包' }
  }
  return { file, error: '' }
}

export default function ArticleManager() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingSite, setUploadingSite] = useState(false)
  const [siteDragActive, setSiteDragActive] = useState(false)
  const [siteUploadError, setSiteUploadError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [availableSeries, setAvailableSeries] = useState([])
  const [form, setForm] = useState(emptyForm)
  const fileInputRef = useRef(null)
  const siteFileInputRef = useRef(null)
  const siteDragDepthRef = useRef(0)

  const fetchArticles = async (requestedPage = page) => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`/api/admin/articles?page=${requestedPage}&size=${PAGE_SIZE}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '加载文章失败')
      const nextArticles = Array.isArray(data.content) ? data.content : []
      const nextTotalPages = Number(data.totalPages) || 0
      if (requestedPage > 0 && nextArticles.length === 0 && nextTotalPages <= requestedPage) {
        setPage(requestedPage - 1)
        return
      }
      setArticles(nextArticles)
      setTotalPages(nextTotalPages)
      setTotalElements(Number(data.totalElements) || 0)
    } catch (error) {
      setArticles([])
      setLoadError(error.message || '加载文章失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchArticles(page) }, [page])

  useEffect(() => {
    fetch('/api/admin/article-series', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : [])
      .then(data => setAvailableSeries(Array.isArray(data) ? data : []))
      .catch(() => setAvailableSeries([]))
  }, [showModal])

  useEffect(() => {
    if (!showModal || editingArticle) return undefined
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, savedAt: Date.now() }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [editingArticle, form, showModal])

  const openCreate = () => {
    let draft = null
    try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') } catch { draft = null }
    setEditingArticle(null)
    setForm(draft ? { ...emptyForm, ...draft } : emptyForm)
    setSiteUploadError('')
    setSiteDragActive(false)
    siteDragDepthRef.current = 0
    setShowModal(true)
  }

  const openEdit = async article => {
    setEditingId(article.id)
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, { cache: 'no-store' })
      const detail = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(detail.message || '加载文章正文失败')
      setEditingArticle(detail)
      setForm({
        ...emptyForm,
        ...detail,
        tags: detail.tags || '',
        accessPassword: '',
      })
      setSiteUploadError('')
      setSiteDragActive(false)
      siteDragDepthRef.current = 0
      setShowModal(true)
    } catch (error) {
      alert(error.message || '加载文章正文失败')
    } finally {
      setEditingId(null)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingArticle(null)
    setForm(emptyForm)
    setSiteUploadError('')
    setSiteDragActive(false)
    siteDragDepthRef.current = 0
  }

  const uploadCover = async file => {
    if (!file) return
    setUploading(true)
    try {
      const optimizedFile = await optimizeCoverImage(file)
      const body = new FormData()
      body.append('file', optimizedFile)
      const response = await fetch('/api/admin/article-images', { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '封面上传失败')
      setForm(current => ({ ...current, coverImage: data.url }))
    } catch (error) {
      alert(error.message || '封面上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const uploadArticleSite = async file => {
    if (!file) return
    setSiteUploadError('')
    setUploadingSite(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/admin/article-sites', { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '静态前端上传失败')
      setForm(current => ({
        ...current,
        contentType: 'static',
        staticSiteKey: data.siteKey,
        staticSiteName: data.name || file.name,
      }))
    } catch (error) {
      setSiteUploadError(error.message || '静态前端上传失败')
    } finally {
      setUploadingSite(false)
      if (siteFileInputRef.current) siteFileInputRef.current.value = ''
    }
  }

  const selectArticleSiteZip = files => {
    if (uploadingSite) return
    const selection = validateStaticSiteZipSelection(files)
    if (selection.error) {
      setSiteUploadError(selection.error)
      if (siteFileInputRef.current) siteFileInputRef.current.value = ''
      return
    }
    setSiteUploadError('')
    void uploadArticleSite(selection.file)
  }

  const handleSiteDragEnter = event => {
    event.preventDefault()
    event.stopPropagation()
    if (uploadingSite || !Array.from(event.dataTransfer?.types || []).includes('Files')) return
    siteDragDepthRef.current += 1
    setSiteDragActive(true)
  }

  const handleSiteDragOver = event => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = uploadingSite ? 'none' : 'copy'
  }

  const handleSiteDragLeave = event => {
    event.preventDefault()
    event.stopPropagation()
    siteDragDepthRef.current = Math.max(0, siteDragDepthRef.current - 1)
    if (siteDragDepthRef.current === 0) setSiteDragActive(false)
  }

  const handleSiteDrop = event => {
    event.preventDefault()
    event.stopPropagation()
    siteDragDepthRef.current = 0
    setSiteDragActive(false)
    if (uploadingSite) return
    selectArticleSiteZip(event.dataTransfer?.files)
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!form.title.trim()) {
      alert('标题不能为空')
      return
    }
    if (form.contentType !== 'static' && !form.content.trim()) {
      alert('Markdown 正文不能为空')
      return
    }
    if (form.contentType === 'static' && !form.staticSiteKey) {
      alert('请先上传包含 index.html 的静态前端 ZIP')
      return
    }
    if (form.isLocked && !editingArticle?.isLocked && !form.accessPassword) {
      alert('请为加锁文章设置访问密码')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(editingArticle ? `/api/admin/articles/${editingArticle.id}` : '/api/admin/articles', {
        method: editingArticle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '保存失败')
      sessionStorage.removeItem(DRAFT_KEY)
      closeModal()
      await fetchArticles(page)
    } catch (error) {
      alert(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async id => {
    if (!confirm('确定删除这篇文章吗？此操作无法撤销。')) return
    const response = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })
    if (response.ok) await fetchArticles(page)
    else alert('删除失败')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><FileText className="h-7 w-7 text-indigo-600" />文章管理</h1><p className="mt-1 text-sm text-gray-500">发布 Markdown 或静态前端文章</p></div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />新建文章</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-500"><LoadingIndicator size={20} className="mr-2" />加载中...</div> : loadError ? <div className="py-16 text-center text-red-600"><p>{loadError}</p><button type="button" onClick={() => fetchArticles(page)} className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium hover:bg-red-50">重新加载</button></div> : articles.length === 0 ? <div className="py-16 text-center text-gray-500">暂无文章</div> : (
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500 dark:border-slate-800 dark:bg-slate-950"><tr><th className="px-5 py-4">标题</th><th className="px-5 py-4">分类</th><th className="px-5 py-4">状态</th><th className="px-5 py-4">阅读</th><th className="px-5 py-4 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {articles.map(article => (
                <tr key={article.id} className="text-sm text-gray-700 dark:text-slate-300">
                  <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-slate-100"><span>{article.title}</span>{article.contentType === 'static' && <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"><Code2 className="h-3 w-3" />静态前端</span>}{article.seriesName && <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"><Layers3 className="h-3 w-3" />{article.seriesName}{article.seriesOrder > 0 ? ` · ${article.seriesOrder}` : ''}</span>}</div><div className="mt-1 max-w-xl truncate text-xs text-gray-500">{article.summary}</div></td>
                  <td className="px-5 py-4">{article.category || '-'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${article.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{article.published ? '已发布' : '草稿'}</span>{article.isLocked && <Lock className="ml-2 inline h-4 w-4 text-amber-500" />}</td>
                  <td className="px-5 py-4">{article.views || 0}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => openEdit(article)} disabled={editingId !== null} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-50" title="编辑">{editingId === article.id ? <LoadingIndicator size={16} /> : <Edit2 className="h-4 w-4" />}</button><button type="button" onClick={() => handleDelete(article.id)} disabled={editingId !== null} className="ml-1 rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50" title="删除"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !loadError && totalElements > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 dark:border-slate-800">
            <span>共 {totalElements} 篇，第 {page + 1} / {Math.max(totalPages, 1)} 页</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800" title="上一页"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setPage(current => Math.min(Math.max(totalPages - 1, 0), current + 1))} disabled={page + 1 >= totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800" title="下一页"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800"><h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{editingArticle ? '编辑文章' : '新建文章'}</h2><button type="button" onClick={closeModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">标题<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" required /></label><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">分类<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label></div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">摘要<textarea value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
              <div className="grid gap-4 md:grid-cols-[1fr_auto]"><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">封面 URL<input value={form.coverImage} onChange={event => setForm({ ...form, coverImage: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label><div className="flex items-end"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => uploadCover(event.target.files?.[0])} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200">{uploading ? <LoadingIndicator size={16} /> : <Upload className="h-4 w-4" />}{uploading ? '压缩并上传中...' : '上传封面'}</button></div></div>
              {form.coverImage && <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-slate-950"><Image className="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{form.coverImage}</span></div>}
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">标签（英文逗号分隔）<input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
              <section className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><Layers3 className="h-5 w-5" /></span><div><h3 className="font-semibold text-gray-900 dark:text-slate-100">专题设置</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">同名文章会自动组成专题；顺序数字越小，文章越靠前。清空专题名称即可移出专题。</p></div></div>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">专题名称<input list="article-series-options" value={form.seriesName} onChange={event => setForm({ ...form, seriesName: event.target.value })} placeholder="选择已有专题或输入新专题名称" maxLength={120} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /><datalist id="article-series-options">{availableSeries.map(series => <option key={series.name} value={series.name}>{series.articleCount} 篇文章</option>)}</datalist></label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">专题内顺序<input type="number" min="0" max="9999" value={form.seriesOrder} onChange={event => setForm({ ...form, seriesOrder: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
                </div>
                {availableSeries.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{availableSeries.slice(0, 8).map(series => <button key={series.name} type="button" onClick={() => setForm(current => ({ ...current, seriesName: series.name }))} className={`rounded-full border px-3 py-1 text-xs transition ${form.seriesName === series.name ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-300'}`}>{series.name} · {series.articleCount}</button>)}</div>}
              </section>
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700 dark:text-slate-300">正文类型</div>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-slate-700 dark:bg-slate-950">
                    <button type="button" onClick={() => setForm(current => ({ ...current, contentType: 'markdown' }))} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${form.contentType !== 'static' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}><FileText className="h-4 w-4" />Markdown</button>
                    <button type="button" onClick={() => setForm(current => ({ ...current, contentType: 'static' }))} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${form.contentType === 'static' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}><Code2 className="h-4 w-4" />静态前端</button>
                  </div>
                </div>
                {form.contentType === 'static' ? (
                  <div
                    data-testid="static-site-dropzone"
                    aria-label="静态前端 ZIP 上传区域"
                    aria-busy={uploadingSite}
                    onDragEnter={handleSiteDragEnter}
                    onDragOver={handleSiteDragOver}
                    onDragLeave={handleSiteDragLeave}
                    onDrop={handleSiteDrop}
                    className={`flex min-h-[360px] items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${siteDragActive
                      ? 'border-cyan-600 bg-cyan-100 ring-4 ring-cyan-500/15 dark:border-cyan-300 dark:bg-cyan-400/10'
                      : siteUploadError
                        ? 'border-red-300 bg-red-50/70 dark:border-red-500/40 dark:bg-red-500/5'
                        : 'border-cyan-300 bg-cyan-50/60 dark:border-cyan-500/30 dark:bg-cyan-500/5'}`}
                  >
                    <input ref={siteFileInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={event => selectArticleSiteZip(event.target.files)} className="hidden" />
                    <div className="max-w-xl text-center">
                      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-lg ${siteDragActive ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300'}`}>{uploadingSite ? <LoadingIndicator size={24} /> : siteDragActive ? <UploadCloud className="h-7 w-7" /> : <FileArchive className="h-6 w-6" />}</div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-100">{siteDragActive ? '松开即可上传 ZIP' : form.staticSiteKey ? '静态前端已就绪' : '拖拽或选择静态前端 ZIP'}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">仅支持单个 .zip 文件，入口必须是 index.html；资源请使用相对路径。</p>
                      {siteUploadError && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300">{siteUploadError}</p>}
                      {form.staticSiteKey && <div className="mt-3 truncate rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-cyan-800 dark:border-cyan-500/20 dark:bg-slate-900 dark:text-cyan-200">{form.staticSiteName || form.staticSiteKey}</div>}
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button type="button" disabled={uploadingSite} onClick={() => siteFileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"><UploadCloud className="h-4 w-4" />{uploadingSite ? '上传并检查中...' : form.staticSiteKey ? '替换 ZIP' : '选择 ZIP'}</button>
                        {form.staticSiteKey && <button type="button" onClick={() => setForm(current => ({ ...current, staticSiteKey: '', staticSiteName: '' }))} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Trash2 className="h-4 w-4" />移除</button>}
                      </div>
                    </div>
                  </div>
                ) : <RichTextEditor value={form.content} onChange={content => setForm(current => ({ ...current, content }))} height={520} />}
              </div>
              <div className="grid gap-4 rounded-lg bg-gray-50 p-4 dark:bg-slate-950 sm:grid-cols-2"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.published} onChange={event => setForm({ ...form, published: event.target.checked })} className="h-4 w-4 rounded" />立即发布</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })} className="h-4 w-4 rounded" />设为精选文章</label>{form.featured && <label className="block text-sm text-gray-600 dark:text-slate-300">精选顺序<input type="number" min="0" value={form.displayOrder} onChange={event => setForm({ ...form, displayOrder: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" /></label>}<label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.isLocked} onChange={event => setForm({ ...form, isLocked: event.target.checked })} className="h-4 w-4 rounded" />使用独立访问密码</label>{form.isLocked && <input type="password" value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value })} placeholder={editingArticle?.isLocked ? '留空则保持原密码' : '设置访问密码'} className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900" />}</div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800"><button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 dark:border-slate-700 dark:text-slate-200">取消</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <LoadingIndicator size={16} /> : <Save className="h-4 w-4" />}{saving ? '保存中...' : '保存文章'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
