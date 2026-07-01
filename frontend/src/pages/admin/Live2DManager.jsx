import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, Loader, Trash2, UploadCloud } from 'lucide-react'

const API_BASE = ''

export default function Live2DManager() {
  const token = localStorage.getItem('token')
  const directoryInputRef = useRef(null)
  const [models, setModels] = useState([])
  const [name, setName] = useState('')
  const [files, setFiles] = useState([])
  const [entryPath, setEntryPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const modelJsonFiles = useMemo(() => {
    return files
      .map(file => file.webkitRelativePath || file.name)
      .filter(path => path.toLowerCase().endsWith('model.json') || path.toLowerCase().endsWith('.model3.json'))
  }, [files])

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/live2d-models`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setModels(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFilesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    setFiles(selectedFiles)
    const firstModelJson = selectedFiles
      .map(file => file.webkitRelativePath || file.name)
      .find(path => path.toLowerCase().endsWith('.model3.json'))
      || selectedFiles
        .map(file => file.webkitRelativePath || file.name)
        .find(path => path.toLowerCase().endsWith('model.json'))
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
        const error = await res.json().catch(() => ({}))
        throw new Error(error.message || '上传失败')
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
      await loadModels()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7" style={{ color: 'var(--theme-primary)' }} />
            Live2D 管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">上传模型文件夹，并选择前台展示的 Live2D 形象</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={handleUpload} className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">上传模型</h2>

          <label className="block text-sm font-medium text-gray-700 mb-2">模型名称</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：Haru"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">模型文件夹</label>
          <input
            ref={directoryInputRef}
            type="file"
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={handleFilesChange}
            className="w-full px-4 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-purple-300 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-2">
            需要上传完整目录，入口文件必须是 Live2D 的 model.json 或 .model3.json；贴图、动作、物理文件会按原相对路径保存。
          </p>

          {modelJsonFiles.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">入口 JSON</label>
              <select
                value={entryPath}
                onChange={(event) => setEntryPath(event.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {modelJsonFiles.map(path => (
                  <option key={path} value={path}>{path}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !files.length}
            className="mt-5 w-full px-4 py-2.5 text-white rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
          >
            {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {uploading ? '上传中...' : '上传到服务器'}
          </button>
        </form>

        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">已上传形象</h2>
            {loading && <Loader className="w-5 h-5 animate-spin text-gray-400" />}
          </div>

          <div className="space-y-3">
            {models.length === 0 && !loading && (
              <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                还没有上传 Live2D 模型
              </div>
            )}

            {models.map(model => (
              <div key={model.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{model.name}</h3>
                    {model.active && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">当前启用</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{model.modelPath}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => activateModel(model.id)}
                    disabled={model.active}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    启用
                  </button>
                  <button
                    onClick={() => deleteModel(model.id)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
