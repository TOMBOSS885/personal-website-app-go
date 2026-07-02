import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Check,
  ImageOff,
  Loader,
  MessageCircle,
  MonitorSmartphone,
  Palette,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import OptimizedImage from '../../components/OptimizedImage'

const API_BASE = ''

const defaultSettings = {
  enabled: true,
  position: 'bottom-right',
  size: 280,
  primaryColor: 'rgba(96,165,250,0.92)',
  transitionType: 'slide',
  transitionDuration: 1500,
  menuAlign: 'right',
  showSleepButton: true,
  showAboutButton: false,
}

export default function Live2DManager() {
  const token = localStorage.getItem('token')
  const directoryInputRef = useRef(null)
  const [settings, setSettings] = useState(defaultSettings)
  const [models, setModels] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [name, setName] = useState('')
  const [files, setFiles] = useState([])
  const [entryPath, setEntryPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingModel, setSavingModel] = useState(false)
  const [uploading, setUploading] = useState(false)

  const selectedModel = models.find(model => model.id === selectedId)

  const modelJsonFiles = useMemo(() => {
    return files
      .map(file => file.webkitRelativePath || file.name)
      .filter(path => path.toLowerCase().endsWith('model.json') || path.toLowerCase().endsWith('.model3.json'))
  }, [files])

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    if (selectedModel) {
      setDraft({ ...selectedModel })
    } else {
      setDraft(null)
    }
  }, [selectedModel])

  const loadModels = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/live2d-models`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const nextModels = data.models || []
        setSettings({ ...defaultSettings, ...(data.settings || {}) })
        setModels(nextModels)
        setSelectedId(current => current || nextModels[0]?.id || null)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFilesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    setFiles(selectedFiles)
    const paths = selectedFiles.map(file => file.webkitRelativePath || file.name)
    const firstModelJson = paths.find(path => path.toLowerCase().endsWith('.model3.json'))
      || paths.find(path => path.toLowerCase().endsWith('model.json'))
      || ''

    setEntryPath(firstModelJson)
    if (!name && selectedFiles[0]?.webkitRelativePath) {
      setName(selectedFiles[0].webkitRelativePath.split('/')[0])
    }
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!files.length || !entryPath) {
      alert('请选择完整的 Live2D 模型文件夹，并确认其中包含 model.json 或 .model3.json')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('name', name || 'Live2D 模型')
      formData.append('entryPath', entryPath)
      files.forEach(file => {
        formData.append('files', file)
        formData.append('paths', file.webkitRelativePath || file.name)
      })

      const res = await fetch(`${API_BASE}/api/admin/live2d-models`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const error = contentType.includes('application/json')
          ? await res.json().catch(() => ({}))
          : { message: await res.text().catch(() => '') }
        throw new Error(error.message || `上传失败，HTTP ${res.status}`)
      }

      setName('')
      setFiles([])
      setEntryPath('')
      if (directoryInputRef.current) {
        directoryInputRef.current.value = ''
      }
      await loadModels()
      alert('Live2D 模型已上传')
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/live2d-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '保存全局设置失败'))
      }
      setSettings(await res.json())
      alert('Live2D 全局设置已保存')
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const saveModel = async () => {
    if (!draft) {
      return
    }

    setSavingModel(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/live2d-models/${draft.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, '保存模型设置失败'))
      }
      const saved = await res.json()
      setModels(prev => prev.map(model => model.id === saved.id ? saved : model))
      alert('模型高级设置已保存')
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingModel(false)
    }
  }

  const activateModel = async (id) => {
    const res = await fetch(`${API_BASE}/api/admin/live2d-models/${id}/activate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      await loadModels()
    }
  }

  const deleteModel = async (id) => {
    if (!confirm('确定删除这个 Live2D 模型吗？服务器中的模型文件也会一起删除。')) {
      return
    }

    const res = await fetch(`${API_BASE}/api/admin/live2d-models/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      if (selectedId === id) {
        setSelectedId(null)
      }
      await loadModels()
    }
  }

  const updateSettings = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateDraft = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7" style={{ color: 'var(--theme-primary)' }} />
            Live2D 管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">上传形象，配置多模型切换、气泡文字、嘴型同步和显示效果</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <SectionTitle icon={UploadCloud} title="上传模型" />
            <Field label="模型名称">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：xiaoyue"
                className="input"
              />
            </Field>
            <Field label="模型文件夹">
              <input
                ref={directoryInputRef}
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleFilesChange}
                className="w-full px-4 py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-300 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-2">
                请选择完整目录，入口文件必须是 model.json 或 .model3.json。
              </p>
            </Field>
            {modelJsonFiles.length > 0 && (
              <Field label="入口 JSON">
                <select value={entryPath} onChange={(event) => setEntryPath(event.target.value)} className="input">
                  {modelJsonFiles.map(path => (
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              </Field>
            )}
            <PrimaryButton disabled={uploading || !files.length}>
              {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? '上传中...' : '上传到服务器'}
            </PrimaryButton>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={Bot} title="已上传形象" compact />
              {loading && <Loader className="w-5 h-5 animate-spin text-gray-400" />}
            </div>
            <div className="space-y-3">
              {models.length === 0 && !loading && (
                <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  还没有上传 Live2D 模型
                </div>
              )}
              {models.map(model => (
                <div
                  key={model.id}
                  className={`border rounded-lg p-3 transition-colors ${selectedId === model.id ? 'border-purple-300 bg-purple-50/40' : 'border-gray-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(model.id)}
                      className="w-16 h-16 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0"
                    >
                      {model.thumbnailPath ? (
                        <OptimizedImage src={model.thumbnailPath} alt={model.name} className="w-full h-full object-contain" wrapperClassName="block w-full h-full" />
                      ) : (
                        <div className="text-center text-gray-400 px-2">
                          <ImageOff className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-[10px] leading-tight">无图</span>
                        </div>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{model.name}</h3>
                        {model.active && <span className="tag bg-green-50 text-green-700">默认</span>}
                        {model.switchable && <span className="tag bg-blue-50 text-blue-700">可切换</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">{model.modelPath}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => setSelectedId(model.id)} className="secondary-btn">
                      <Settings className="w-4 h-4" />
                      编辑
                    </button>
                    <button onClick={() => activateModel(model.id)} disabled={model.active} className="secondary-btn disabled:opacity-50">
                      <Check className="w-4 h-4" />
                      默认
                    </button>
                    <button onClick={() => deleteModel(model.id)} className="icon-danger" title="删除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <SectionTitle icon={MonitorSmartphone} title="全局显示设置" compact />
              <button onClick={saveSettings} disabled={savingSettings} className="save-btn">
                {savingSettings ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存全局设置
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Toggle label="启用前台 Live2D" checked={settings.enabled} onChange={value => updateSettings('enabled', value)} />
              <Toggle label="显示休眠按钮" checked={settings.showSleepButton} onChange={value => updateSettings('showSleepButton', value)} />
              <Toggle label="显示关于按钮" checked={settings.showAboutButton} onChange={value => updateSettings('showAboutButton', value)} />
              <SelectField label="显示位置" value={settings.position} onChange={value => updateSettings('position', value)} options={[
                ['bottom-right', '右下角'],
                ['bottom-left', '左下角'],
              ]} />
              <SelectField label="菜单方向" value={settings.menuAlign} onChange={value => updateSettings('menuAlign', value)} options={[
                ['right', '右侧'],
                ['left', '左侧'],
              ]} />
              <SelectField label="过渡动画" value={settings.transitionType} onChange={value => updateSettings('transitionType', value)} options={[
                ['slide', '滑入滑出'],
                ['fade', '淡入淡出'],
              ]} />
              <NumberField label="画布尺寸(px)" value={settings.size} onChange={value => updateSettings('size', value)} min={160} max={600} />
              <NumberField label="动画时长(ms)" value={settings.transitionDuration} onChange={value => updateSettings('transitionDuration', value)} min={0} max={5000} />
              <Field label="主题颜色">
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={rgbaToHex(settings.primaryColor)}
                    onChange={(event) => updateSettings('primaryColor', `${event.target.value}`)}
                    className="w-12 h-11 rounded-lg border border-gray-200"
                  />
                  <input value={settings.primaryColor} onChange={(event) => updateSettings('primaryColor', event.target.value)} className="input" />
                </div>
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <SectionTitle icon={SlidersHorizontal} title={draft ? `高级设置：${draft.name}` : '单模型高级设置'} compact />
              <button onClick={saveModel} disabled={!draft || savingModel} className="save-btn disabled:opacity-50">
                {savingModel ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存模型设置
              </button>
            </div>

            {!draft ? (
              <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
                请选择一个已上传形象进行高级配置
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <SectionTitle icon={Palette} title="模型管理" compact />
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <Field label="模型名称">
                      <input value={draft.name || ''} onChange={(event) => updateDraft('name', event.target.value)} className="input" />
                    </Field>
                    <NumberField label="排序" value={draft.displayOrder} onChange={value => updateDraft('displayOrder', value)} min={0} max={999} />
                    <Toggle label="加入前台多模型切换" checked={draft.switchable} onChange={value => updateDraft('switchable', value)} />
                  </div>
                </div>

                <div>
                  <SectionTitle icon={SlidersHorizontal} title="姿态与声音" compact />
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <NumberField label="缩放" value={draft.scale} onChange={value => updateDraft('scale', value)} min={0.2} max={3} step={0.1} />
                    <NumberField label="音量" value={draft.volume} onChange={value => updateDraft('volume', value)} min={0} max={1} step={0.1} />
                    <NumberField label="X 偏移" value={draft.offsetX} onChange={value => updateDraft('offsetX', value)} min={-2} max={2} step={0.1} />
                    <NumberField label="Y 偏移" value={draft.offsetY} onChange={value => updateDraft('offsetY', value)} min={-2} max={2} step={0.1} />
                  </div>
                </div>

                <div>
                  <SectionTitle icon={MessageCircle} title="气泡文字" compact />
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <Toggle label="启用气泡" checked={draft.tipsEnabled} onChange={value => updateDraft('tipsEnabled', value)} />
                    <Toggle label="启用打字动画/嘴型同步" checked={draft.typingEnabled} onChange={value => updateDraft('typingEnabled', value)} />
                    <Field label="欢迎语（一行一条）">
                      <textarea value={draft.welcomeMessages || ''} onChange={(event) => updateDraft('welcomeMessages', event.target.value)} className="textarea" rows={5} />
                    </Field>
                    <Field label="循环提示（一行一条）">
                      <textarea value={draft.tipMessages || ''} onChange={(event) => updateDraft('tipMessages', event.target.value)} className="textarea" rows={5} />
                    </Field>
                    <NumberField label="显示时长(ms)" value={draft.tipDuration} onChange={value => updateDraft('tipDuration', value)} min={500} max={30000} />
                    <NumberField label="循环间隔(ms)" value={draft.tipInterval} onChange={value => updateDraft('tipInterval', value)} min={1000} max={60000} />
                    <NumberField label="气泡 X 偏移(px)" value={draft.tipOffsetX} onChange={value => updateDraft('tipOffsetX', value)} min={-300} max={300} />
                    <NumberField label="气泡 Y 偏移(px)" value={draft.tipOffsetY} onChange={value => updateDraft('tipOffsetY', value)} min={-300} max={300} />
                    <Field label="嘴型参数名">
                      <input value={draft.typingParam || ''} onChange={(event) => updateDraft('typingParam', event.target.value)} placeholder="PARAM_MOUTH_OPEN_Y" className="input" />
                    </Field>
                    <NumberField label="打字速度(ms/字)" value={draft.typingSpeed} onChange={value => updateDraft('typingSpeed', value)} min={20} max={1000} />
                    <NumberField label="嘴型最小值" value={draft.typingMinValue} onChange={value => updateDraft('typingMinValue', value)} min={0} max={1} step={0.1} />
                    <NumberField label="嘴型最大值" value={draft.typingMaxValue} onChange={value => updateDraft('typingMaxValue', value)} min={0} max={1} step={0.1} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus, .textarea:focus {
          border-color: #a855f7;
          box-shadow: 0 0 0 2px rgba(168,85,247,0.15);
        }
        .textarea {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          resize: vertical;
        }
        .save-btn, .secondary-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          color: #374151;
          background: white;
          font-size: 0.875rem;
        }
        .save-btn:hover, .secondary-btn:hover {
          background: #f9fafb;
        }
        .icon-danger {
          padding: 0.5rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          color: #6b7280;
        }
        .icon-danger:hover {
          color: #dc2626;
          background: #fef2f2;
        }
        .tag {
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          font-size: 0.75rem;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, compact = false }) {
  return (
    <h2 className={`font-semibold text-gray-900 flex items-center gap-2 ${compact ? 'text-base' : 'text-lg mb-4'}`}>
      <Icon className="w-5 h-5" style={{ color: 'var(--theme-primary)' }} />
      {title}
    </h2>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      {children}
    </label>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-lg">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        className="w-5 h-5 rounded border-gray-300"
      />
    </label>
  )
}

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="input"
      />
    </Field>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </Field>
  )
}

function PrimaryButton({ children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 w-full px-4 py-2.5 text-white rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
    >
      {children}
    </button>
  )
}

function rgbaToHex(value) {
  if (typeof value !== 'string') {
    return '#60a5fa'
  }
  if (value.startsWith('#')) {
    return value.slice(0, 7)
  }
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) {
    return '#60a5fa'
  }
  return `#${[match[1], match[2], match[3]].map(part => Number(part).toString(16).padStart(2, '0')).join('')}`
}

async function readErrorMessage(res, fallback) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const error = await res.json().catch(() => ({}))
    return error.message || `${fallback}，HTTP ${res.status}`
  }
  const text = await res.text().catch(() => '')
  return text || `${fallback}，HTTP ${res.status}`
}
