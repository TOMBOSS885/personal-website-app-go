import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X, Loader, LayoutGrid, Code, Database, Globe, Rocket, PenTool, Briefcase, Sparkles, Zap, Cpu } from 'lucide-react'

const API_BASE = ''

const iconOptions = [
  { value: 'Code', label: '代码', icon: Code },
  { value: 'Database', label: '数据库', icon: Database },
  { value: 'Globe', label: '网站', icon: Globe },
  { value: 'Rocket', label: '火箭', icon: Rocket },
  { value: 'PenTool', label: '写作', icon: PenTool },
  { value: 'Briefcase', label: '业务', icon: Briefcase },
  { value: 'Sparkles', label: '亮点', icon: Sparkles },
  { value: 'Zap', label: '效率', icon: Zap },
  { value: 'Cpu', label: '技术', icon: Cpu },
]

const gradientOptions = [
  { value: 'from-blue-500 to-cyan-500', label: '蓝青' },
  { value: 'from-purple-500 to-pink-500', label: '紫粉' },
  { value: 'from-amber-500 to-orange-500', label: '橙黄' },
  { value: 'from-emerald-500 to-teal-500', label: '绿青' },
  { value: 'from-rose-500 to-red-500', label: '玫红' },
  { value: 'from-slate-600 to-gray-800', label: '深灰' },
]

const emptyForm = {
  title: '',
  titleEn: '',
  description: '',
  descriptionEn: '',
  icon: 'Code',
  gradient: 'from-blue-500 to-cyan-500',
  displayOrder: 0,
  enabled: true,
}

export default function FeatureCardManager() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const token = sessionStorage.getItem('token')

  useEffect(() => { fetchCards() }, [])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/feature-cards`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCards(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('获取能力卡片失败:', err)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingCard(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (card) => {
    setEditingCard(card)
    setForm({
      title: card.title || '',
      titleEn: card.titleEn || '',
      description: card.description || '',
      descriptionEn: card.descriptionEn || '',
      icon: card.icon || 'Code',
      gradient: card.gradient || 'from-blue-500 to-cyan-500',
      displayOrder: card.displayOrder ?? 0,
      enabled: card.enabled ?? true,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const url = editingCard
      ? `${API_BASE}/api/admin/feature-cards/${editingCard.id}`
      : `${API_BASE}/api/admin/feature-cards`
    const method = editingCard ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          displayOrder: Number(form.displayOrder),
          enabled: Boolean(form.enabled)
        })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setShowModal(false)
      setEditingCard(null)
      setForm(emptyForm)
      fetchCards()
    } catch (err) {
      console.error('保存能力卡片失败:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这张能力卡片吗？')) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/feature-cards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fetchCards()
    } catch (err) {
      console.error('删除能力卡片失败:', err)
      alert('删除失败，请重试')
    }
  }

  const getIcon = (name) => iconOptions.find(option => option.value === name)?.icon || Code

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-purple-600" />
            能力卡片
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理首页“我能做什么 / 专业技能”模块的四张展示卡片</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          添加能力卡片
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-purple-500" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无能力卡片，点击上方按钮添加</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">卡片</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">图标/颜色</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">排序</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cards.map(card => {
                const Icon = getIcon(card.icon)
                return (
                  <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{card.title}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{card.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex w-10 h-10 rounded-xl items-center justify-center bg-gradient-to-r ${card.gradient || 'from-blue-500 to-cyan-500'} text-white shadow`}>
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="text-xs text-gray-500">{card.icon}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{card.displayOrder ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${card.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {card.enabled ? '显示' : '隐藏'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(card)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="编辑">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(card.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-pink-500">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <LayoutGrid className="w-5 h-5" />
                {editingCard ? '编辑能力卡片' : '添加能力卡片'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="中文标题 *">
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="admin-input" required />
                </Field>
                <Field label="英文标题">
                  <input value={form.titleEn} onChange={e => setForm({ ...form, titleEn: e.target.value })} className="admin-input" />
                </Field>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="中文描述">
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="admin-input resize-none" />
                </Field>
                <Field label="英文描述">
                  <textarea value={form.descriptionEn} onChange={e => setForm({ ...form, descriptionEn: e.target.value })} rows={3} className="admin-input resize-none" />
                </Field>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Field label="图标">
                  <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="admin-input">
                    {iconOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="颜色">
                  <select value={form.gradient} onChange={e => setForm({ ...form, gradient: e.target.value })} className="admin-input">
                    {gradientOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="排序">
                  <input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} className="admin-input" />
                </Field>
              </div>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer border border-gray-200">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-700">在首页显示这张卡片</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                  取消
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 px-4 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}>
                  {saving ? <><Loader className="w-4 h-4 animate-spin" />保存中...</> : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
