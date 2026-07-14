import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Server, ShieldCheck, Wifi } from 'lucide-react'
import { z } from 'zod'
import { Button, ErrorNotice, Field, Input } from '@shared/components/ui'
import { useAuth } from './AuthContext'

const connectionSchema = z.object({
  name: z.string().trim().min(1, '请输入站点名称').max(40, '站点名称不能超过 40 个字符'),
  origin: z.string().trim().min(1, '请输入服务器地址'),
})

type ConnectionForm = z.infer<typeof connectionSchema>

export function ConnectionPage() {
  const { configureServer } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ConnectionForm>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: '我的个人网站',
      origin: import.meta.env.VITE_DEFAULT_SERVER_ORIGIN || (import.meta.env.DEV ? 'http://127.0.0.1:8080' : ''),
    },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await configureServer(values.origin, values.name)
    } catch (submitError) {
      setError(submitError)
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <section className="grid w-full max-w-5xl overflow-hidden border border-line bg-surface shadow-panel md:grid-cols-[0.9fr_1.1fr]" style={{ borderRadius: 8 }}>
        <div className="border-b border-line bg-[#20242a] p-8 text-white md:border-b-0 md:border-r">
          <div className="flex h-11 w-11 items-center justify-center bg-blue-500" style={{ borderRadius: 6 }}>
            <Server className="h-6 w-6" />
          </div>
          <h1 className="mt-7 text-2xl font-semibold">Personal Website Studio</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-gray-300">连接已经部署的个人网站服务器，在桌面端管理内容、资源与运行状态。</p>
          <div className="mt-8 space-y-4 text-sm text-gray-300">
            <div className="flex items-center gap-3"><Wifi className="h-4 w-4 text-blue-300" /><span>通过同一套 Go API 与网页实时同步</span></div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-green-300" /><span>正式环境只接受 HTTPS 服务器</span></div>
          </div>
        </div>

        <form onSubmit={submit} className="p-8 md:p-10">
          <h2 className="text-lg font-semibold text-ink">连接服务器</h2>
          <p className="mt-1 text-sm text-muted">填写网站根地址，应用会调用 `/api/health` 验证连接。</p>
          <div className="mt-7 space-y-5">
            <Field label="站点名称" error={errors.name?.message}>
              <Input autoFocus autoComplete="off" placeholder="我的个人网站" {...register('name')} />
            </Field>
            <Field label="服务器地址" error={errors.origin?.message} hint="例如 https://example.com，不要填写 /api 路径">
              <Input inputMode="url" autoComplete="url" placeholder="https://example.com" {...register('origin')} />
            </Field>
            {error ? <ErrorNotice error={error} /> : null}
          </div>
          <Button type="submit" variant="primary" className="mt-7 w-full" disabled={isSubmitting}>
            {isSubmitting ? '正在验证...' : '验证并继续'}
          </Button>
        </form>
      </section>
    </main>
  )
}
