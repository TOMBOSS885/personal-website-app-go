import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Save, UserRound } from 'lucide-react'
import { Button, ErrorNotice, Field, Input, LoadingState, PageHeader, Textarea } from '@shared/components/ui'
import { resolveAssetUrl } from '@shared/api/client'
import { useAuth } from '@features/auth/AuthContext'

interface Profile {
  id: number
  username: string
  avatar?: string
  nickname?: string
  bio?: string
  bioEn?: string
  location?: string
  website?: string
  github?: string
  twitter?: string
  linkedin?: string
  emailPublic?: string
  tags?: string
  tagsEn?: string
  welcomeText?: string
  welcomeTextEn?: string
  ctaTitle?: string
  ctaTitleEn?: string
  ctaDescription?: string
  ctaDescriptionEn?: string
  coffeeCount?: number
  starsCount?: number
}

const editableKeys: Array<keyof Profile> = ['nickname', 'bio', 'bioEn', 'location', 'website', 'github', 'twitter', 'linkedin', 'emailPublic', 'tags', 'tagsEn', 'welcomeText', 'welcomeTextEn', 'ctaTitle', 'ctaTitleEn', 'ctaDescription', 'ctaDescriptionEn', 'coffeeCount', 'starsCount']

export function ProfilePage() {
  const { api, profile: serverProfile } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [message, setMessage] = useState('')
  const avatarInput = useRef<HTMLInputElement>(null)
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api!.request<Profile>('/api/admin/profile'), enabled: Boolean(api) })

  useEffect(() => { if (profile.data) setForm(profile.data) }, [profile.data])

  const save = useMutation({
    mutationFn: () => {
      const payload: Partial<Profile> = {}
      for (const key of editableKeys) payload[key] = form[key] as never
      return api!.request<Profile>('/api/admin/profile', { method: 'PUT', body: payload })
    },
    onSuccess: (data) => { setForm(data); setMessage('个人资料已同步到服务器'); void queryClient.invalidateQueries({ queryKey: ['profile'] }) },
  })

  const avatar = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api!.request<{ avatar: string }>('/api/admin/profile/avatar', { method: 'POST', body, timeoutMs: 120_000 })
    },
    onSuccess: (data) => { setForm((current) => ({ ...current, avatar: data.avatar })); void queryClient.invalidateQueries({ queryKey: ['profile'] }) },
  })

  if (profile.isPending) return <LoadingState />
  if (profile.error) return <ErrorNotice error={profile.error} onRetry={() => void profile.refetch()} />

  const set = (key: keyof Profile, value: string | number) => { setMessage(''); setForm((current) => ({ ...current, [key]: value })) }
  const avatarUrl = form.avatar && serverProfile ? resolveAssetUrl(serverProfile.origin, form.avatar) : ''

  return (
    <div>
      <PageHeader title="个人资料" description="这些信息会同步显示在公开网站" actions={<Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? '保存中...' : '保存资料'}</Button>} />
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="panel h-fit p-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden bg-[var(--color-surface-subtle)]" style={{ borderRadius: 999 }}>
              {avatarUrl ? <img src={avatarUrl} alt="个人头像" className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-muted" />}
            </div>
            <h2 className="mt-4 font-semibold">{String(form.nickname || form.username || '管理员')}</h2>
            <p className="mt-1 text-xs text-muted">{form.location || '未设置位置'}</p>
            <input ref={avatarInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && avatar.mutate(event.target.files[0])} />
            <Button className="mt-4 w-full" onClick={() => avatarInput.current?.click()} disabled={avatar.isPending}><Camera className="h-4 w-4" />{avatar.isPending ? '上传中...' : '更换头像'}</Button>
          </div>
        </aside>

        <section className="panel p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="昵称"><Input value={form.nickname || ''} onChange={(e) => set('nickname', e.target.value)} /></Field>
            <Field label="位置"><Input value={form.location || ''} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="个人网站"><Input value={form.website || ''} onChange={(e) => set('website', e.target.value)} /></Field>
            <Field label="公开邮箱"><Input type="email" value={form.emailPublic || ''} onChange={(e) => set('emailPublic', e.target.value)} /></Field>
            <Field label="GitHub"><Input value={form.github || ''} onChange={(e) => set('github', e.target.value)} /></Field>
            <Field label="LinkedIn"><Input value={form.linkedin || ''} onChange={(e) => set('linkedin', e.target.value)} /></Field>
            <Field label="中文简介" className="md:col-span-2"><Textarea rows={4} value={form.bio || ''} onChange={(e) => set('bio', e.target.value)} /></Field>
            <Field label="英文简介" className="md:col-span-2"><Textarea rows={4} value={form.bioEn || ''} onChange={(e) => set('bioEn', e.target.value)} /></Field>
            <Field label="中文标签"><Input value={form.tags || ''} onChange={(e) => set('tags', e.target.value)} /></Field>
            <Field label="英文标签"><Input value={form.tagsEn || ''} onChange={(e) => set('tagsEn', e.target.value)} /></Field>
            <Field label="首页欢迎语"><Input value={form.welcomeText || ''} onChange={(e) => set('welcomeText', e.target.value)} /></Field>
            <Field label="CTA 标题"><Input value={form.ctaTitle || ''} onChange={(e) => set('ctaTitle', e.target.value)} /></Field>
            <Field label="咖啡数"><Input type="number" min={0} value={Number(form.coffeeCount || 0)} onChange={(e) => set('coffeeCount', Number(e.target.value))} /></Field>
            <Field label="Stars 数"><Input type="number" min={0} value={Number(form.starsCount || 0)} onChange={(e) => set('starsCount', Number(e.target.value))} /></Field>
          </div>
          {message ? <p className="mt-4 text-sm text-green-700 dark:text-green-300">{message}</p> : null}
          {save.error || avatar.error ? <div className="mt-4"><ErrorNotice error={save.error || avatar.error} /></div> : null}
        </section>
      </div>
    </div>
  )
}
