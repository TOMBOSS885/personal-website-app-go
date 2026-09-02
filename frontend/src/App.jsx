import { BrowserRouter as Router, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext'
import { UserAuthProvider } from './contexts/UserAuthContext'
import { installAdminFetchInterceptor } from './api/adminFetch'
import Navbar from './components/Navbar'
import CursorEffects from './components/CursorEffects'
import DeferredMount from './components/DeferredMount'
import VisitTracker from './components/VisitTracker'
import RouteMetadata from './components/RouteMetadata'
import LoadingIndicator from './components/LoadingIndicator'
import { fetchWithTimeout } from './utils/network'
import { getAdminBasePath } from './utils/adminEntry'
import { fetchPublicHomeData, invalidatePublicHomeData } from './utils/publicHomeData'

installAdminFetchInterceptor()

const HomePage = lazy(() => import('./pages/HomePage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ArchivePage = lazy(() => import('./pages/ArchivePage'))
const SeriesPage = lazy(() => import('./pages/SeriesPage'))
const ReadingLibraryPage = lazy(() => import('./pages/ReadingLibraryPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const SiteMonitorPage = lazy(() => import('./pages/SiteMonitorPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const ArticleManager = lazy(() => import('./pages/admin/ArticleManager'))
const ProjectManager = lazy(() => import('./pages/admin/ProjectManager'))
const SkillManager = lazy(() => import('./pages/admin/SkillManager'))
const FeatureCardManager = lazy(() => import('./pages/admin/FeatureCardManager'))
const ProfileManager = lazy(() => import('./pages/admin/ProfileManager'))
const ThemeManager = lazy(() => import('./pages/admin/ThemeManager'))
const Live2DManager = lazy(() => import('./pages/admin/Live2DManager'))
const AnalyticsManager = lazy(() => import('./pages/admin/AnalyticsManager'))
const UploadSettingsManager = lazy(() => import('./pages/admin/UploadSettingsManager'))
const AccountSettings = lazy(() => import('./pages/admin/AccountSettings'))
const SocialManager = lazy(() => import('./pages/admin/SocialManager'))
const AuditLogManager = lazy(() => import('./pages/admin/AuditLogManager'))
const UserManager = lazy(() => import('./pages/admin/UserManager'))
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const UserLoginPage = lazy(() => import('./pages/UserLoginPage'))
const UserAccountPage = lazy(() => import('./pages/UserAccountPage'))
const Footer = lazy(() => import('./components/Footer'))
const HomeBackgroundCustomizer = lazy(() => import('./components/HomeBackgroundCustomizer'))
const Live2DController = lazy(() => import('./components/Live2DController'))

function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-white">
      <LoadingIndicator size={64} label="加载中" />
    </div>
  )
}

function App() {
  const profileRequestId = useRef(0)
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('website-profile')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  const loadProfile = useCallback((forceProfileRequest = false) => {
    const requestId = ++profileRequestId.current
    const isHomePage = window.location.pathname === '/' || window.location.pathname === ''
    const language = localStorage.getItem('language') === 'en' ? 'en' : 'zh'
    const request = !forceProfileRequest && isHomePage
      ? fetchPublicHomeData(language).then(data => data.profile)
      : fetchWithTimeout('/api/public/profile', {}, 7000).then(res => {
          if (!res.ok) throw new Error('Profile request failed')
          return res.json()
        })

    request
      .then(data => {
        if (!data || requestId !== profileRequestId.current) return
        setProfile(data)
        localStorage.setItem('website-profile', JSON.stringify(data))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const isHomePage = window.location.pathname === '/' || window.location.pathname === ''
    // On article and admin routes, the profile only decorates the navigation.
    // Leave the first connection slots for the route's own API request.
    const initialProfileTimer = window.setTimeout(() => loadProfile(), isHomePage ? 0 : 3500)
    const handleProfileUpdated = () => {
      invalidatePublicHomeData()
      loadProfile(true)
    }
    window.addEventListener('profile:updated', handleProfileUpdated)
    return () => {
      window.clearTimeout(initialProfileTimer)
      window.removeEventListener('profile:updated', handleProfileUpdated)
    }
  }, [loadProfile])

  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AdminAuthProvider>
            <UserAuthProvider>
              <div className="theme-page-background" aria-hidden="true" />
              <div className="theme-app-shell min-h-screen flex flex-col">
                <CursorEffects />
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                  <Route path="/login" element={<UserLoginPage />} />
                  <Route path="/account" element={<UserAccountPage />} />
                  <Route path="/:adminEntry/login" element={<LoginPage />} />
                  <Route path="/:adminEntry/*" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="articles" element={<ArticleManager />} />
                    <Route path="projects" element={<ProjectManager />} />
                    <Route path="feature-cards" element={<FeatureCardManager />} />
                    <Route path="skills" element={<SkillManager />} />
                    <Route path="profile" element={<ProfileManager />} />
                    <Route path="theme" element={<ThemeManager />} />
                    <Route path="live2d" element={<Live2DManager />} />
                    <Route path="analytics" element={<AnalyticsManager />} />
                    <Route path="upload-settings" element={<UploadSettingsManager />} />
                    <Route path="account" element={<AccountSettings />} />
                    <Route path="social" element={<SocialManager />} />
                    <Route path="audit-logs" element={<AuditLogManager />} />
                    <Route path="users" element={<UserManager />} />
                    <Route path="*" element={<Navigate to="." replace />} />
                  </Route>
                  <Route path="/" element={<PublicLayout profile={profile} />}>
                    <Route index element={<HomePage />} />
                    <Route path="blog" element={<BlogPage />} />
                    <Route path="blog/:id" element={<ArticleDetailPage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="archive" element={<ArchivePage />} />
                    <Route path="series" element={<SeriesPage />} />
                    <Route path="library" element={<ReadingLibraryPage />} />
                    <Route path="friends" element={<FriendsPage />} />
                    <Route path="guestbook" element={<FriendsPage />} />
                    <Route path="monitor" element={<SiteMonitorPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                  </Routes>
                </Suspense>
              </div>
            </UserAuthProvider>
          </AdminAuthProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  )
}

function PublicLayout({ profile }) {
  return (
    <div className="public-shell contents">
      <RouteMetadata profile={profile} />
      <VisitTracker />
      <Navbar profile={profile} />
      <main className="flex-1"><Outlet /></main>
      <DeferredMount afterLoad delay={3000} timeout={1500}><Suspense fallback={null}><Footer profile={profile} /></Suspense></DeferredMount>
      <DeferredMount afterLoad delay={6000} timeout={2500}><Suspense fallback={null}><HomeBackgroundCustomizer /></Suspense></DeferredMount>
      <DeferredMount afterLoad delay={6000} timeout={2500}><Suspense fallback={null}><Live2DController /></Suspense></DeferredMount>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { admin, loading } = useAdminAuth()
  if (loading) return <PageLoading />
  return admin ? children : <Navigate to={`${getAdminBasePath()}/login`} replace />
}

export default App
