import { useEffect, useRef, useState } from 'react'
import { Code2, Edit2, FileArchive, FileText, Image, Loader, Lock, Plus, Save, Trash2, Upload, UploadCloud, X } from 'lucide-react'
import RichTextEditor from '../../components/RichTextEditor'
import { optimizeCoverImage } from '../../utils/imageCompression'

const emptyForm = {
  title: '', summary: '', content: '', category: '', tags: '', coverImage: '',
  published: true, contentType: 'markdown', staticSiteKey: '', staticSiteName: '',
  isLocked: false, accessPassword: '',
}
const DRAFT_KEY = 'php-shared-host:article-draft'

export default function ArticleManager() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingSite, setUploadingSite] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const fileInputRef = useRef(null)
  const siteFileInputRef = useRef(null)

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/articles?page=0&size=100')
      const data = await response.json().catch(() => ({}))
      setArticles(response.ok ? (data.content || []) : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchArticles() }, [])

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
    setShowModal(true)
  }

  const openEdit = article => {
    setEditingArticle(article)
    setForm({
      ...emptyForm,
      ...article,
      tags: article.tags || '',
      accessPassword: '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingArticle(null)
    setForm(emptyForm)
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
      alert(error.message || '静态前端上传失败')
    } finally {
      setUploadingSite(false)
      if (siteFileInputRef.current) siteFileInputRef.current.value = ''
    }
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
      await fetchArticles()
    } catch (error) {
      alert(error.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async id => {
    if (!confirm('确定删除这篇文章吗？此操作无法撤销。')) return
    const response = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })
    if (response.ok) await fetchArticles()
    else alert('删除失败')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><FileText className="h-7 w-7 text-indigo-600" />文章管理</h1><p className="mt-1 text-sm text-gray-500">发布 Markdown 或静态前端文章</p></div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />新建文章</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? <div className="flex items-center justify-center py-16 text-gray-500"><Loader className="mr-2 h-5 w-5 animate-spin" />加载中...</div> : articles.length === 0 ? <div className="py-16 text-center text-gray-500">暂无文章</div> : (
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500 dark:border-slate-800 dark:bg-slate-950"><tr><th className="px-5 py-4">标题</th><th className="px-5 py-4">分类</th><th className="px-5 py-4">状态</th><th className="px-5 py-4">阅读</th><th className="px-5 py-4 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {articles.map(article => (
                <tr key={article.id} className="text-sm text-gray-700 dark:text-slate-300">
                  <td className="px-5 py-4"><div className="flex items-center gap-2 font-medium text-gray-900 dark:text-slate-100"><span>{article.title}</span>{article.contentType === 'static' && <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"><Code2 className="h-3 w-3" />静态前端</span>}</div><div className="mt-1 max-w-xl truncate text-xs text-gray-500">{article.summary}</div></td>
                  <td className="px-5 py-4">{article.category || '-'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${article.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{article.published ? '已发布' : '草稿'}</span>{article.isLocked && <Lock className="ml-2 inline h-4 w-4 text-amber-500" />}</td>
                  <td className="px-5 py-4">{article.views || 0}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => openEdit(article)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" title="编辑"><Edit2 className="h-4 w-4" /></button><button type="button" onClick={() => handleDelete(article.id)} className="ml-1 rounded-lg p-2 text-red-500 hover:bg-red-50" title="删除"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800"><h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{editingArticle ? '编辑文章' : '新建文章'}</h2><button type="button" onClick={closeModal} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">标题<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" required /></label><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">分类<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label></div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">摘要<textarea value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
              <div className="grid gap-4 md:grid-cols-[1fr_auto]"><label className="block text-sm font-medium text-gray-700 dark:text-slate-300">封面 URL<input value={form.coverImage} onChange={event => setForm({ ...form, coverImage: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label><div className="flex items-end"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => uploadCover(event.target.files?.[0])} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200">{uploading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? '压缩并上传中...' : '上传封面'}</button></div></div>
              {form.coverImage && <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-slate-950"><Image className="h-5 w-5" /><span className="min-w-0 flex-1 truncate">{form.coverImage}</span></div>}
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">标签（英文逗号分隔）<input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-700 dark:text-slate-300">正文类型</div>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-slate-700 dark:bg-slate-950">
                    <button type="button" onClick={() => setForm(current => ({ ...current, contentType: 'markdown' }))} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${form.contentType !== 'static' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}><FileText className="h-4 w-4" />Markdown</button>
                    <button type="button" onClick={() => setForm(current => ({ ...current, contentType: 'static' }))} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${form.contentType === 'static' ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}><Code2 className="h-4 w-4" />静态前端</button>
                  </div>
                </div>
                {form.contentType === 'static' ? (
                  <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-cyan-300 bg-cyan-50/60 p-6 dark:border-cyan-500/30 dark:bg-cyan-500/5">
                    <input ref={siteFileInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={event => uploadArticleSite(event.target.files?.[0])} className="hidden" />
                    <div className="max-w-xl text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">{uploadingSite ? <Loader className="h-6 w-6 animate-spin" /> : <FileArchive className="h-6 w-6" />}</div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-slate-100">{form.staticSiteKey ? '静态前端已就绪' : '上传静态前端 ZIP'}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">入口必须是 index.html。可以直接压缩 Vite、React 或 Vue 构建后的 dist 目录，资源请使用相对路径。</p>
                      {form.staticSiteKey && <div className="mt-3 truncate rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-cyan-800 dark:border-cyan-500/20 dark:bg-slate-900 dark:text-cyan-200">{form.staticSiteName || form.staticSiteKey}</div>}
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button type="button" disabled={uploadingSite} onClick={() => siteFileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"><UploadCloud className="h-4 w-4" />{uploadingSite ? '上传并检查中...' : form.staticSiteKey ? '替换 ZIP' : '选择 ZIP'}</button>
                        {form.staticSiteKey && <button type="button" onClick={() => setForm(current => ({ ...current, staticSiteKey: '', staticSiteName: '' }))} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Trash2 className="h-4 w-4" />移除</button>}
                      </div>
                    </div>
                  </div>
                ) : <RichTextEditor value={form.content} onChange={content => setForm(current => ({ ...current, content }))} height={520} />}
              </div>
              <div className="grid gap-4 rounded-lg bg-gray-50 p-4 dark:bg-slate-950 sm:grid-cols-2"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.published} onChange={event => setForm({ ...form, published: event.target.checked })} className="h-4 w-4 rounded" />立即发布</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.isLocked} onChange={event => setForm({ ...form, isLocked: event.target.checked })} className="h-4 w-4 rounded" />使用独立访问密码</label>{form.isLocked && <input type="password" value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value })} placeholder={editingArticle?.isLocked ? '留空则保持原密码' : '设置访问密码'} className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900" />}</div>
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800"><button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 dark:border-slate-700 dark:text-slate-200">取消</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? '保存中...' : '保存文章'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
