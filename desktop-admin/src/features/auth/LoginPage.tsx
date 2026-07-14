import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ArrowLeft, LockKeyhole, Server, UserRound } from 'lucide-react'
import { z } from 'zod'
import { Button, ErrorNotice, Field, Input } from '@shared/components/ui'
import { useAuth } from './AuthContext'

const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名').max(255),
  password: z.string().min(1, '请输入密码').max(72, '密码不能超过 72 个字符'),
  remember: z.boolean(),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { profile, login, removeServer } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', remember: true },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await login(values)
    } catch (submitError) {
      setError(submitError)
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <section className="panel w-full max-w-md p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-white" style={{ borderRadius: 6 }}>
            <LockKeyhole className="h-5 w-5" />
          </div>
          <Button variant="ghost" className="px-2" onClick={() => void removeServer()} title="更换服务器">
            <ArrowLeft className="h-4 w-4" />
            更换服务器
          </Button>
        </div>
        <h1 className="mt-6 text-xl font-semibold text-ink">管理员登录</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Server className="h-4 w-4" />
          <span className="truncate">{profile?.origin}</span>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="用户名" error={errors.username?.message}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input autoFocus autoComplete="username" className="pl-9" {...register('username')} />
            </div>
          </Field>
          <Field label="密码" error={errors.password?.message}>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input type="password" autoComplete="current-password" className="pl-9" {...register('password')} />
            </div>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" {...register('remember')} />
            <span>在系统凭据库中保持登录</span>
          </label>
          {error ? <ErrorNotice error={error} /> : null}
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '正在登录...' : '登录'}
          </Button>
        </form>
      </section>
    </main>
  )
}
