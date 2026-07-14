import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Check, Eye, EyeOff, Music2, Palette, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { normalizePage, type PageResponse } from '@shared/api/pagination'
import { Button, ConfirmDialog, EmptyState, ErrorNotice, Field, Input, LoadingState, PageHeader, Select, StatusBadge } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'

const presetThemes = [
  { key: 'purple-pink', name: '紫粉渐变', colors: ['#8b5cf6', '#ec4899'] },
  { key: 'blue-cyan', name: '蓝青清新', colors: ['#3b82f6', '#06b6d4'] },
  { key: 'green-teal', name: '绿松自然', colors: ['#10b981', '#14b8a6'] },
  { key: 'orange-red', name: '橙红热情', colors: ['#f97316', '#ef4444'] },
  { key: 'dark-purple', name: '暗黑紫夜', colors: ['#312e81', '#a855f7'] },
  { key: 'minimal', name: '极简白', colors: ['#f8fafc', '#3b82f6'] },
]

interface ThemeResponse { preset?: string; custom?: Record<string, string> }

export function ThemesPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const theme = useQuery({ queryKey: ['themes', 'active'], queryFn: () => api!.request<ThemeResponse>('/api/public/theme', { auth: false }), enabled: Boolean(api) })
  const [selected, setSelected] = useState('purple-pink')
  useEffect(() => { if (theme.data?.preset) setSelected(theme.data.preset) }, [theme.data])
  const save = useMutation({ mutationFn: () => api!.request<ThemeResponse>('/api/admin/theme', { method: 'POST', body: { preset: selected } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['themes'] }) })
  return <div><PageHeader title="主题" description="选择公开网站使用的预设主题" actions={<Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}><Palette className="h-4 w-4" />{save.isPending ? '保存中...' : '保存主题'}</Button>} />{theme.isPending ? <LoadingState /> : theme.error ? <ErrorNotice error={theme.error} /> : <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{presetThemes.map((preset) => <button key={preset.key} type="button" onClick={() => setSelected(preset.key)} className={`panel overflow-hidden text-left transition ${selected === preset.key ? 'ring-2 ring-primary' : 'hover:border-gray-400'}`}><div className="h-28" style={{ background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` }} /><div className="flex items-center justify-between p-4"><span className="font-medium">{preset.name}</span>{selected === preset.key ? <Check className="h-5 w-5 text-primary" /> : null}</div></button>)}</div>}{save.error ? <div className="mt-4"><ErrorNotice error={save.error} /></div> : null}</div>
}

interface Music { id: number; title: string; artist: string; size: number; isPublic: boolean; lyricsName?: string; createdAt: string }

export function MusicPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState<Music | null>(null)
  const songs = useQuery({ queryKey: ['music'], queryFn: async () => normalizePage(await api!.request<PageResponse<Music>>('/api/admin/music?page=0&size=100'), 0, 100), enabled: Boolean(api) })
  const upload = useMutation({ mutationFn: async (file: File) => { const body = new FormData(); body.append('file', file); return api!.request<Music>('/api/admin/music', { method: 'POST', body, timeoutMs: 300_000 }) }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['music'] }) })
  const toggle = useMutation({ mutationFn: (song: Music) => api!.request<Music>(`/api/admin/music/${song.id}`, { method: 'PATCH', body: { isPublic: !song.isPublic } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['music'] }) })
  const remove = useMutation({ mutationFn: (id: number) => api!.request(`/api/admin/music/${id}`, { method: 'DELETE' }), onSuccess: () => { setDeleting(null); void queryClient.invalidateQueries({ queryKey: ['music'] }) } })
  const error = songs.error || upload.error || toggle.error || remove.error
  return <div><PageHeader title="音乐" description="上传歌曲并控制公开播放状态" actions={<><Button onClick={() => void songs.refetch()}><RefreshCw className={`h-4 w-4 ${songs.isFetching ? 'animate-spin' : ''}`} />刷新</Button><input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><Button variant="primary" onClick={() => fileInput.current?.click()} disabled={upload.isPending}><UploadCloud className="h-4 w-4" />{upload.isPending ? '上传中...' : '上传音乐'}</Button></>} />{error ? <div className="mb-4"><ErrorNotice error={error} /></div> : null}<div className="panel overflow-hidden">{songs.isPending ? <LoadingState /> : !songs.data?.content.length ? <EmptyState title="还没有音乐" /> : <table className="w-full min-w-[760px]"><thead className="bg-[var(--color-surface-subtle)] text-xs text-muted"><tr><th className="table-cell">歌曲</th><th className="table-cell">大小</th><th className="table-cell">歌词</th><th className="table-cell">状态</th><th className="table-cell text-right">操作</th></tr></thead><tbody>{songs.data.content.map((song) => <tr key={song.id}><td className="table-cell"><div className="flex items-center gap-3"><Music2 className="h-5 w-5 text-primary" /><div><p className="font-medium">{song.title}</p><p className="mt-1 text-xs text-muted">{song.artist || '未知艺术家'}</p></div></div></td><td className="table-cell text-muted">{formatBytes(song.size)}</td><td className="table-cell text-muted">{song.lyricsName || '-'}</td><td className="table-cell"><StatusBadge tone={song.isPublic ? 'success' : 'neutral'}>{song.isPublic ? '公开' : '隐藏'}</StatusBadge></td><td className="table-cell"><div className="flex justify-end gap-1"><Button onClick={() => toggle.mutate(song)}>{song.isPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{song.isPublic ? '隐藏' : '公开'}</Button><Button variant="ghost" className="h-9 w-9 px-0 text-danger" onClick={() => setDeleting(song)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table>}</div><ConfirmDialog open={Boolean(deleting)} title="删除音乐？" description={`“${deleting?.title || ''}”及其歌词文件将被永久删除。`} confirmLabel="删除" busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} /></div>
}

interface LiveSettings { enabled: boolean; position: string; size: number; primaryColor: string; transitionType: string; transitionDuration: number; menuAlign: string; showSleepButton: boolean; showAboutButton: boolean }
interface LiveModel { id: number; name: string; active: boolean; switchable: boolean; displayOrder: number; scale: number; modelPath: string }
interface LiveResponse { settings: LiveSettings; models: LiveModel[] }

export function Live2DPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const folderInput = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState<LiveSettings | null>(null)
  const [deleting, setDeleting] = useState<LiveModel | null>(null)
  const data = useQuery({ queryKey: ['live2d'], queryFn: () => api!.request<LiveResponse>('/api/admin/live2d-models'), enabled: Boolean(api) })
  useEffect(() => { if (data.data?.settings) setSettings(data.data.settings) }, [data.data])
  useEffect(() => { if (folderInput.current) folderInput.current.setAttribute('webkitdirectory', '') }, [])
  const saveSettings = useMutation({ mutationFn: () => api!.request('/api/admin/live2d-settings', { method: 'PUT', body: settings }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['live2d'] }) })
  const activate = useMutation({ mutationFn: (id: number) => api!.request(`/api/admin/live2d-models/${id}/activate`, { method: 'PUT' }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['live2d'] }) })
  const remove = useMutation({ mutationFn: (id: number) => api!.request(`/api/admin/live2d-models/${id}`, { method: 'DELETE' }), onSuccess: () => { setDeleting(null); void queryClient.invalidateQueries({ queryKey: ['live2d'] }) } })
  const upload = useMutation({ mutationFn: async (files: File[]) => { const body = new FormData(); const entry = files.find((file) => /\.model3?\.json$/i.test(file.name)); for (const file of files) { body.append('files', file); body.append('paths', file.webkitRelativePath.split('/').slice(1).join('/') || file.name) } body.append('name', files[0]?.webkitRelativePath.split('/')[0] || 'Live2D Model'); if (entry) body.append('entryPath', entry.webkitRelativePath.split('/').slice(1).join('/') || entry.name); return api!.request('/api/admin/live2d-models', { method: 'POST', body, timeoutMs: 600_000 }) }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['live2d'] }) })
  const error = data.error || saveSettings.error || activate.error || remove.error || upload.error
  return <div><PageHeader title="Live2D" description="管理模型、启用状态和基础显示设置" actions={<><Button onClick={() => void data.refetch()}><RefreshCw className={`h-4 w-4 ${data.isFetching ? 'animate-spin' : ''}`} />刷新</Button><input ref={folderInput} hidden type="file" multiple onChange={(event) => event.target.files?.length && upload.mutate(Array.from(event.target.files))} /><Button variant="primary" onClick={() => folderInput.current?.click()} disabled={upload.isPending}><UploadCloud className="h-4 w-4" />{upload.isPending ? '上传中...' : '上传模型文件夹'}</Button></>} />{error ? <div className="mb-4"><ErrorNotice error={error} /></div> : null}{data.isPending ? <LoadingState /> : <div className="grid gap-5 xl:grid-cols-[340px_1fr]"><section className="panel p-5"><h2 className="mb-4 font-semibold">显示设置</h2>{settings ? <div className="space-y-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />启用 Live2D</label><Field label="位置"><Select value={settings.position} onChange={(e) => setSettings({ ...settings, position: e.target.value })}><option value="bottom-right">右下角</option><option value="bottom-left">左下角</option></Select></Field><Field label="尺寸"><Input type="number" min={160} max={600} value={settings.size} onChange={(e) => setSettings({ ...settings, size: Number(e.target.value) })} /></Field><Field label="主色"><Input value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} /></Field><Button variant="primary" className="w-full" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>保存设置</Button></div> : null}</section><section className="panel overflow-hidden">{!data.data?.models?.length ? <EmptyState title="还没有 Live2D 模型" /> : <div className="divide-y divide-line">{data.data.models.map((model) => <div key={model.id} className="flex min-h-20 items-center justify-between gap-4 p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center bg-[var(--color-surface-subtle)]" style={{ borderRadius: 6 }}><Bot className="h-5 w-5" /></div><div><p className="font-medium">{model.name}</p><p className="mt-1 text-xs text-muted">缩放 {model.scale} · 排序 {model.displayOrder}</p></div></div><div className="flex items-center gap-2">{model.active ? <StatusBadge tone="success">当前启用</StatusBadge> : <Button onClick={() => activate.mutate(model.id)}>启用</Button>}<Button variant="ghost" className="h-9 w-9 px-0 text-danger" onClick={() => setDeleting(model)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</section></div>}<ConfirmDialog open={Boolean(deleting)} title="删除模型？" description={`“${deleting?.name || ''}”的模型文件将被永久删除。`} confirmLabel="删除" busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} /></div>
}

function formatBytes(value: number): string { return value ? value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` : '-' }
