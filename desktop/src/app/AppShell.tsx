import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FolderGit2,
  Home,
  Search,
  Settings,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { publicApi, resolveServerUrl } from '../shared/api/client'
import { useSettings } from '../shared/settings/SettingsContext'
import { useUserAuth } from '../features/account/UserAuthContext'
import { MusicPlayer } from '../features/media/MusicPlayer'

const themePresets: Record<string, { primary: string; secondary: string; accent: string }> = {
  'purple-pink': { primary: '#8b5cf6', secondary: '#ec4899', accent: '#f59e0b' },
  'blue-cyan': { primary: '#3b82f6', secondary: '#06b6d4', accent: '#10b981' },
  'green-teal': { primary: '#10b981', secondary: '#14b8a6', accent: '#f59e0b' },
  'orange-red': { primary: '#f97316', secondary: '#ef4444', accent: '#fbbf24' },
  'dark-purple': { primary: '#8b5cf6', secondary: '#a855f7', accent: '#fbbf24' },
  minimal: { primary: '#3b82f6', secondary: '#6366f1', accent: '#f59e0b' },
}

const navigation = [
  { to: '/', label: '主页', icon: Home, end: true },
  { to: '/articles', label: '文章', icon: BookOpen },
  { to: '/projects', label: '项目', icon: FolderGit2 },
  { to: '/search', label: '搜索', icon: Search },
]

const titles: Record<string, string> = {
  '/': '今日阅读',
  '/articles': '全部文章',
  '/projects': '项目档案',
  '/search': '全站搜索',
  '/settings': '设置',
  '/account': '读者账号',
}

export function AppShell() {
  const { settings } = useSettings()
  const auth = useUserAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const scrollRef = useRef<HTMLElement>(null)
  const homeQuery = useQuery({
    queryKey: ['home', settings.serverUrl, settings.language],
    queryFn: ({ signal }) => publicApi.home(settings.serverUrl, settings.language, signal),
  })
  const themeQuery = useQuery({
    queryKey: ['public-theme', settings.serverUrl],
    queryFn: ({ signal }) => publicApi.theme(settings.serverUrl, signal),
  })
  const profile = homeQuery.data?.profile
  const title = location.pathname.startsWith('/articles/')
    ? '文章阅读'
    : titles[location.pathname] ?? '博客'

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigate('/search')
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [navigate])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname, location.search])

  useEffect(() => {
    const keyboardScroll = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      const scroller = scrollRef.current
      if (!scroller) return
      const amount = Math.max(320, scroller.clientHeight * 0.82)
      if (event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); scroller.scrollBy({ top: amount, behavior: 'smooth' }) }
      if (event.key === 'PageUp') { event.preventDefault(); scroller.scrollBy({ top: -amount, behavior: 'smooth' }) }
      if (event.key === 'Home') { event.preventDefault(); scroller.scrollTo({ top: 0, behavior: 'smooth' }) }
      if (event.key === 'End') { event.preventDefault(); scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }) }
    }
    window.addEventListener('keydown', keyboardScroll)
    return () => window.removeEventListener('keydown', keyboardScroll)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const response = themeQuery.data
    const preset = themePresets[response?.preset || '']
    const custom = response?.custom
    const theme = custom || preset
    const properties: Array<[string, string | undefined]> = [
      ['--accent', theme?.primary],
      ['--teal', theme?.secondary],
      ['--yellow', theme?.accent],
    ]
    properties.forEach(([name, value]) => {
      if (value && CSS.supports('color', value)) root.style.setProperty(name, value)
    })
    const backgroundImage = custom?.backgroundStyle === 'image'
      ? resolveServerUrl(settings.serverUrl, custom.backgroundImage)
      : ''
    if (backgroundImage) {
      root.style.setProperty('--app-background-image', `url("${backgroundImage.replace(/["\\\r\n]/g, '')}")`)
      root.style.setProperty('--app-background-size', custom?.backgroundSize || 'cover')
      root.style.setProperty('--app-background-position', custom?.backgroundPosition || 'center')
      root.style.setProperty('--app-background-repeat', custom?.backgroundRepeat || 'no-repeat')
    }
    return () => {
      properties.forEach(([name]) => root.style.removeProperty(name))
      ;['--app-background-image', '--app-background-size', '--app-background-position', '--app-background-repeat'].forEach((name) => root.style.removeProperty(name))
    }
  }, [settings.serverUrl, themeQuery.data])

  return (
    <div className="app-shell" onWheel={(event) => {
      if (scrollRef.current && !scrollRef.current.contains(event.target as Node)) {
        scrollRef.current.scrollBy({ top: event.deltaY, left: event.deltaX })
      }
    }}>
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">P.</span>
          <strong>{profile?.nickname || 'Personal Blog'}</strong>
        </div>

        <nav className="primary-nav" aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className={`connection-status ${homeQuery.isError ? 'offline' : ''}`}>
          {homeQuery.isError ? <WifiOff size={15} /> : <Wifi size={15} />}
          <span>{homeQuery.isError ? '离线' : homeQuery.isPending ? '连接中' : '已同步'}</span>
        </div>
        <NavLink to="/account" className={({ isActive }) => `nav-item account-nav${isActive ? ' active' : ''}`}>
          <UserRound size={18} strokeWidth={1.8} />
          <span>{auth.user?.username || '登录账号'}</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Settings size={18} strokeWidth={1.8} />
          <span>设置</span>
        </NavLink>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
          </div>
          <button className="search-trigger" onClick={() => navigate('/search')}>
            <Search size={17} />
            <span>搜索博客内容</span>
          </button>
          {auth.user ? (
            <button className="topbar-avatar avatar-fallback account-avatar-button" title="打开读者账号" onClick={() => navigate('/account')}>
              {auth.user.username.slice(0, 1).toUpperCase()}
            </button>
          ) : profile?.avatar ? (
            <img
              className="topbar-avatar"
              src={resolveServerUrl(settings.serverUrl, profile.avatar)}
              alt={profile.nickname || '博客头像'}
            />
          ) : (
            <span className="topbar-avatar avatar-fallback">{(profile?.nickname || 'P').slice(0, 1)}</span>
          )}
        </header>

        <main className={`content-scroll${location.pathname === '/' ? ' themed-background' : ''}`} ref={scrollRef} tabIndex={-1}>
          <Outlet />
        </main>
        <MusicPlayer />
      </section>
    </div>
  )
}
