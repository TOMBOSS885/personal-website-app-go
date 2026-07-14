import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Server, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, ConfirmDialog, ErrorNotice, Field, Input, LoadingState, PageHeader, StatusBadge } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'

interface Meta { service: string; apiVersion: number; minDesktopVersion: string; serverTime: string }
type UploadSettings = Record<string, number> & { id?: number }

const uploadFields = [
  ['articleImageMaxMB', '文章图片上限', 1, 100],
  ['articleSiteZipMaxMB', '静态站点 ZIP 上限', 1, 500],
  ['articleSiteTotalMB', '静态站点解压上限', 1, 1000],
  ['articleSiteFileCount', '静态站点文件数', 1, 10000],
  ['themeBackgroundMaxMB', '主题背景上限', 1, 100],
  ['avatarImageMaxMB', '头像上限', 1, 50],
  ['musicFileMaxMB', '单个音乐上限', 1, 1000],
  ['lyricsFileMaxMB', '歌词上限', 1, 20],
  ['musicBatchMaxCount', '音乐批量文件数', 1, 100],
  ['live2DTotalMaxMB', 'Live2D 总大小', 1, 2000],
  ['live2DFileMaxCount', 'Live2D 文件数', 1, 20000],
] as const

export function SettingsPage() {
  const { api, profile, user, removeServer, logout } = useAuth()
  const [tab, setTab] = useState<'application' | 'uploads' | 'account'>('application')
  const [disconnect, setDisconnect] = useState(false)
  const [uploadForm, setUploadForm] = useState<UploadSettings>({})
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => api!.request<Meta>('/api/meta', { auth: false }), enabled: Boolean(api) })
  const uploads = useQuery({ queryKey: ['settings', 'uploads'], queryFn: () => api!.request<UploadSettings>('/api/admin/upload-settings'), enabled: Boolean(api) && tab === 'uploads' })
  useEffect(() => { if (uploads.data) setUploadForm(uploads.data) }, [uploads.data])
  const saveUploads = useMutation({ mutationFn: () => api!.request<UploadSettings>('/api/admin/upload-settings', { method: 'PUT', body: uploadForm }), onSuccess: (data) => { setUploadForm(data); setMessage('上传限制已保存') } })
  const changePassword = useMutation({ mutationFn: async () => {
    if (passwords.newPassword !== passwords.confirmPassword) throw new Error('两次输入的新密码不一致')
    if (passwords.newPassword.length < 8) throw new Error('新密码至少需要 8 位')
    return api!.request<{ message: string }>('/api/admin/account/password', { method: 'PUT', body: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword } })
  }, onSuccess: async () => { await logout() } })

  const error = meta.error || uploads.error || saveUploads.error || changePassword.error
  return <div><PageHeader title="设置" description="管理连接、上传限制和管理员账号" /><div className="mb-5 flex gap-1 border-b border-line"><Tab active={tab === 'application'} onClick={() => setTab('application')} icon={Server}>应用与连接</Tab><Tab active={tab === 'uploads'} onClick={() => setTab('uploads')} icon={SlidersHorizontal}>上传限制</Tab><Tab active={tab === 'account'} onClick={() => setTab('account')} icon={KeyRound}>账号安全</Tab></div>{error ? <div className="mb-4"><ErrorNotice error={error} /></div> : null}{tab === 'application' ? <section className="grid gap-5 xl:grid-cols-2"><div className="panel p-5"><h2 className="font-semibold">服务器连接</h2><dl className="mt-4 space-y-3 text-sm"><Info label="站点" value={profile?.name || '-'} /><Info label="地址" value={profile?.origin || '-'} /><Info label="服务" value={meta.data?.service || '-'} /><Info label="API 版本" value={meta.data ? String(meta.data.apiVersion) : '-'} /><Info label="最低桌面版本" value={meta.data?.minDesktopVersion || '-'} /></dl><Button variant="danger" className="mt-5" onClick={() => setDisconnect(true)}><Trash2 className="h-4 w-4" />移除服务器连接</Button></div><div className="panel p-5"><h2 className="font-semibold">管理员资料</h2><div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center bg-[var(--color-surface-subtle)]" style={{ borderRadius: 999 }}><UserRound className="h-5 w-5" /></div><div><p className="font-medium">{user?.nickname || user?.username}</p><StatusBadge tone="success">{user?.role || 'ADMIN'}</StatusBadge></div></div><Link to="/settings/profile"><Button className="mt-5">编辑公开资料</Button></Link></div></section> : tab === 'uploads' ? (uploads.isPending ? <LoadingState /> : <section className="panel p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{uploadFields.map(([key, label, min, max]) => <Field key={key} label={`${label}（${key.includes('Count') ? '个' : 'MB'}）`}><Input type="number" min={min} max={max} value={Number(uploadForm[key] || 0)} onChange={(e) => { setMessage(''); setUploadForm((current) => ({ ...current, [key]: Number(e.target.value) })) }} /></Field>)}</div><div className="mt-5 flex items-center gap-3"><Button variant="primary" onClick={() => saveUploads.mutate()} disabled={saveUploads.isPending}>{saveUploads.isPending ? '保存中...' : '保存限制'}</Button>{message ? <span className="text-sm text-green-700 dark:text-green-300">{message}</span> : null}</div></section>) : <section className="panel max-w-xl p-5"><h2 className="font-semibold">修改管理员密码</h2><p className="mt-1 text-sm text-muted">修改成功后，所有旧管理员 JWT 会失效，需要重新登录。</p><div className="mt-5 space-y-4"><Field label="当前密码"><Input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></Field><Field label="新密码"><Input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></Field><Field label="确认新密码"><Input type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></Field><Button variant="primary" onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>{changePassword.isPending ? '修改中...' : '修改密码'}</Button></div></section>}<ConfirmDialog open={disconnect} title="移除服务器连接？" description="本机会删除保存的服务器信息和管理员令牌，本地草稿不会自动上传。" confirmLabel="移除" onCancel={() => setDisconnect(false)} onConfirm={() => void removeServer()} /></div>
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Server; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium ${active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}><Icon className="h-4 w-4" />{children}</button> }
function Info({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[120px_1fr] gap-3"><dt className="text-muted">{label}</dt><dd className="min-w-0 truncate font-medium">{value}</dd></div> }
