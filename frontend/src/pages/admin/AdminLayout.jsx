import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Folder, Award, User, LogOut, Palette, Sparkles, Bot, LayoutGrid, ShieldCheck, Music, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function AdminLayout() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Admin'
  const { colorMode, toggleColorMode } = useTheme()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/admin/login')
  }

  const navItems = [
    { path: '/admin', label: '概览', icon: LayoutDashboard, exact: true },
    { path: '/admin/articles', label: '文章管理', icon: FileText },
    { path: '/admin/projects', label: '项目管理', icon: Folder },
    { path: '/admin/feature-cards', label: '能力卡片', icon: LayoutGrid },
    { path: '/admin/skills', label: '专业技能', icon: Award },
    { path: '/admin/theme', label: '主题管理', icon: Palette },
    { path: '/admin/live2d', label: 'Live2D 管理', icon: Bot },
    { path: '/admin/music', label: '音乐管理', icon: Music },
    { path: '/admin/profile', label: '个人信息', icon: User },
    { path: '/admin/account', label: '账号安全', icon: ShieldCheck },
  ]

  return (
    <div className="admin-shell min-h-screen bg-transparent flex transition-colors duration-300">
      <aside className="w-64 bg-white/95 shadow-sm border-r border-gray-100 flex flex-col backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">管理后台</h1>
              <p className="text-xs text-gray-400">Personal Website</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleColorMode}
            className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
            title={colorMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {colorMode === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span>{colorMode === 'dark' ? '亮色模式' : '暗色模式'}</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'var(--theme-gradient)',
                boxShadow: 'var(--theme-shadow)'
              } : {}}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ background: 'var(--theme-gradient)' }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-600">{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto transition-colors duration-300">
        <Outlet />
      </main>
    </div>
  )
}
