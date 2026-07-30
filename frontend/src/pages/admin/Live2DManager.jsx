import { useEffect, useRef, useState } from 'react'
import { Bot, Check, FolderUp, HardDrive, Loader, Save, Trash2 } from 'lucide-react'
import { buildLive2DBundle, createLive2DSelection } from '../../utils/live2dImport'

const DEFAULT_SETTINGS = {
  enabled: false,
  position: 'bottom-right',
  size: 240,
}

export default function Live2DManager() {
  const inputRef = useRef(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [models, setModels] = useState([])
  const [maxModels, setMaxModels] = useState(3)
  const [selection, setSelection] = useState({ items: [], entries: [], sourceBytes: 0 })
  const [entryPath, setEntryPath] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [progress, setProgress] = useState(null)

  const loadState = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/live2d', { cache: 'no-store' })
      const data = await readJson(response, '加载 Live2D 设置失败')
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) })
      setModels(Array.isArray(data.models) ? data.models : [])
      setMaxModels(Number(data.maxModels) || 3)
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  const handleFolderChange = event => {
    try {
      const nextSelection = createLive2DSelection(event.target.files)
      if (nextSelection.entries.length === 0) throw new Error('目录中没有 model.json 或 .model3.json')
      setSelection(nextSelection)
      setEntryPath(nextSelection.entries[0])
      const firstPath = event.target.files?.[0]?.webkitRelativePath || ''
      if (!name && firstPath) setName(firstPath.split('/')[0])
      setProgress(null)
    } catch (error) {
      event.target.value = ''
      setSelection({ items: [], entries: [], sourceBytes: 0 })
      setEntryPath('')
      alert(error.message)
    }
  }

  const handleImport = async event => {
    event.preventDefault()
    if (!selection.items.length || !entryPath) return
    setImporting(true)
    try {
      const prepared = await buildLive2DBundle(selection, entryPath, setProgress)
      const formData = new FormData()
      formData.append('name', name.trim() || 'Live2D 模型')
      formData.append('bundle', prepared.bundle, 'model.l2dbundle')
      const response = await fetch('/api/admin/live2d/import', { method: 'POST', body: formData })
      await readJson(response, '导入 Live2D 模型失败')
      setSelection({ items: [], entries: [], sourceBytes: 0 })
      setEntryPath('')
      setName('')
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
      await loadState()
    } catch (error) {
      alert(error.message)
    } finally {
      setImporting(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const response = await fetch('/api/admin/live2d/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSettings(await readJson(response, '保存 Live2D 设置失败'))
    } catch (error) {
      alert(error.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const updateModel = (id, patch) => {
    setModels(current => current.map(model => model.id === id ? { ...model, ...patch } : model))
  }

  const saveModel = async model => {
    try {
      const response = await fetch(`/api/admin/live2d/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      })
      const saved = await readJson(response, '保存模型参数失败')
      setModels(current => current.map(item => item.id === saved.id ? saved : item))
    } catch (error) {
      alert(error.message)
    }
  }

  const activateModel = async id => {
    try {
      const response = await fetch(`/api/admin/live2d/models/${id}/activate`, { method: 'PUT' })
      const data = await readJson(response, '启用模型失败')
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) })
      setModels(data.models || [])
    } catch (error) {
      alert(error.message)
    }
  }

  const deleteModel = async model => {
    if (!confirm(`确定删除 ${model.name} 及其全部模型文件吗？`)) return
    try {
      const response = await fetch(`/api/admin/live2d/models/${model.id}`, { method: 'DELETE' })
      await readJson(response, '删除模型失败')
      await loadState()
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader className="h-6 w-6 animate-spin text-indigo-500" /></div>
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <Bot className="h-7 w-7 text-indigo-500" />Live2D 管理
        </h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-slate-100">
            <FolderUp className="h-5 w-5" />导入模型
          </h2>
          <form className="space-y-4" onSubmit={handleImport}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="模型名称">
                <input className="admin-input" value={name} onChange={event => setName(event.target.value)} maxLength={80} />
              </Field>
              <Field label="模型入口">
                <select className="admin-input" value={entryPath} onChange={event => setEntryPath(event.target.value)} disabled={!selection.entries.length}>
                  {selection.entries.map(path => <option key={path} value={path}>{path}</option>)}
                </select>
              </Field>
            </div>
            <input
              ref={inputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderChange}
              className="block w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 dark:border-slate-700 dark:text-slate-300"
            />
            {selection.items.length > 0 && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-slate-800">
                <Metric label="原始文件" value={selection.items.length} />
                <Metric label="原始大小" value={formatBytes(selection.sourceBytes)} />
                <Metric label="入口数量" value={selection.entries.length} />
              </div>
            )}
            {progress && (
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (progress.completed / Math.max(1, progress.total)) * 100)}%` }} />
              </div>
            )}
            <button type="submit" disabled={importing || !entryPath || models.length >= maxModels} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {importing ? <Loader className="h-4 w-4 animate-spin" /> : <FolderUp className="h-4 w-4" />}
              {importing ? '压缩并导入中' : '导入文件夹'}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-slate-100">显示设置</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-slate-200">
              前台启用
              <input type="checkbox" checked={settings.enabled} onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4" />
            </label>
            <Field label="位置">
              <select className="admin-input" value={settings.position} onChange={event => setSettings(current => ({ ...current, position: event.target.value }))}>
                <option value="bottom-right">右下角</option>
                <option value="bottom-left">左下角</option>
              </select>
            </Field>
            <Field label="画布尺寸">
              <input className="admin-input" type="number" min="160" max="420" value={settings.size} onChange={event => setSettings(current => ({ ...current, size: Number(event.target.value) }))} />
            </Field>
            <button type="button" onClick={saveSettings} disabled={savingSettings} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {savingSettings ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存设置
            </button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-slate-100"><HardDrive className="h-5 w-5" />已导入模型</h2>
          <span className="text-sm text-gray-500">{models.length}/{maxModels}</span>
        </div>
        {models.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">暂无模型</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {models.map(model => (
              <div key={model.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(12rem,1fr)_repeat(3,7rem)_auto] lg:items-end">
                <Field label="名称">
                  <input className="admin-input" value={model.name} onChange={event => updateModel(model.id, { name: event.target.value })} />
                </Field>
                <Field label="缩放">
                  <input className="admin-input" type="number" min="0.2" max="3" step="0.1" value={model.scale} onChange={event => updateModel(model.id, { scale: Number(event.target.value) })} />
                </Field>
                <Field label="X 偏移">
                  <input className="admin-input" type="number" min="-2" max="2" step="0.1" value={model.offsetX} onChange={event => updateModel(model.id, { offsetX: Number(event.target.value) })} />
                </Field>
                <Field label="Y 偏移">
                  <input className="admin-input" type="number" min="-2" max="2" step="0.1" value={model.offsetY} onChange={event => updateModel(model.id, { offsetY: Number(event.target.value) })} />
                </Field>
                <div className="flex items-center justify-end gap-2">
                  <span className="mr-2 whitespace-nowrap text-xs text-gray-500">{formatBytes(model.storageBytes)}</span>
                  <IconButton label="保存" onClick={() => saveModel(model)}><Save className="h-4 w-4" /></IconButton>
                  <IconButton label="设为当前" onClick={() => activateModel(model.id)} disabled={model.active}><Check className="h-4 w-4" /></IconButton>
                  <IconButton label="删除" danger onClick={() => deleteModel(model)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`.admin-input{width:100%;height:2.5rem;border:1px solid #d1d5db;border-radius:.5rem;padding:0 .75rem;background:#fff;color:#111827}.dark .admin-input{border-color:#475569;background:#0f172a;color:#e2e8f0}`}</style>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">{label}</span>{children}</label>
}

function Metric({ label, value }) {
  return <div><div className="text-xs text-gray-500">{label}</div><div className="mt-1 font-semibold text-gray-800 dark:text-slate-100">{value}</div></div>
}

function IconButton({ label, danger = false, disabled = false, onClick, children }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-40 ${danger ? 'border-red-100 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{children}</button>
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function readJson(response, fallback) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || `${fallback}（HTTP ${response.status}）`)
  return data
}
