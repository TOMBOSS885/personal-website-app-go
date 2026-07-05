import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, X, FileText, Tag, Calendar, Check, Loader, Save, Eye, Hash, UploadCloud, Image as ImageIcon, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import OptimizedImage from '../../components/OptimizedImage'

const API_BASE = ''
const RichTextEditor = lazy(() => import('../../components/RichTextEditor'))
const NEW_ARTICLE_DRAFT_KEY = 'article-draft-new'

export default function ArticleManager() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [coverImages, setCoverImages] = useState([])
  const [loadingCoverImages, setLoadingCoverImages] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [draftNotice, setDraftNotice] = useState('')
  const coverFileInputRef = useRef(null)
  const [form, setForm] = useState({ 
    title: '', 
    summary: '', 
    content: '', 
    category: '', 
    tags: [], 
    published: true,
    coverImage: ''
  })

  const token = localStorage.getItem('token')
  const totalPages = Math.max(1, Math.ceil(total / size))

  useEffect(() => {
    fetchArticles()
  }, [page, size])

  useEffect(() => {
    if (!showModal) return undefined
    const key = getDraftKey(editingArticle)
    const timer = window.setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({ ...form, savedAt: Date.now() }))
      setDraftNotice(`已自动保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [form, showModal, editingArticle])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const tokenValue = localStorage.getItem('token')
      const headers = {}
      if (tokenValue) {
        headers['Authorization'] = `Bearer ${tokenValue}`
      }
      
      const res = await fetch(`${API_BASE}/api/admin/articles?page=${page}&size=${size}`, { headers })
      
      if (!res.ok) {
        console.error('获取文章列表失败:', res.status)
        const text = await res.text()
        console.error('Error response:', text)
        setArticles([])
        return
      }
      
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.error('Invalid JSON response:', text)
        setArticles([])
        return
      }
      
      setArticles(Array.isArray(data) ? data : (data.content || []))
      setTotal(Number(data.totalElements || 0))
    } catch (err) {
      console.error('获取文章列表失败:', err)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCoverImages = async () => {
    setLoadingCoverImages(true)
    try {
      const tokenValue = localStorage.getItem('token')
      const headers = tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {}
      const res = await fetch(`${API_BASE}/api/admin/article-images`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCoverImages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('获取封面图库失败:', err)
      setCoverImages([])
    } finally {
      setLoadingCoverImages(false)
    }
  }

  const openCoverPicker = () => {
    setShowCoverPicker(true)
    fetchCoverImages()
  }

  const uploadCoverImage = async (file) => {
    if (!file) return

    setUploadingCover(true)
    try {
      const tokenValue = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/admin/article-images`, {
        method: 'POST',
        headers: tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {},
        body: formData
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const image = await res.json()
      setForm(current => ({ ...current, coverImage: image.url }))
      setCoverImages(current => [image, ...current])
    } catch (err) {
      console.error('上传封面图片失败:', err)
      alert('封面图片上传失败，请确认文件是 jpg、png、gif 或 webp，且大小不超过 10MB')
    } finally {
      setUploadingCover(false)
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = ''
      }
    }
  }

  const selectCoverImage = (url) => {
    setForm(current => ({ ...current, coverImage: url }))
    setShowCoverPicker(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    const url = editingArticle
      ? `${API_BASE}/api/admin/articles/${editingArticle.id}`
      : `${API_BASE}/api/admin/articles`
    const method = editingArticle ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...form, tags: form.tags.join(',') })
      })
      
      if (res.ok) {
        localStorage.removeItem(getDraftKey(editingArticle))
        setDraftNotice('')
        setShowModal(false)
        setEditingArticle(null)
        setForm({ 
          title: '', 
          summary: '', 
          content: '', 
          category: '', 
          tags: [], 
          published: true,
          coverImage: '' 
        })
        fetchArticles()
      } else {
        alert('保存失败，请重试')
      }
    } catch (err) {
      console.error('保存文章失败:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (article) => {
    const draft = loadDraft(getDraftKey(article))
    setEditingArticle(article)
    setForm({
      title: draft?.title ?? article.title,
      summary: draft?.summary ?? article.summary ?? '',
      content: draft?.content ?? article.content ?? '',
      category: draft?.category ?? article.category ?? '',
      tags: draft?.tags ?? (article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      published: draft?.published ?? article.published,
      coverImage: draft?.coverImage ?? article.coverImage ?? ''
    })
    setDraftNotice(draft ? '已恢复本地自动保存草稿' : '')
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这篇文章吗？此操作不可撤销。')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/articles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.ok) {
        fetchArticles()
      } else {
        alert('删除失败，请重试')
      }
    } catch (err) {
      console.error('删除文章失败:', err)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-purple-600" />
            文章管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理您的博客文章内容</p>
        </div>
        <button
          onClick={() => {
            const draft = loadDraft(NEW_ARTICLE_DRAFT_KEY)
            setEditingArticle(null)
            setForm(draft || {
              title: '', 
              summary: '', 
              content: '', 
              category: '', 
              tags: [], 
              published: true,
              coverImage: '' 
            })
            setDraftNotice(draft ? '已恢复本地自动保存草稿' : '')
            setShowModal(true)
          }}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          新建文章
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-purple-500" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无文章，点击上方按钮创建</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">标题</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">分类</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">阅读量</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.map(article => (
                <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{article.title}</div>
                    {article.summary && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {article.category ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                        <Tag className="w-3 h-3" />
                        {article.category}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                      article.published 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {article.published && <Check className="w-3 h-3" />}
                      {article.published ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Eye className="w-3 h-3" />
                      {article.views || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(article.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(article)} 
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(article.id)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span>共 {total} 篇</span>
          <select
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value))
              setPage(0)
            }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1"
          >
            {[10, 20, 50, 100].map(item => <option key={item} value={item}>{item} 条/页</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage(value => Math.max(0, value - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>
          <span className="rounded-lg bg-gray-100 px-3 py-2 text-gray-700">{page + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal - Full Screen Editor */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex">
          <div className="bg-white w-full h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-white" />
                <h2 className="text-lg font-semibold text-white">
                  {editingArticle ? '编辑文章' : '新建文章'}
                </h2>
                {form.title && (
                  <span className="text-white/80 text-sm">- {form.title}</span>
                )}
                {draftNotice && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs text-white/85">{draftNotice}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSubmit}
                  disabled={saving || !form.title}
                  className="px-4 py-2 bg-white rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  {saving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-2 text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Meta fields */}
              <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      标题 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="输入文章标题"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">封面图片</label>
                    <input
                      type="text"
                      placeholder="输入图片地址，或上传/选择服务器图片"
                      value={form.coverImage}
                      onChange={e => setForm({ ...form, coverImage: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                    />
                    <input
                      ref={coverFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => uploadCoverImage(e.target.files?.[0])}
                    />
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium disabled:opacity-50"
                      >
                        {uploadingCover ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        {uploadingCover ? '上传中' : '上传封面'}
                      </button>
                      <button
                        type="button"
                        onClick={openCoverPicker}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-medium"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        选择图片
                      </button>
                    </div>
                    {form.coverImage && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                        <OptimizedImage src={form.coverImage} alt="封面预览" className="w-full h-32 object-cover" wrapperClassName="block" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
                    <textarea
                      placeholder="简短描述文章内容"
                      value={form.summary}
                      onChange={e => setForm({ ...form, summary: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white resize-none"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                    <input
                      type="text"
                      placeholder="如：技术、生活"
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                    />
                  </div>
                  
                  {/* TagInput 组件 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
                    <TagInput 
                      tags={form.tags} 
                      onChange={(tags) => setForm({ ...form, tags })} 
                    />
                  </div>
                  
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-200">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={e => setForm({ ...form, published: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 flex items-center gap-1">
                      {form.published ? (
                        <><Eye className="w-4 h-4 text-green-500" /> 立即发布</>
                      ) : (
                        <><FileText className="w-4 h-4 text-gray-400" /> 保存为草稿</>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              {/* Right: Editor */}
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full">
                  <Suspense fallback={
                    <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
                      <Loader className="w-5 h-5 animate-spin text-purple-500" />
                    </div>
                  }>
                    <RichTextEditor
                      value={form.content}
                      onChange={(val) => setForm({ ...form, content: val })}
                      height={600}
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCoverPicker && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-pink-500">
              <div>
                <h3 className="text-lg font-semibold text-white">选择封面图片</h3>
                <p className="text-xs text-white/75 mt-0.5">从服务器文章图片中选择，或上传一张新封面</p>
              </div>
              <button type="button" onClick={() => setShowCoverPicker(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                disabled={uploadingCover}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {uploadingCover ? <Loader className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploadingCover ? '上传中...' : '上传封面'}
              </button>
              <button
                type="button"
                onClick={fetchCoverImages}
                disabled={loadingCoverImages}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingCoverImages ? 'animate-spin' : ''}`} />
                刷新图库
              </button>
              <span className="text-xs text-gray-500">选择后会立即显示在封面预览中</span>
            </div>

            <div className="p-4 overflow-y-auto">
              {loadingCoverImages ? (
                <div className="py-12 flex items-center justify-center text-gray-500">
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  加载图片中...
                </div>
              ) : coverImages.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  服务器还没有文章图片，可以先上传一张封面
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {coverImages.map((image) => (
                    <button
                      type="button"
                      key={image.url}
                      onClick={() => selectCoverImage(image.url)}
                      className={`group text-left rounded-xl border overflow-hidden hover:border-purple-300 hover:shadow-lg transition-all bg-white ${
                        form.coverImage === image.url ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <OptimizedImage src={image.url} alt={image.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" wrapperClassName="block w-full h-full" />
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-medium text-gray-700 truncate">{image.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{formatImageSize(image.size)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatImageSize(size) {
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getDraftKey(article) {
  return article?.id ? `article-draft-${article.id}` : NEW_ARTICLE_DRAFT_KEY
}

function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { savedAt, ...draft } = parsed
    const hasContent = draft.title || draft.summary || draft.content || draft.coverImage || draft.category || draft.tags?.length
    return hasContent ? draft : null
  } catch {
    return null
  }
}

// ========== TagInput 组件 ==========
function TagInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  const addTag = (tagText) => {
    const tag = tagText.trim()
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInputValue('')
  }

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, i) => i !== indexToRemove))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === ',' || e.key === '，') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 bg-white flex flex-wrap items-center gap-2 min-h-[46px]">
      {tags.map((tag, index) => (
        <motion.span
          key={tag}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
        >
          <Hash className="w-3 h-3" />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="ml-0.5 hover:text-purple-900 hover:bg-purple-200 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? '输入标签后按回车或逗号添加' : '继续添加...'}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm py-1"
      />
    </div>
  )
}
