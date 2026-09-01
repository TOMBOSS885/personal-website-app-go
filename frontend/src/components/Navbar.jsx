import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, BookMarked, Home, FileText, Folder, Menu, X, Sun, Moon, Github, Search, Users, Layers } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTranslation } from '../i18n/translations'
import LanguageSwitcher from './LanguageSwitcher'
import { safeExternalHref } from '../utils/safeUrl'
import { useTheme } from '../context/ThemeContext'
import ProfileAvatar from './ProfileAvatar'

function NavbarAvatar({ profile }) {
  const sharedClass = 'relative z-10 h-12 w-12 overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-white/80 transition-shadow group-hover:shadow-xl dark:bg-slate-900 dark:ring-slate-800/80'

  return (
    <ProfileAvatar
      profile={profile}
      sizeClass="h-12 w-12"
      textClass="text-xl"
      className={sharedClass}
    />
  )
}

export default function Navbar({ profile }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const { colorMode, toggleColorMode, surfaceMode, toggleSurfaceMode } = useTheme()
  const githubHref = safeExternalHref(profile?.github || '')
  const identityName = profile?.nickname || ''

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const primaryNavLinks = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/blog', label: t('nav.blog'), icon: FileText },
    { path: '/projects', label: t('nav.projects'), icon: Folder },
    { path: '/friends', label: t('nav.friends'), icon: Users },
    { path: '/monitor', label: t('nav.monitor'), icon: Activity },
    { path: '/search', label: '搜索', icon: Search },
  ]
  const mobileNavLinks = primaryNavLinks
  const exploreLinks = [
    { path: '/archive', label: '文章归档', icon: FileText },
    { path: '/series', label: '专题系列', icon: Layers },
    { path: '/library', label: '阅读清单', icon: BookMarked },
  ]

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'py-2' 
            : 'py-4'
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className={`theme-nav-surface flex justify-between items-center rounded-2xl transition-all duration-500 ${
            scrolled 
              ? 'border border-white/50 bg-white/80 px-6 py-3 shadow-lg shadow-indigo-500/5 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/85 dark:shadow-black/25'
              : 'border border-white/40 bg-white/65 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-950/80 dark:shadow-black/20'
          }`}>
            {/* Logo */}
            <Link
              to="/"
              className="flex min-w-0 items-center space-x-3 group"
              aria-label="返回首页"
            >
              <motion.div 
                className="relative isolate"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <div
                  className="pointer-events-none absolute -inset-1 -z-10 rounded-full opacity-30 blur transition-opacity group-hover:opacity-50"
                  style={{ background: 'var(--theme-gradient)' }}
                />
                <NavbarAvatar profile={profile} />
              </motion.div>
              <div className="hidden min-w-0 sm:block lg:hidden xl:block">
                <span 
                className="block max-w-32 truncate text-xl font-bold text-transparent bg-clip-text lg:max-w-44"
                style={{ backgroundImage: 'var(--theme-gradient-text)' }}
                title={identityName}
              >
                  {identityName}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center space-x-0.5 lg:flex xl:space-x-1">
              {primaryNavLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className="relative group"
                >
                  <motion.div
                    className={`flex items-center space-x-2 rounded-xl px-3 py-2.5 font-medium transition-all duration-300 xl:px-4 ${
                      location.pathname === path
                        ? 'text-indigo-600 dark:text-indigo-200'
                        : 'text-gray-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className={`w-4 h-4 transition-all duration-300 ${
                      location.pathname === path ? 'scale-110' : ''
                    }`} />
                    <span>{label}</span>
                  </motion.div>
                  
                  {/* Active indicator */}
                  {location.pathname === path && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-400/25 dark:to-cyan-400/15"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  {/* Hover effect */}
                  <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-500/0 to-purple-500/0 transition-all duration-300 group-hover:from-indigo-50 group-hover:to-purple-50 dark:group-hover:from-white/5 dark:group-hover:to-white/10" />
                </Link>
              ))}
            </div>

            {/* Right side actions */}
            <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2 xl:space-x-3">
              {/* Language Switcher */}
              <LanguageSwitcher />


              <motion.button
                type="button"
                onClick={toggleSurfaceMode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="theme-action-surface flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-gray-700 shadow-sm shadow-indigo-500/10 backdrop-blur-md transition-colors hover:bg-white hover:text-gray-950 dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700"
                title={surfaceMode === 'transparent' ? '恢复毛玻璃框' : '切换为透明框'}
                aria-label={surfaceMode === 'transparent' ? '恢复毛玻璃框' : '切换为透明框'}
                aria-pressed={surfaceMode === 'transparent'}
              >
                <Layers className="h-5 w-5" />
              </motion.button>

              <motion.button
                type="button"
                onClick={toggleColorMode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="theme-action-surface flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-gray-700 shadow-sm shadow-indigo-500/10 backdrop-blur-md transition-colors hover:bg-white hover:text-gray-950 dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700"
                title={colorMode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {colorMode === 'dark' ? (
                    <motion.span
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Sun className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Moon className="h-5 w-5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* GitHub Link */}
              {githubHref && (
                <motion.a
                  href={githubHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className="theme-action-surface hidden h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700 xl:flex"
                  title="GitHub"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5" />
                </motion.a>
              )}

              {/* Mobile menu button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5 text-indigo-600 transition-colors hover:from-indigo-100 hover:to-purple-100 dark:from-slate-800 dark:to-slate-800 dark:text-slate-100 dark:hover:from-slate-700 dark:hover:to-slate-700 lg:hidden"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? '关闭导航菜单' : '打开导航菜单'}
                aria-expanded={isOpen}
              >
                <AnimatePresence mode="wait">
                  {isOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu className="w-5 h-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 right-0 top-0 z-[100] w-80 max-w-full bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-gray-900/95 lg:hidden"
            >
              <div className="p-6">
                {/* Close button */}
                <div className="flex justify-end mb-8">
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                </div>

                {/* Navigation Links */}
                <div className="space-y-2">
                  {mobileNavLinks.map(({ path, label, icon: Icon }, index) => (
                    <motion.div
                      key={path}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        to={path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center space-x-4 px-5 py-4 rounded-xl transition-all duration-300 ${
                          location.pathname === path
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                        style={location.pathname === path ? { background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' } : {}}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{label}</span>
                      </Link>
                    </motion.div>
                  ))}
                  <div className="px-5 pb-1 pt-5 text-xs font-semibold text-gray-400 dark:text-slate-500">探索内容</div>
                  {exploreLinks.map(({ path, label, icon: Icon }) => (
                    <Link key={path} to={path} onClick={() => setIsOpen(false)} className="flex items-center space-x-4 rounded-xl px-5 py-3 text-gray-700 transition hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Icon className="h-5 w-5" /><span className="font-medium">{label}</span>
                    </Link>
                  ))}
                </div>

                {/* Divider */}
                <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-slate-700" />

                {/* Additional Links */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center text-sm text-gray-500 dark:text-slate-400"
                >
                  <p>{language === 'en' ? 'Thanks for visiting ✨' : '感谢访问 ✨'}</p>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
