import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Edit2, ExternalLink, Eye, EyeOff, FolderKanban, Link2, MessageCircle, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { safeExternalHref } from '../../utils/safeUrl'
import LoadingIndicator from '../../components/LoadingIndicator'
import { guestMessageTargetUrl } from '../../utils/guestMessageTarget'

const emptyFriend = { name: '', description: '', url: '', avatarUrl: '', category: 'Blog', displayOrder: 0, enabled: true }

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function responseData(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '操作失败')
  return data
}

export default function SocialManager() {
  const [tab, setTab] = useState('friends')
  const [friends, setFriends] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyFriend)
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [messagePage, setMessagePage] = useState(0)
  const [messagePages, setMessagePages] = useState(0)
  const [notice, setNotice] = useState('')

  const loadFriends = async () => {
    setLoading(true)
    try {
      const data = await responseData(await fetch('/api/admin/friends'))
      setFriends(Array.isArray(data) ? data : [])
    } catch (error) {
      setNotice(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (page = messagePage) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), size: '30' })
      if (statusFilter) params.set('status', statusFilter)
      if (query.trim()) params.set('q', query.trim())
      const data = await responseData(await fetch(`/api/admin/guest-messages?${params}`))
      setMessages(Array.isArray(data.content) ? data.content : [])
      setMessagePage(data.page || 0)
      setMessagePages(data.totalPages || 0)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'friends') loadFriends()
    else loadMessages(0)
  }, [tab])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyFriend)
    setShowForm(true)
  }

  const openEdit = friend => {
    setEditing(friend)
    setForm({ name: friend.name, description: friend.description || '', url: friend.url, avatarUrl: friend.avatarUrl || '', category: friend.category || 'Blog', displayOrder: friend.displayOrder || 0, enabled: Boolean(friend.enabled) })
    setShowForm(true)
  }

  const saveFriend = async event => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      const url = editing ? `/api/admin/friends/${editing.id}` : '/api/admin/friends'
      await responseData(await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, displayOrder: Number(form.displayOrder) || 0 }) }))
      setShowForm(false)
      await loadFriends()
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteFriend = async id => {
    if (!window.confirm('确定删除这条友链吗？')) return
    try {
      await responseData(await fetch(`/api/admin/friends/${id}`, { method: 'DELETE' }))
      await loadFriends()
    } catch (error) {
      setNotice(error.message)
    }
  }

  const updateMessageStatus = async (id, status) => {
    try {
      await responseData(await fetch(`/api/admin/guest-messages/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }))
      setMessages(current => current.map(message => message.id === id ? { ...message, status } : message))
    } catch (error) {
      setNotice(error.message)
    }
  }

  const deleteMessage = async id => {
    if (!window.confirm('删除后前台将无法显示，确定继续吗？')) return
    try {
      await responseData(await fetch(`/api/admin/guest-messages/${id}`, { method: 'DELETE' }))
      setMessages(current => current.filter(message => message.id !== id))
    } catch (error) {
      setNotice(error.message)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100"><Users className="h-7 w-7 text-indigo-600" />友链与留言</h1><p className="mt-1 text-sm text-gray-500 dark:text-slate-400">管理公开友链并审核访客留言</p></div>{tab === 'friends' && <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-700"><Plus className="h-4 w-4" />新增友链</button>}</div>
      <div className="mb-6 inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" role="tablist"><button type="button" onClick={() => setTab('friends')} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${tab === 'friends' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-300'}`}><Link2 className="h-4 w-4" />友链</button><button type="button" onClick={() => setTab('messages')} className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${tab === 'messages' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-300'}`}><MessageCircle className="h-4 w-4" />留言</button></div>
      {notice && <div role="alert" className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"><span>{notice}</span><button type="button" onClick={() => setNotice('')} title="关闭"><X className="h-4 w-4" /></button></div>}

      {tab === 'friends' ? <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">{loading ? <div className="flex justify-center py-14 text-indigo-600 dark:text-indigo-300"><LoadingIndicator size={32} label="加载友链" /></div> : friends.length === 0 ? <div className="py-14 text-center text-gray-500">暂无友链</div> : <table className="min-w-[760px] w-full"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-5 py-4">站点</th><th className="px-5 py-4">分类</th><th className="px-5 py-4">排序</th><th className="px-5 py-4">状态</th><th className="px-5 py-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-800">{friends.map(friend => <tr key={friend.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60"><td className="px-5 py-4"><div className="font-medium text-gray-900 dark:text-slate-100">{friend.name}</div><div className="mt-1 max-w-md truncate text-xs text-gray-500">{friend.description}</div></td><td className="px-5 py-4 text-sm text-gray-600 dark:text-slate-300">{friend.category || '-'}</td><td className="px-5 py-4 text-sm text-gray-600 dark:text-slate-300">{friend.displayOrder}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${friend.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>{friend.enabled ? '显示' : '停用'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1">{safeExternalHref(friend.url) && <a href={safeExternalHref(friend.url)} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800" title="访问"><ExternalLink className="h-4 w-4" /></a>}<button type="button" onClick={() => openEdit(friend)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10" title="编辑"><Edit2 className="h-4 w-4" /></button><button type="button" onClick={() => deleteFriend(friend.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="删除"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table>}</div> : <div><form onSubmit={event => { event.preventDefault(); loadMessages(0) }} className="mb-5 flex flex-wrap gap-3"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索昵称、邮箱、内容或关联标题" className="admin-input pl-9" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="admin-input w-auto"><option value="">全部状态</option><option value="visible">显示中</option><option value="hidden">已隐藏</option></select><button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white">查询</button></form><div className="space-y-3">{loading ? <div className="flex justify-center py-14 text-indigo-600 dark:text-indigo-300"><LoadingIndicator size={32} label="加载留言" /></div> : messages.length === 0 ? <div className="rounded-lg border border-gray-200 bg-white py-14 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900">暂无留言</div> : messages.map(message => { const targetUrl = guestMessageTargetUrl(message.target); const TargetIcon = message.target?.type === 'article' ? BookOpen : FolderKanban; return <article key={message.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-slate-100">{message.nickname}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${message.status === 'visible' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>{message.status === 'visible' ? '显示中' : '已隐藏'}</span><span className="text-xs text-gray-400">来源 {message.sourceKey}</span></div><div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500"><span>{message.email || '未留邮箱'}</span>{safeExternalHref(message.website) && <a href={safeExternalHref(message.website)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">个人网站</a>}<time>{formatDate(message.createdAt)}</time></div>{targetUrl && <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:underline dark:bg-indigo-500/10 dark:text-indigo-200"><TargetIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{message.target.type === 'article' ? '文章' : '项目'}：{message.target.title}</span></a>}<p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 dark:text-slate-200">{message.content}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => updateMessageStatus(message.id, message.status === 'visible' ? 'hidden' : 'visible')} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10" title={message.status === 'visible' ? '隐藏' : '恢复'}>{message.status === 'visible' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><button type="button" onClick={() => deleteMessage(message.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="删除"><Trash2 className="h-4 w-4" /></button></div></div></article> })}</div>{messagePages > 1 && <div className="mt-5 flex items-center justify-between"><button type="button" disabled={messagePage <= 0} onClick={() => loadMessages(messagePage - 1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">上一页</button><span className="text-sm text-gray-500">{messagePage + 1} / {messagePages}</span><button type="button" disabled={messagePage + 1 >= messagePages} onClick={() => loadMessages(messagePage + 1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">下一页</button></div>}</div>}

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-slate-800"><h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editing ? '编辑友链' : '新增友链'}</h2><button type="button" onClick={() => setShowForm(false)} title="关闭"><X className="h-5 w-5" /></button></div><form onSubmit={saveFriend} className="space-y-4 p-5"><label className="block text-sm font-medium">站点名称<input required maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="admin-input mt-2" /></label><label className="block text-sm font-medium">站点描述<textarea maxLength={300} rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="admin-input mt-2 resize-y" /></label><label className="block text-sm font-medium">站点链接<input required type="url" maxLength={500} placeholder="https://" value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} className="admin-input mt-2" /></label><label className="block text-sm font-medium">头像链接<input type="url" maxLength={500} placeholder="https://" value={form.avatarUrl} onChange={event => setForm({ ...form, avatarUrl: event.target.value })} className="admin-input mt-2" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">分类<input maxLength={40} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className="admin-input mt-2" /></label><label className="block text-sm font-medium">排序<input type="number" value={form.displayOrder} onChange={event => setForm({ ...form, displayOrder: event.target.value })} className="admin-input mt-2" /></label></div><label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-slate-800"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} /><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />在前台显示</span></label><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 dark:border-slate-700">取消</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white disabled:opacity-50">{saving && <LoadingIndicator size={16} />}保存</button></div></form></div></div>}
    </div>
  )
}
