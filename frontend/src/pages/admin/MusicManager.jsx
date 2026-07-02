import { useEffect, useState } from 'react'
import { Loader, Music, Plus, Trash2, Upload } from 'lucide-react'

const API_BASE = ''

function formatSize(size) {
  if (!size) return '-'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function MusicManager() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', artist: '', displayOrder: 0, file: null })
  const token = localStorage.getItem('token')

  useEffect(() => { fetchSongs() }, [])

  const fetchSongs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/music`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setSongs(res.ok ? await res.json() : [])
    } catch {
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.file) {
      alert('请选择音乐文件')
      return
    }
    setSaving(true)
    const body = new FormData()
    body.append('file', form.file)
    body.append('title', form.title)
    body.append('artist', form.artist)
    body.append('displayOrder', String(form.displayOrder || 0))

    try {
      const res = await fetch(`${API_BASE}/api/admin/music`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message || '上传失败')
        return
      }
      setForm({ title: '', artist: '', displayOrder: 0, file: null })
      e.currentTarget.reset()
      fetchSongs()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除这首音乐吗？')) return
    await fetch(`${API_BASE}/api/admin/music/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchSongs()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Music className="h-7 w-7 text-indigo-600" />
            音乐管理
          </h1>
          <p className="mt-1 text-sm text-gray-500">管理前台播放器中的歌曲</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_8rem_1.4fr_auto]">
          <input
            type="text"
            placeholder="歌曲名称"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="admin-input"
          />
          <input
            type="text"
            placeholder="歌手"
            value={form.artist}
            onChange={e => setForm({ ...form, artist: e.target.value })}
            className="admin-input"
          />
          <input
            type="number"
            placeholder="排序"
            value={form.displayOrder}
            onChange={e => setForm({ ...form, displayOrder: e.target.value })}
            className="admin-input"
          />
          <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 text-sm text-gray-500 hover:border-indigo-300 hover:bg-indigo-50/40">
            <Upload className="h-4 w-4" />
            <span className="truncate">{form.file?.name || '选择音频文件'}</span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })}
              className="hidden"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            上传
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="mr-2 h-5 w-5 animate-spin text-indigo-500" />
            加载中...
          </div>
        ) : songs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Music className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>暂无音乐</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">歌曲</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">文件</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">排序</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {songs.map(song => (
                <tr key={song.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{song.title}</div>
                    <div className="text-sm text-gray-500">{song.artist || '未知歌手'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <audio controls src={song.fileUrl} className="h-9 w-64 max-w-full" />
                    <div className="mt-1 truncate">{song.fileName} · {formatSize(song.size)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{song.displayOrder || 0}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(song.id)}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
