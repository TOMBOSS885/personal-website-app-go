import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity, Award, Bot, ChevronLeft, ChevronRight, ExternalLink, FileImage, FileText,
  FolderKanban, Gauge, Grid2X2, LogOut, Moon, Music2, Palette, Settings2, ShieldCheck,
  Sun, UserRound, UsersRound, Wifi, WifiOff,
} from 'lucide-react'
import { Button, StatusBadge } from '@shared/components/ui'
import { openExternalUrl, readSetting, writeSetting } from '@shared/lib/platform'
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus'
import { useAuth } from '@features/auth/AuthContext'

const navGroups = [
  { label: '工作台', items: [{ to: '/', label: '概览', icon: Gauge, end: true }] },
  { label: '内容', items: [
    { to: '/content/articles', label: '文章', icon: FileText },
    { to: '/content/projects', label: '项目', icon: FolderKanban },
    { to: '/content/skills', label: '技能', icon: Award },
    { to: '/content/feature-cards', label: '能力卡片', icon: Grid2X2 },
  ] },
  { label: '资源', items: [
    { to: '/assets/images', label: '图片资源', icon: FileImage },
    { to: '/assets/themes', label: '主题', icon: Palette },
    { to: '/assets/music', label: '音乐', icon: Music2 },
    { to: '/assets/live2d', label: 'Live2D', icon: Bot },
  ] },
  { label: '运营', items: [
    { to: '/community', label: '用户与评论', icon: UsersRound },
    { to: '/operations/stability', label: '稳定性', icon: Activity },
    { to: '/operations/security', label: '访问安全', icon: ShieldCheck },
  ] },
  { label: '设置', items: [
    { to: '/settings/profile', label: '个人资料', icon: UserRound },
    { to: '/settings', label: '应用设置', icon: Settings2, end: true },
  ] },
]

export function AppShell() {
  const { profile, user, logout } = useAuth()
  const online = useOnlineStatus()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    void readSetting<boolean>('dark-mode').then((value) => setDark(value ?? window.matchMedia('(prefers-color-scheme: dark)').matches))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    void writeSetting('dark-mode', dark)
  }, [dark])

  return (
    <div className="flex h-screen min-h-[720px] min-w-[1100px] bg-canvas text-ink">
      <aside className={`flex shrink-0 flex-col border-r border-line bg-surface transition-[width] ${collapsed ? 'w-[68px]' : 'w-[232px]'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-line px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-white" style={{ borderRadius: 6 }}>
            <Gauge className="h-5 w-5" />
          </div>
          {!collapsed ? <div className="min-w-0"><p className="truncate text-sm font-semibold">Website Studio</p><p className="truncate text-xs text-muted">{profile?.name}</p></div> : null}
        </div>

        <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="mb-4" key={group.label}>
              {!collapsed ? <p className="mb-1 px-2 text-[11px] font-semibold uppercase text-muted">{group.label}</p> : null}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) => `flex h-9 items-center gap-3 px-2 text-sm transition ${isActive ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-200' : 'text-muted hover:bg-[var(--color-surface-subtle)] hover:text-ink'}`}
                    style={{ borderRadius: 6 }}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed ? <span className="truncate">{label}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <div className={`mb-1 flex items-center gap-3 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--color-surface-subtle)]" style={{ borderRadius: 999 }}>
              <UserRound className="h-4 w-4" />
            </div>
            {!collapsed ? <div className="min-w-0"><p className="truncate text-sm font-medium">{user?.nickname || user?.username}</p><p className="text-xs text-muted">管理员</p></div> : null}
          </div>
          <button type="button" className="flex h-9 w-full items-center gap-3 px-2 text-sm text-muted hover:bg-[var(--color-surface-subtle)] hover:text-danger" style={{ borderRadius: 6 }} onClick={() => void logout()} title="退出登录">
            <LogOut className="h-[18px] w-[18px] shrink-0" />{!collapsed ? <span>退出登录</span> : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-8 min-h-8 w-8 px-0" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? '展开导航' : '收起导航'}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <span className="text-xs text-muted">{routeTitle(location.pathname)}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={online ? 'success' : 'danger'}>{online ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}{online ? '网络正常' : '离线'}</StatusBadge>
            <Button variant="ghost" className="h-8 min-h-8 w-8 px-0" onClick={() => setDark((value) => !value)} title={dark ? '切换浅色模式' : '切换深色模式'}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" className="h-8 min-h-8" onClick={() => profile && void openExternalUrl(profile.websiteUrl)}>
              <ExternalLink className="h-4 w-4" />打开站点
            </Button>
          </div>
        </header>
        <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function routeTitle(pathname: string): string {
  for (const group of navGroups) {
    const match = group.items.find((item) => item.to === '/' ? pathname === '/' : pathname.startsWith(item.to))
    if (match) return `${group.label} / ${match.label}`
  }
  return 'Personal Website Studio'
}
