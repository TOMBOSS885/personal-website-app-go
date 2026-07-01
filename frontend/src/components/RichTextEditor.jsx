import { useCallback, useEffect, useRef, useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link2,
  Image, Table, Minus, Eye, EyeOff, Maximize2, Minimize2,
  UploadCloud, Loader, RefreshCw, X
} from 'lucide-react'

const API_BASE = ''

export default function RichTextEditor({ value, onChange, height = 500 }) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState('edit')
  const [fullscreen, setFullscreen] = useState(false)
  const [showImageLibrary, setShowImageLibrary] = useState(false)
  const [images, setImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploading, setUploading] = useState(false)

  const focusAt = (position) => {
    window.setTimeout(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(position, position)
    }, 0)
  }

  const insertText = useCallback((text, cursorOffset = 0) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextValue = value.substring(0, start) + text + value.substring(end)
    onChange(nextValue)
    focusAt(start + text.length - cursorOffset)
  }, [value, onChange])

  const wrapSelection = useCallback((before, after, placeholder) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const body = selectedText || placeholder
    const text = `${before}${body}${after}`
    const nextValue = value.substring(0, start) + text + value.substring(end)
    onChange(nextValue)

    if (selectedText) {
      focusAt(start + text.length)
    } else {
      window.setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + before.length, start + before.length + placeholder.length)
      }, 0)
    }
  }, [value, onChange])

  const handleCommand = useCallback((command) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    switch (command) {
      case 'bold':
        wrapSelection('**', '**', '粗体文本')
        break
      case 'italic':
        wrapSelection('*', '*', '斜体文本')
        break
      case 'h1':
        insertText(`\n# ${selectedText || '标题1'}\n`, selectedText ? 0 : 4)
        break
      case 'h2':
        insertText(`\n## ${selectedText || '标题2'}\n`, selectedText ? 0 : 4)
        break
      case 'h3':
        insertText(`\n### ${selectedText || '标题3'}\n`, selectedText ? 0 : 4)
        break
      case 'ul':
        insertText(`\n- ${selectedText || '列表项'}\n`, selectedText ? 0 : 4)
        break
      case 'ol':
        insertText(`\n1. ${selectedText || '列表项'}\n`, selectedText ? 0 : 4)
        break
      case 'quote':
        insertText(`\n> ${selectedText || '引用内容'}\n`, selectedText ? 0 : 5)
        break
      case 'code':
        if (selectedText.includes('\n')) {
          insertText(`\n\`\`\`\n${selectedText || '代码块'}\n\`\`\`\n`, selectedText ? 0 : 5)
        } else {
          wrapSelection('`', '`', '代码')
        }
        break
      case 'link':
        insertText(`[${selectedText || '链接文本'}](url)`, selectedText ? 4 : 5)
        break
      case 'image':
        setShowImageLibrary(true)
        break
      case 'table':
        insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n')
        break
      case 'hr':
        insertText('\n---\n')
        break
      default:
        break
    }
  }, [insertText, value, wrapSelection])

  const fetchImages = useCallback(async () => {
    setLoadingImages(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/admin/article-images`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setImages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载文章图片失败:', err)
      setImages([])
    } finally {
      setLoadingImages(false)
    }
  }, [])

  useEffect(() => {
    if (showImageLibrary) {
      fetchImages()
    }
  }, [fetchImages, showImageLibrary])

  const uploadImage = async (file) => {
    if (!file) return

    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/admin/article-images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      const image = await res.json()
      setImages(prev => [image, ...prev])
      insertImage(image.url, image.name)
    } catch (err) {
      console.error('上传文章图片失败:', err)
      alert('图片上传失败，请确认文件是 jpg、png、gif 或 webp，且大小不超过 10MB')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const insertImage = (url, name = '图片') => {
    const alt = name.replace(/\.[^.]+$/, '') || '图片'
    insertText(`![${alt}](${url})`)
    setShowImageLibrary(false)
  }

  const toolbarItems = [
    { command: 'bold', icon: Bold, title: '粗体 (Ctrl+B)' },
    { command: 'italic', icon: Italic, title: '斜体 (Ctrl+I)' },
    { command: 'h1', icon: Heading1, title: '标题1' },
    { command: 'h2', icon: Heading2, title: '标题2' },
    { command: 'h3', icon: Heading3, title: '标题3' },
    { command: 'ul', icon: List, title: '无序列表' },
    { command: 'ol', icon: ListOrdered, title: '有序列表' },
    { command: 'quote', icon: Quote, title: '引用' },
    { command: 'code', icon: Code, title: '代码块' },
    { command: 'link', icon: Link2, title: '链接' },
    { command: 'image', icon: Image, title: '服务器图片' },
    { command: 'table', icon: Table, title: '表格' },
    { command: 'hr', icon: Minus, title: '分割线' },
  ]

  const editorHeight = fullscreen ? 'calc(100vh - 112px)' : height

  return (
    <div className={`rich-text-editor ${fullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded-t-xl border-b-0">
        {toolbarItems.map(({ command, icon: Icon, title }) => (
          <button
            key={command}
            type="button"
            onClick={() => handleCommand(command)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            title={title}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-2" />

        <button
          type="button"
          onClick={() => setPreview(preview === 'edit' ? 'live' : 'edit')}
          className={`p-2 rounded-lg transition-colors ${preview === 'live' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-200 text-gray-600'}`}
          title={preview === 'live' ? '隐藏预览' : '左右预览'}
        >
          {preview === 'live' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setPreview('preview')}
          className={`p-2 rounded-lg transition-colors ${preview === 'preview' ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-200 text-gray-600'}`}
          title="仅预览"
        >
          <Eye className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        <button
          type="button"
          onClick={() => setFullscreen(!fullscreen)}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
          title={fullscreen ? '退出全屏' : '全屏编辑'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="border border-gray-200 rounded-b-xl overflow-hidden bg-white" style={{ height: editorHeight }}>
        {preview === 'preview' ? (
          <div className="h-full overflow-auto p-5 article-content article-editor-preview">
            <MDEditor.Markdown source={value || ' '} />
          </div>
        ) : (
          <div className={`h-full ${preview === 'live' ? 'grid md:grid-cols-2' : ''}`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              className="markdown-editor-textarea"
              placeholder={'开始编写文章内容...\n\n支持 Markdown：\n- **粗体** 和 *斜体*\n- # 标题\n- [链接](url)\n- 点击图片按钮上传或选择服务器图片\n- `代码` 和代码块\n- 表格、列表、引用'}
            />
            {preview === 'live' && (
              <div className="hidden md:block h-full overflow-auto p-5 border-l border-gray-200 article-content article-editor-preview">
                <MDEditor.Markdown source={value || ' '} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
        <span>快捷键：</span>
        <span><kbd>Ctrl+B</kbd> 粗体</span>
        <span><kbd>Ctrl+I</kbd> 斜体</span>
        <span>点击图片按钮可上传或选择服务器图片</span>
      </div>

      {showImageLibrary && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-pink-500">
              <div>
                <h3 className="text-lg font-semibold text-white">文章图片</h3>
                <p className="text-xs text-white/75 mt-0.5">上传图片或从服务器图库中选择，自动插入到正文</p>
              </div>
              <button type="button" onClick={() => setShowImageLibrary(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => uploadImage(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploading ? '上传中...' : '上传图片'}
              </button>
              <button
                type="button"
                onClick={fetchImages}
                disabled={loadingImages}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingImages ? 'animate-spin' : ''}`} />
                刷新图库
              </button>
              <span className="text-xs text-gray-500">支持 jpg、png、gif、webp，单张不超过 10MB</span>
            </div>

            <div className="p-4 overflow-y-auto">
              {loadingImages ? (
                <div className="py-12 flex items-center justify-center text-gray-500">
                  <Loader className="w-5 h-5 animate-spin mr-2" />
                  加载图片中...
                </div>
              ) : images.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  服务器还没有文章图片，先上传一张吧
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <button
                      type="button"
                      key={image.url}
                      onClick={() => insertImage(image.url, image.name)}
                      className="group text-left rounded-xl border border-gray-200 overflow-hidden hover:border-purple-300 hover:shadow-lg transition-all bg-white"
                    >
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <img src={image.url} alt={image.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-medium text-gray-700 truncate">{image.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{formatSize(image.size)}</div>
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

function formatSize(size) {
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
