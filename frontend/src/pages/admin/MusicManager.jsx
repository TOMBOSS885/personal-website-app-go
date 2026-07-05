import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Loader, Music, Plus, Trash2, Upload } from 'lucide-react'

const API_BASE = ''

function formatSize(size) {
  if (!size) return '-'
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function sortSongs(items) {
  return [...items].sort((a, b) => {
    const orderDiff = Number(a.displayOrder || 0) - Number(b.displayOrder || 0)
    if (orderDiff !== 0) return orderDiff
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })
}

function mergeSongs(current, incoming) {
  const nextById = new Map()
  incoming.forEach(song => nextById.set(song.id, song))
  current.forEach(song => {
    if (!nextById.has(song.id)) nextById.set(song.id, song)
  })
  return sortSongs(Array.from(nextById.values()))
}

function replaceSong(current, nextSong) {
  return sortSongs(current.map(song => song.id === nextSong.id ? nextSong : song))
}

function isSongPublic(song) {
  return song?.isPublic !== false
}

export default function MusicManager() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [lyricsTarget, setLyricsTarget] = useState(null)
  const [lyricsSavingId, setLyricsSavingId] = useState(null)
  const [visibilitySavingId, setVisibilitySavingId] = useState(null)
  const [form, setForm] = useState({ title: '', artist: '', displayOrder: 0, isPublic: true, files: [] })
  const lyricsInputRef = useRef(null)
  const token = localStorage.getItem('token')

  useEffect(() => { fetchSongs() }, [page, size])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected = songs.length > 0 && selectedIds.length === songs.length
  const selectedCount = selectedIds.length
  const fileCount = form.files.length
  const totalPages = Math.max(1, Math.ceil(total / size))

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const fetchSongs = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/music?page=${page}&size=${size}`, {
        headers: authHeaders(),
      })
      const data = res.ok ? await res.json() : { content: [], totalElements: 0 }
      const list = Array.isArray(data) ? sortSongs(data) : sortSongs(data.content || [])
      setSongs(list)
      setTotal(Number(data.totalElements || list.length || 0))
      setSelectedIds(ids => ids.filter(id => list.some(song => song.id === id)))
    } catch {
      setSongs([])
      setTotal(0)
      setSelectedIds([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.files.length === 0) {
      alert('请选择音乐文件')
      return
    }

    setSaving(true)
    const body = new FormData()
    form.files.forEach(file => body.append('files', file))
    body.append('title', form.title)
    body.append('artist', form.artist)
    body.append('displayOrder', String(form.displayOrder || 0))
    body.append('isPublic', String(form.isPublic !== false))

    try {
      const res = await fetch(`${API_BASE}/api/admin/music`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        alert(data?.message || '上传失败')
        return
      }

      const uploadedSongs = Array.isArray(data) ? data : [data].filter(Boolean)
      if (uploadedSongs.length > 0) {
        setSongs(current => mergeSongs(current, uploadedSongs))
      }
      setForm({ title: '', artist: '', displayOrder: 0, isPublic: true, files: [] })
      event.currentTarget.reset()
      await fetchSongs({ showLoading: false })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除这首音乐吗？歌词文件也会一起解绑并删除。')) return
    setDeleting(true)
    try {
      await fetch(`${API_BASE}/api/admin/music/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setSelectedIds(ids => ids.filter(item => item !== id))
      setSongs(current => current.filter(song => song.id !== id))
      await fetchSongs({ showLoading: false })
    } finally {
      setDeleting(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.length} 首音乐吗？对应歌词文件也会一起删除。`)) return

    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/music`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message || '批量删除失败')
        return
      }
      const deletedIds = new Set(selectedIds)
      setSelectedIds([])
      setSongs(current => current.filter(song => !deletedIds.has(song.id)))
      await fetchSongs({ showLoading: false })
    } finally {
      setDeleting(false)
    }
  }

  const openLyricsPicker = (song) => {
    setLyricsTarget(song)
    if (lyricsInputRef.current) {
      lyricsInputRef.current.value = ''
      lyricsInputRef.current.click()
    }
  }

  const uploadLyrics = async (file) => {
    if (!file || !lyricsTarget) return
    if (!file.name.toLowerCase().endsWith('.lrc')) {
      alert('歌词文件必须是 .lrc 格式')
      return
    }

    setLyricsSavingId(lyricsTarget.id)
    const body = new FormData()
    body.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/api/admin/music/${lyricsTarget.id}/lyrics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        alert(data?.message || '歌词上传失败')
        return
      }
      setSongs(current => replaceSong(current, data))
      setLyricsTarget(null)
    } finally {
      setLyricsSavingId(null)
    }
  }

  const deleteLyrics = async (song) => {
    if (!song.lyricsUrl) return
    if (!confirm(`确定移除《${song.title}》的歌词文件吗？`)) return
    setLyricsSavingId(song.id)
    try {
      const res = await fetch(`${API_BASE}/api/admin/music/${song.id}/lyrics`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        alert(data?.message || '歌词删除失败')
        return
      }
      setSongs(current => replaceSong(current, data))
    } finally {
      setLyricsSavingId(null)
    }
  }

  const toggleVisibility = async (song) => {
    const nextVisible = !isSongPublic(song)
    setVisibilitySavingId(song.id)
    setSongs(current => replaceSong(current, { ...song, isPublic: nextVisible }))

    try {
      const res = await fetch(`${API_BASE}/api/admin/music/${song.id}`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPublic: nextVisible }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSongs(current => replaceSong(current, song))
        alert(data?.message || '保存显示设置失败')
        return
      }
      setSongs(current => replaceSong(current, data))
    } catch {
      setSongs(current => replaceSong(current, song))
      alert('保存显示设置失败')
    } finally {
      setVisibilitySavingId(null)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(ids => (
      ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]
    ))
  }

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : songs.map(song => song.id))
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
            <Music className="h-7 w-7 text-indigo-600" />
            音乐管理
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">管理前台播放器中的歌曲和对应歌词文件</p>
        </div>
        <button
          type="button"
          onClick={handleBatchDelete}
          disabled={selectedCount === 0 || deleting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
        >
          {deleting ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          删除选中{selectedCount > 0 ? `（${selectedCount}）` : ''}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_8rem_1.5fr_auto]">
          <input
            type="text"
            placeholder={fileCount > 1 ? '批量上传时自动使用文件名' : '歌曲名称'}
            value={form.title}
            disabled={fileCount > 1}
            onChange={event => setForm({ ...form, title: event.target.value })}
            className="admin-input disabled:bg-gray-50 disabled:text-gray-400"
          />
          <input
            type="text"
            placeholder="歌手"
            value={form.artist}
            onChange={event => setForm({ ...form, artist: event.target.value })}
            className="admin-input"
          />
          <input
            type="number"
            placeholder="排序"
            value={form.displayOrder}
            onChange={event => setForm({ ...form, displayOrder: event.target.value })}
            className="admin-input"
          />
          <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 text-sm text-gray-500 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {fileCount === 0
                ? '选择一个或多个音频文件'
                : fileCount === 1
                  ? form.files[0].name
                  : `已选择 ${fileCount} 个文件`}
            </span>
            <input
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={event => setForm({ ...form, files: Array.from(event.target.files || []) })}
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
        <label className="mt-4 inline-flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-800">
          <input
            type="checkbox"
            checked={form.isPublic !== false}
            onChange={event => setForm({ ...form, isPublic: event.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-medium">上传后在前台播放器显示</span>
        </label>
        {fileCount > 1 && (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            批量上传会按当前排序值递增保存；歌曲名默认使用各自文件名，歌手信息会应用到全部文件。
          </p>
        )}
      </form>

      <input
        ref={lyricsInputRef}
        type="file"
        accept=".lrc,text/plain"
        className="hidden"
        onChange={event => uploadLyrics(event.target.files?.[0])}
      />

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-slate-400">
            <Loader className="mr-2 h-5 w-5 animate-spin text-indigo-500" />
            加载中...
          </div>
        ) : songs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-slate-400">
            <Music className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>暂无音乐</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-950">
                <tr>
                  <th className="w-12 px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      aria-label="全选音乐"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">歌曲</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">文件</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">歌词</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">前台显示</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">排序</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {songs.map(song => (
                  <tr key={song.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/70">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(song.id)}
                        onChange={() => toggleSelect(song.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`选择 ${song.title}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{song.title}</div>
                      <div className="text-sm text-gray-500 dark:text-slate-400">{song.artist || '未知歌手'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                      <audio controls preload="none" src={song.fileUrl} className="h-9 w-64 max-w-full" />
                      <div className="mt-1 truncate">{song.fileName} · {formatSize(song.size)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {song.lyricsUrl ? (
                        <div className="space-y-2">
                          <div className="flex max-w-[14rem] items-center gap-1.5 truncate text-emerald-600 dark:text-emerald-300">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="truncate">{song.lyricsName || '已绑定歌词'}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openLyricsPicker(song)}
                              disabled={lyricsSavingId === song.id}
                              className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/15 dark:text-indigo-300"
                            >
                              替换
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLyrics(song)}
                              disabled={lyricsSavingId === song.id}
                              className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/15 dark:text-red-300"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openLyricsPicker(song)}
                          disabled={lyricsSavingId === song.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
                        >
                          {lyricsSavingId === song.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          上传歌词
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => toggleVisibility(song)}
                        disabled={visibilitySavingId === song.id}
                        className={`inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSongPublic(song)
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                        title={isSongPublic(song) ? '点击后前台隐藏' : '点击后前台显示'}
                      >
                        {visibilitySavingId === song.id ? (
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : isSongPublic(song) ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {isSongPublic(song) ? '显示' : '隐藏'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{song.displayOrder || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(song.id)}
                        disabled={deleting}
                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span>共 {total} 首</span>
          <select
            value={size}
            onChange={event => {
              setSize(Number(event.target.value))
              setPage(0)
            }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {[10, 20, 50, 100].map(item => <option key={item} value={item}>{item} 条/页</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage(value => Math.max(0, value - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>
          <span className="rounded-lg bg-gray-100 px-3 py-2 text-gray-700 dark:bg-slate-800 dark:text-slate-200">{page + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(value => Math.min(totalPages - 1, value + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-slate-700"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
