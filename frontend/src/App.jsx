import { BrowserRouter as Router, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext'
import { installAdminFetchInterceptor } from './api/adminFetch'
import Navbar from './components/Navbar'
import CursorEffects from './components/CursorEffects'
import DeferredMount from './components/DeferredMount'
import VisitTracker from './components/VisitTracker'
import { fetchWithTimeout } from './utils/network'
import { getAdminBasePath } from './utils/adminEntry'

installAdminFetchInterceptor()

const HomePage = lazy(() => import('./pages/HomePage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
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
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const Footer = lazy(() => import('./components/Footer'))
const HomeBackgroundCustomizer = lazy(() => import('./components/HomeBackgroundCustomizer'))
const Live2DWidget = lazy(() => import('./components/Live2DWidget'))

function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </div>
  )
}

function App() {
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('website-profile')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  const loadProfile = useCallback(() => {
    fetchWithTimeout('/api/public/profile', {}, 7000)
      .then(res => res.json())
      .then(data => {
        setProfile(data)
        localStorage.setItem('website-profile', JSON.stringify(data))
        if (data.nickname) document.title = `${data.nickname} - 个人网站`
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadProfile()
    window.addEventListener('profile:updated', loadProfile)
    return () => window.removeEventListener('profile:updated', loadProfile)
  }, [loadProfile])

  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AdminAuthProvider>
            <div className="theme-page-background" aria-hidden="true" />
            <div className="theme-app-shell min-h-screen flex flex-col">
              <CursorEffects />
              <Suspense fallback={<PageLoading />}>
                <Routes>
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
                    <Route path="*" element={<Navigate to="." replace />} />
                  </Route>
                  <Route path="/" element={<PublicLayout profile={profile} />}>
                    <Route index element={<HomePage />} />
                    <Route path="blog" element={<BlogPage />} />
                    <Route path="blog/:id" element={<ArticleDetailPage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </div>
          </AdminAuthProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  )
}

function PublicLayout({ profile }) {
  return (
    <>
      <VisitTracker />
      <Navbar profile={profile} />
      <main className="flex-1"><Outlet /></main>
      <DeferredMount timeout={900}><Suspense fallback={null}><Footer profile={profile} /></Suspense></DeferredMount>
      <DeferredMount timeout={1400}><Suspense fallback={null}><HomeBackgroundCustomizer /></Suspense></DeferredMount>
      <DeferredMount delay={8000} timeout={3000}><Suspense fallback={null}><Live2DWidget /></Suspense></DeferredMount>
    </>
  )
}

function PrivateRoute({ children }) {
  const { admin, loading } = useAdminAuth()
  if (loading) return <PageLoading />
  return admin ? children : <Navigate to={`${getAdminBasePath()}/login`} replace />
}

export default App
