import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Award,
  Bot,
  Download,
  FileText,
  Folder,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Music,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  User,
  Users,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function AdminLayout() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Admin'
  const { colorMode, toggleColorMode } = useTheme()

  const handleLogout = () => {
    sessionStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/admin/login')
  }

  const navItems = [
    { path: '/admin', label: '概览', icon: LayoutDashboard, exact: true },
    { path: '/admin/client-download', label: '客户端发布', icon: Download },
    { path: '/admin/articles', label: '文章管理', icon: FileText },
    { path: '/admin/projects', label: '项目管理', icon: Folder },
    { path: '/admin/feature-cards', label: '能力卡片', icon: LayoutGrid },
    { path: '/admin/skills', label: '专业技能', icon: Award },
    { path: '/admin/theme', label: '主题管理', icon: Palette },
    { path: '/admin/live2d', label: 'Live2D 管理', icon: Bot },
    { path: '/admin/music', label: '音乐管理', icon: Music },
    { path: '/admin/users', label: '用户监控', icon: Users },
    { path: '/admin/profile', label: '个人信息', icon: User },
    { path: '/admin/upload-settings', label: '上传限制', icon: UploadCloud },
    { path: '/admin/stability', label: '站点稳定性', icon: Activity },
    { path: '/admin/security', label: '访问安全', icon: ShieldAlert },
    { path: '/admin/account', label: '账号安全', icon: ShieldCheck },
  ]

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-transparent transition-colors duration-300 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/95 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-4 dark:border-slate-800 lg:block lg:p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
              style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">管理后台</h1>
              <p className="text-xs text-gray-400 dark:text-slate-500">Personal Website</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleColorMode}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700 lg:mt-5 lg:w-full"
            title={colorMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {colorMode === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span>{colorMode === 'dark' ? '亮色模式' : '暗色模式'}</span>
          </button>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:p-4">
          {navItems.map(({ path, label, icon: Icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 transition-all lg:gap-3 lg:px-4 ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'var(--theme-gradient)',
                boxShadow: 'var(--theme-shadow)',
              } : {}}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center border-t border-gray-100 p-3 dark:border-slate-800 lg:block lg:p-4">
          <div className="mr-auto flex items-center gap-3 px-3 py-2 lg:mb-2 lg:mr-0 lg:px-4">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
              style={{ background: 'var(--theme-gradient)' }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-600 dark:text-slate-300">{username}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 lg:w-full lg:gap-3 lg:px-4"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 transition-colors duration-300 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
