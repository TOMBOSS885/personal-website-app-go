import { useQuery } from '@tanstack/react-query'
import { Activity, Award, Database, Eye, FileText, FolderKanban, HardDrive, Plus, RefreshCw, Server, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, ErrorNotice, LoadingState, PageHeader, StatusBadge } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'

interface DashboardStats { articles: number; projects: number; skills: number; views: number }
interface FullHealth { status: 'up' | 'down'; checks?: Record<string, string>; time?: string; error?: string }

export function DashboardPage() {
  const { api, profile } = useAuth()
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => api!.request<DashboardStats>('/api/admin/dashboard-stats'), enabled: Boolean(api), staleTime: 30_000 })
  const health = useQuery({ queryKey: ['health', 'full'], queryFn: () => api!.request<FullHealth>('/api/health/full', { auth: false, timeoutMs: 5_000 }), enabled: Boolean(api), refetchInterval: 60_000 })
  const loading = stats.isPending && health.isPending

  const metricCards = [
    { label: '文章总数', value: stats.data?.articles ?? 0, icon: FileText },
    { label: '项目总数', value: stats.data?.projects ?? 0, icon: FolderKanban },
    { label: '专业技能', value: stats.data?.skills ?? 0, icon: Award },
    { label: '总阅读量', value: stats.data?.views ?? 0, icon: Eye },
  ]

  const refresh = () => { void stats.refetch(); void health.refetch() }

  return (
    <div>
      <PageHeader title="工作台" description={`${profile?.name || '网站'}的内容与运行状态`} actions={<><Button onClick={refresh} disabled={stats.isFetching || health.isFetching}><RefreshCw className={`h-4 w-4 ${(stats.isFetching || health.isFetching) ? 'animate-spin' : ''}`} />刷新</Button><Link to="/content/articles"><Button variant="primary"><Plus className="h-4 w-4" />新建文章</Button></Link></>} />
      {loading ? <LoadingState /> : null}
      {stats.error ? <div className="mb-4"><ErrorNotice error={stats.error} onRetry={() => void stats.refetch()} /></div> : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="内容统计">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="panel flex min-h-28 items-center justify-between p-4">
            <div><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{stats.isPending ? '-' : value.toLocaleString()}</p></div>
            <div className="flex h-10 w-10 items-center justify-center bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" style={{ borderRadius: 6 }}><Icon className="h-5 w-5" /></div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">服务状态</h2><p className="mt-1 text-sm text-muted">来自服务器完整健康检查</p></div><StatusBadge tone={health.data?.status === 'up' ? 'success' : 'danger'}>{health.data?.status === 'up' ? '运行正常' : '需要检查'}</StatusBadge></div>
          {health.error ? <ErrorNotice error={health.error} onRetry={() => void health.refetch()} /> : (
            <div className="grid grid-cols-2 gap-3">
              <HealthItem label="HTTP API" value={health.data?.checks?.http || health.data?.status} icon={Server} />
              <HealthItem label="MySQL" value={health.data?.checks?.database} icon={Database} />
              <HealthItem label="上传目录" value={health.data?.checks?.uploads} icon={HardDrive} />
              <HealthItem label="Redis" value={health.data?.checks?.redis} icon={Zap} />
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="text-base font-semibold">快捷入口</h2></div>
          <div className="space-y-2">
            <QuickLink to="/content/articles" label="管理文章" detail="编辑、草稿与发布" />
            <QuickLink to="/content/projects" label="管理项目" detail="展示作品与链接" />
            <QuickLink to="/operations/stability" label="查看运行日志" detail="操作记录与诊断" />
          </div>
        </div>
      </section>
    </div>
  )
}

function HealthItem({ label, value, icon: Icon }: { label: string; value?: string; icon: typeof Server }) {
  const healthy = value === 'up' || value === 'disabled'
  return <div className="flex min-h-16 items-center gap-3 border border-line bg-[var(--color-surface-subtle)] p-3" style={{ borderRadius: 6 }}><Icon className="h-5 w-5 text-muted" /><div><p className="text-sm font-medium">{label}</p><p className={`mt-0.5 text-xs ${healthy ? 'text-green-700 dark:text-green-300' : 'text-danger'}`}>{value === 'disabled' ? '未启用' : value === 'up' ? '正常' : value || '未知'}</p></div></div>
}

function QuickLink({ to, label, detail }: { to: string; label: string; detail: string }) {
  return <Link to={to} className="flex items-center justify-between border border-line px-3 py-2.5 transition hover:bg-[var(--color-surface-subtle)]" style={{ borderRadius: 6 }}><div><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted">{detail}</p></div><span className="text-muted">→</span></Link>
}
