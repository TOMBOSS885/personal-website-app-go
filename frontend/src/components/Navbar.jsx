import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, FileText, Folder, Menu, X, Sun, Moon, Github, Search, LogIn, UserRound, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTranslation } from '../i18n/translations'
import LanguageSwitcher from './LanguageSwitcher'
import { safeDownloadHref, safeExternalHref } from '../utils/safeUrl'
import { useTheme } from '../context/ThemeContext'
import ProfileAvatar from './ProfileAvatar'
import { useUserAuth } from '../contexts/UserAuthContext'

function NavbarAvatar({ user, profile }) {
  const sharedClass = 'relative z-10 h-12 w-12 overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-white/80 transition-shadow group-hover:shadow-xl dark:bg-slate-900 dark:ring-slate-800/80'

  return (
    <ProfileAvatar
      profile={user ? { nickname: user.username } : profile}
      sizeClass="h-12 w-12"
      textClass="text-xl"
      className={sharedClass}
    />
  )
}

export default function Navbar({ profile, clientDownload }) {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const { colorMode, toggleColorMode } = useTheme()
  const { user, loading: userLoading } = useUserAuth()
  const githubHref = safeExternalHref(profile?.github || 'https://github.com')
  const downloadHref = clientDownload?.enabled ? safeDownloadHref(clientDownload.downloadUrl) : ''
  const identityName = user?.username || profile?.nickname || (language === 'en' ? 'My Website' : '我的网站')

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { path: '/', label: t('nav.home'), icon: Home },
    { path: '/blog', label: t('nav.blog'), icon: FileText },
    { path: '/projects', label: t('nav.projects'), icon: Folder },
    { path: '/search', label: '搜索', icon: Search },
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
          <div className={`flex justify-between items-center rounded-2xl transition-all duration-500 ${
            scrolled 
              ? 'backdrop-blur-xl bg-white/80 shadow-lg shadow-indigo-500/5 border border-white/50 px-6 py-3' 
              : 'bg-transparent px-2'
          }`}>
            {/* Logo */}
            <Link
              to={user ? '/account' : '/'}
              className="flex min-w-0 items-center space-x-3 group"
              aria-label={user ? '打开账号设置' : '返回首页'}
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
                <NavbarAvatar user={user} profile={profile} />
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
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className="relative group"
                >
                  <motion.div
                    className={`flex items-center space-x-2 rounded-xl px-3 py-2.5 font-medium transition-all duration-300 xl:px-4 ${
                      location.pathname === path
                        ? 'text-indigo-600'
                        : 'text-gray-600 hover:text-indigo-600'
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
                      className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl -z-10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-50 group-hover:to-purple-50 rounded-xl -z-10 transition-all duration-300" />
                </Link>
              ))}
              {downloadHref && (
                <motion.a
                  href={downloadHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white xl:px-4"
                  style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  title={clientDownload.version ? `${t('nav.downloadClient')} ${clientDownload.version}` : t('nav.downloadClient')}
                >
                  <Download className="h-4 w-4" />
                  <span>{t('nav.downloadClient')}</span>
                </motion.a>
              )}
            </div>

            {/* Right side actions */}
            <div className="flex shrink-0 items-center space-x-1.5 sm:space-x-2 xl:space-x-3">
              {/* Language Switcher */}
              <LanguageSwitcher />

              {!userLoading && !user && (
                <Link
                  to={`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/70 sm:flex"
                  title="登录"
                  aria-label="登录"
                >
                  <LogIn className="h-5 w-5" />
                </Link>
              )}

              <motion.button
                type="button"
                onClick={toggleColorMode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-gray-700 shadow-sm shadow-indigo-500/10 backdrop-blur-md transition-colors hover:bg-white hover:text-gray-950 dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700"
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
                  className="hidden h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 xl:flex"
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
                className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5 text-indigo-600 transition-colors hover:from-indigo-100 hover:to-purple-100 lg:hidden"
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
                  {navLinks.map(({ path, label, icon: Icon }, index) => (
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
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        style={location.pathname === path ? { background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' } : {}}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{label}</span>
                      </Link>
                    </motion.div>
                  ))}
                  {downloadHref && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: navLinks.length * 0.1 }}
                    >
                      <a
                        href={downloadHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-4 rounded-xl px-5 py-4 font-medium text-white"
                        style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
                      >
                        <Download className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1">{t('nav.downloadClient')}</span>
                        {clientDownload.version && (
                          <span className="max-w-24 truncate text-xs font-normal text-white/80">{clientDownload.version}</span>
                        )}
                      </a>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (navLinks.length + (downloadHref ? 1 : 0)) * 0.1 }}
                  >
                    <Link
                      to={user ? '/account' : `/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-4 rounded-xl px-5 py-4 text-gray-700 transition-all duration-300 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {user ? <UserRound className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                      <span className="font-medium">{user ? '账号设置' : '登录'}</span>
                    </Link>
                  </motion.div>
                </div>

                {/* Divider */}
                <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                {/* Additional Links */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center text-gray-500 text-sm"
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
