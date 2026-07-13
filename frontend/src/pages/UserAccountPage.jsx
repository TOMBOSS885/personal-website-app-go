import { useEffect, useState } from 'react'
import { ArrowLeft, Camera, Check, Loader, LogOut, Mail, Save, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AvatarCropper from '../components/AvatarCropper'
import { useUserAuth } from '../contexts/UserAuthContext'

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,30}$/u

function AccountAvatar({ user }) {
  const validAvatar = typeof user?.avatar === 'string' && user.avatar.startsWith('/uploads/user-avatars/')
  const initial = user?.username?.trim()?.charAt(0)?.toUpperCase() || 'U'
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-3xl font-bold text-white ring-4 ring-white shadow-lg dark:ring-gray-800">
      {validAvatar ? <img src={user.avatar} alt={`${user.username} 的头像`} className="h-full w-full object-cover" /> : initial}
    </div>
  )
}

export default function UserAccountPage() {
  const { user, loading, openLogin, logout, updateUsername, uploadAvatar } = useUserAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.username || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setUsername(user?.username || '')
	}, [user?.id, user?.username])

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader className="h-7 w-7 animate-spin text-indigo-600" /></div>
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-24 text-center">
        <div className="w-full rounded-2xl border border-white/60 bg-white/90 p-8 shadow-xl dark:border-gray-700 dark:bg-gray-900/90">
          <UserRound className="mx-auto h-10 w-10 text-indigo-600" />
          <h1 className="mt-4 text-xl font-bold text-gray-950 dark:text-white">登录后管理账号</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">登录后可以修改用户名和上传头像。</p>
          <button type="button" onClick={() => openLogin('/account')} className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700">登录</button>
        </div>
      </main>
    )
  }

  const chooseAvatar = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('请选择 JPG、PNG 或 WebP 图片。')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('头像原图不能超过 5MB。')
      return
    }
    setAvatarFile(file)
  }

  const saveUsername = async event => {
    event.preventDefault()
    const value = username.trim()
    setMessage('')
    setError('')
    if (!USERNAME_PATTERN.test(value)) {
      setError('用户名须为 2-30 位文字、字母、数字、下划线或短横线。')
      return
    }
    if (value === user.username) return
    setSaving(true)
    try {
      await updateUsername(value)
      setMessage('用户名已更新。')
    } catch (saveError) {
      setError(saveError.status === 409 ? '该用户名已被使用，请换一个。' : saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const saveAvatar = async blob => {
    setUploading(true)
    setMessage('')
    setError('')
    try {
      await uploadAvatar(blob)
      setAvatarFile(null)
      setMessage('头像已更新。')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    setError('')
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message || '退出登录失败，请稍后重试。')
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-20 pt-28 sm:px-6">
		<AvatarCropper file={avatarFile} processing={uploading} onCancel={() => setAvatarFile(null)} onConfirm={saveAvatar} onError={setError} />
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />返回网站</Link>

      <section className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-xl shadow-indigo-500/10 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/90">
        <div className="border-b border-gray-100 p-6 dark:border-gray-800 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-950 dark:text-white">账号设置</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">管理网站顶部展示的头像和用户名。</p>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <AccountAvatar user={user} />
            <div>
              <div className="font-semibold text-gray-950 dark:text-white">用户头像</div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">裁剪后生成 512×512 图片，上传文件不超过 500KB。</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                <Camera className="h-4 w-4" />选择图片
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} className="hidden" />
              </label>
            </div>
          </div>

          <form onSubmit={saveUsername} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="account-username">用户名</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input id="account-username" value={username} onChange={event => setUsername(event.target.value)} maxLength={30} autoComplete="username" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              <button type="submit" disabled={saving || username.trim() === user.username} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">2-30 位，可使用中英文、数字、下划线和短横线，且不能与其他用户重复。</p>
          </form>

          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Mail className="h-4 w-4" /><span className="break-all">{user.email}</span></div>
          </div>

          {message && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Check className="h-4 w-4" />{message}</div>}
          {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

          <div className="border-t border-gray-100 pt-6 dark:border-gray-800">
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"><LogOut className="h-4 w-4" />退出登录</button>
          </div>
        </div>
      </section>
    </main>
  )
}
