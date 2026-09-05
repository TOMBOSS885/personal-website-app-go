import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Edit3, Eye, FileText, FolderGit, Plus, Search, Trash2, UploadCloud } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useUserAuth } from '../contexts/UserAuthContext'
import CoverImagePicker from '../components/CoverImagePicker'

const EMPTY_ARTICLE = { title: '', summary: '', content: '', coverImage: '', category: '', tags: '', seriesName: '', seriesOrder: 0, published: false }
const EMPTY_PROJECT = { name: '', description: '', techStack: '', githubUrl: '', demoUrl: '', tags: '', featured: false }

export default function CreatorCenterPage() {
  const { user, loading } = useUserAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [projects, setProjects] = useState([])
  const [seriesOptions, setSeriesOptions] = useState([])
  const [tab, setTab] = useState('articles')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_ARTICLE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const load = async () => {
    const [ar, pr, sr] = await Promise.all([
      fetch('/api/creator/articles', { credentials: 'same-origin' }),
      fetch('/api/creator/projects', { credentials: 'same-origin' }),
      fetch('/api/public/articles/series', { credentials: 'same-origin' }),
    ])
    const ad = await ar.json().catch(() => [])
    const pd = await pr.json().catch(() => [])
    const sd = await sr.json().catch(() => [])
    if (!ar.ok || !pr.ok) throw new Error(ad.message || pd.message || '加载内容失败')
    setArticles(Array.isArray(ad) ? ad : ad.content || [])
    setProjects(Array.isArray(pd) ? pd : pd.content || [])
    setSeriesOptions(Array.isArray(sd) ? sd.map(item => item.name).filter(Boolean) : [])
  }

  useEffect(() => { if (user?.role === 'ADMIN') load().catch(exception => setError(exception.message)) }, [user?.id, user?.role])

  const items = tab === 'articles' ? articles : projects
  const filteredItems = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    if (!value) return items
    return items.filter(item => `${item.title || item.name || ''} ${item.summary || item.description || ''} ${item.category || ''} ${item.tags || ''} ${item.techStack || ''}`.toLocaleLowerCase().includes(value))
  }, [items, query])

  if (loading) return null
  if (!user) return <Navigate to="/login?redirect=/creator" replace />
  if (user.role !== 'ADMIN') return <main className="mx-auto max-w-3xl px-4 pb-20 pt-32"><h1 className="text-2xl font-bold">暂无创作权限</h1><p className="mt-2 text-gray-500">请联系站点管理员授予 ADMIN 角色。</p></main>

  const startCreate = type => {
    setTab(type); setEditing({ type, id: null }); setForm(type === 'articles' ? { ...EMPTY_ARTICLE } : { ...EMPTY_PROJECT }); setError('')
  }

  const startEdit = async (type, item) => {
    setTab(type); setError('')
    if (type === 'articles') {
      try {
        const response = await fetch(`/api/creator/articles/${item.id}`, { credentials: 'same-origin', cache: 'no-store' })
        const detail = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(detail.message || '加载文章正文失败')
        setEditing({ type, id: item.id })
        setForm({ title: detail.title || '', summary: detail.summary || '', content: detail.content || '', coverImage: detail.coverImage || '', category: detail.category || '', tags: detail.tags || '', seriesName: detail.seriesName || '', seriesOrder: detail.seriesOrder || 0, published: Boolean(detail.published) })
      } catch (exception) { setError(exception.message || '加载文章正文失败') }
      return
    }
    setEditing({ type, id: item.id })
    setForm({ name: item.name || '', description: item.description || '', techStack: item.techStack || '', githubUrl: item.githubUrl || '', demoUrl: item.demoUrl || '', tags: item.tags || '', featured: Boolean(item.featured) })
  }

  const importFile = file => {
    if (!file || !/\.(md|markdown|txt)$/i.test(file.name)) { setError('请拖入 Markdown 或 TXT 文件。'); return }
    const reader = new FileReader()
    reader.onload = () => { setTab('articles'); setEditing({ type: 'articles', id: null }); setForm({ ...EMPTY_ARTICLE, title: file.name.replace(/\.(md|markdown|txt)$/i, ''), content: String(reader.result || '') }); setError('') }
    reader.onerror = () => setError('文件读取失败。')
    reader.readAsText(file)
  }

  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const path = `/api/creator/${editing.type}${editing.id ? `/${editing.id}` : ''}`
    try {
      const response = await fetch(path, { method: editing.id ? 'PUT' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrfToken }, body: JSON.stringify(form) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '保存失败')
      setEditing(null); await load()
    } catch (exception) { setError(exception.message || '保存失败') } finally { setBusy(false) }
  }

  const remove = async (type, id) => {
    if (!window.confirm('确定删除此内容吗？')) return
    const response = await fetch(`/api/creator/${type}/${id}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': user.csrfToken } })
    if (response.ok) await load(); else { const data = await response.json().catch(() => ({})); setError(data.message || '删除失败') }
  }

  return <main className="mx-auto max-w-6xl px-4 pb-20 pt-28">
    <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" />返回首页</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">创作中心</h1><p className="mt-1 text-sm text-gray-500">{user.displayName || user.email} · 文章默认需登录并绑定第三方账号查看</p></div><div className="flex gap-2"><button onClick={() => startCreate('articles')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />新建文章</button><button onClick={() => startCreate('projects')} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"><Plus className="h-4 w-4" />新建项目</button></div></div>
    <div className="mt-6 flex items-center gap-3"><div className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、描述、标签" className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div></div>
    <div className="mt-5 flex gap-2 border-b border-gray-200"><button onClick={() => setTab('articles')} className={`px-4 py-2 text-sm font-medium ${tab === 'articles' ? 'border-b-2 border-indigo-600 text-indigo-600' : ''}`}>我的文章 ({articles.length})</button><button onClick={() => setTab('projects')} className={`px-4 py-2 text-sm font-medium ${tab === 'projects' ? 'border-b-2 border-indigo-600 text-indigo-600' : ''}`}>我的项目 ({projects.length})</button></div>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!editing ? <><div onDragEnter={event => { event.preventDefault(); setDragActive(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={event => { event.preventDefault(); setDragActive(false); importFile(event.dataTransfer.files?.[0]) }} className={`mt-5 rounded-lg border-2 border-dashed p-4 text-sm ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white/70'} dark:border-slate-700 dark:bg-slate-900/70`}><div className="flex items-center gap-2 text-gray-500"><UploadCloud className="h-4 w-4" />拖入 Markdown/TXT 文件可导入为新文章</div></div><div className="mt-5 grid gap-4 md:grid-cols-2">{filteredItems.map(item => <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2">{tab === 'articles' ? <FileText className="h-5 w-5 text-indigo-600" /> : <FolderGit className="h-5 w-5 text-indigo-600" />}<h2 className="font-semibold">{item.title || item.name}</h2></div><div className="flex gap-1"><button title="查看" onClick={() => tab === 'articles' ? navigate(`/blog/${item.id}`) : navigate('/projects')} className="rounded p-2 text-gray-500 hover:bg-gray-100"><Eye className="h-4 w-4" /></button><button title="编辑" onClick={() => startEdit(tab, item)} className="rounded p-2 text-indigo-600 hover:bg-indigo-50"><Edit3 className="h-4 w-4" /></button><button title="删除" onClick={() => remove(tab, item.id)} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-2 line-clamp-2 text-sm text-gray-500">{item.summary || item.description || '暂无描述'}</p><p className="mt-3 text-xs text-gray-400">作者：{item.author?.displayName || user.displayName || user.email}</p></article>)}{filteredItems.length === 0 && <p className="py-12 text-center text-sm text-gray-500">没有找到匹配内容。</p>}</div></> : <form onSubmit={save} className="mt-6 max-w-3xl space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">{editing.type === 'articles' ? <><input required placeholder="文章标题" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="摘要" value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><CoverImagePicker value={form.coverImage || ''} onChange={coverImage => setForm(current => ({ ...current, coverImage }))} apiPath="/api/creator/article-images" csrfToken={user.csrfToken} /><input placeholder="分类" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="标签（逗号分隔）" value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><div className="grid gap-3 sm:grid-cols-[1fr_8rem]"><div><input list="creator-series-options" placeholder="专题名称（可新建或加入已有专题）" value={form.seriesName || ''} onChange={event => setForm({ ...form, seriesName: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><datalist id="creator-series-options">{seriesOptions.map(name => <option key={name} value={name} />)}</datalist></div><input type="number" min="0" placeholder="专题顺序" value={form.seriesOrder ?? 0} onChange={event => setForm({ ...form, seriesOrder: Number(event.target.value) || 0 })} className="w-full rounded border p-3 dark:bg-slate-950" /></div><p className="-mt-2 text-xs text-gray-500">填写专题名称即可创建专题；使用相同名称可将多篇文章加入同一专题。</p><textarea required rows={14} placeholder="Markdown 正文" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} className="w-full rounded border p-3 font-mono dark:bg-slate-950" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={event => setForm({ ...form, published: event.target.checked })} />发布文章</label></> : <><input required placeholder="项目名称" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><textarea rows={5} placeholder="项目描述" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="技术栈" value={form.techStack} onChange={event => setForm({ ...form, techStack: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="标签（逗号分隔）" value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="GitHub 地址" value={form.githubUrl} onChange={event => setForm({ ...form, githubUrl: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /><input placeholder="演示地址" value={form.demoUrl} onChange={event => setForm({ ...form, demoUrl: event.target.value })} className="w-full rounded border p-3 dark:bg-slate-950" /></>}<div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">{busy ? '保存中...' : '保存'}</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">取消</button></div></form>}
  </main>
}
