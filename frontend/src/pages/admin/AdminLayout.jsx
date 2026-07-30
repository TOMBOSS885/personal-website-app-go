import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Award, BarChart3, Bot, FileText, Folder, LayoutDashboard, LayoutGrid, LogOut, Moon, Palette, ShieldCheck, Sparkles, Sun, UploadCloud, User } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { getAdminBasePath } from '../../utils/adminEntry'

const navItems = adminBasePath => [
  { path: adminBasePath, label: '概览', icon: LayoutDashboard, exact: true },
  { path: `${adminBasePath}/articles`, label: '文章管理', icon: FileText },
  { path: `${adminBasePath}/projects`, label: '项目管理', icon: Folder },
  { path: `${adminBasePath}/feature-cards`, label: '能力卡片', icon: LayoutGrid },
  { path: `${adminBasePath}/skills`, label: '专业技能', icon: Award },
  { path: `${adminBasePath}/profile`, label: '个人信息', icon: User },
  { path: `${adminBasePath}/theme`, label: '主题管理', icon: Palette },
  { path: `${adminBasePath}/live2d`, label: 'Live2D 管理', icon: Bot },
  { path: `${adminBasePath}/analytics`, label: '访问统计', icon: BarChart3 },
  { path: `${adminBasePath}/upload-settings`, label: '上传限制', icon: UploadCloud },
  { path: `${adminBasePath}/account`, label: '账号安全', icon: ShieldCheck },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { admin, logout } = useAdminAuth()
  const { colorMode, toggleColorMode } = useTheme()
  const username = admin?.username || 'Admin'
  const adminBasePath = getAdminBasePath()

  const handleLogout = async () => {
    await logout()
    navigate(`${adminBasePath}/login`, { replace: true })
  }

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-transparent transition-colors duration-300 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-4 dark:border-slate-800 lg:block lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 shadow-lg"><Sparkles className="h-5 w-5 text-white" /></div>
            <div><h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">管理后台</h1><p className="text-xs text-gray-400">Shared Host</p></div>
          </div>
          <button type="button" onClick={toggleColorMode} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 lg:mt-5 lg:w-full">
            {colorMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span>{colorMode === 'dark' ? '亮色模式' : '暗色模式'}</span>
          </button>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:p-4">
          {navItems(adminBasePath).map(({ path, label, icon: Icon, exact }) => (
            <NavLink key={path} to={path} end={exact} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 transition lg:gap-3 lg:px-4 ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              <Icon className="h-5 w-5" /><span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center border-t border-gray-100 p-3 dark:border-slate-800 lg:block lg:p-4">
          <div className="mr-auto flex items-center gap-3 px-3 py-2 lg:mb-2 lg:mr-0 lg:px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">{username.charAt(0).toUpperCase()}</div>
            <span className="text-sm text-gray-600 dark:text-slate-300">{username}</span>
          </div>
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 lg:w-full lg:gap-3 lg:px-4">
            <LogOut className="h-5 w-5" /><span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  )
}
