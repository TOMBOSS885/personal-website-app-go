import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import Navbar from './components/Navbar'
import CursorEffects from './components/CursorEffects'
import DeferredMount from './components/DeferredMount'

const API_BASE = ''

const HomePage = lazy(() => import('./pages/HomePage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const ArticleManager = lazy(() => import('./pages/admin/ArticleManager'))
const ProjectManager = lazy(() => import('./pages/admin/ProjectManager'))
const SkillManager = lazy(() => import('./pages/admin/SkillManager'))
const FeatureCardManager = lazy(() => import('./pages/admin/FeatureCardManager'))
const ProfileManager = lazy(() => import('./pages/admin/ProfileManager'))
const ThemeManager = lazy(() => import('./pages/admin/ThemeManager'))
const Live2DManager = lazy(() => import('./pages/admin/Live2DManager'))
const MusicManager = lazy(() => import('./pages/admin/MusicManager'))
const UploadSettingsManager = lazy(() => import('./pages/admin/UploadSettingsManager'))
const StabilityManager = lazy(() => import('./pages/admin/StabilityManager'))
const AccountSettings = lazy(() => import('./pages/admin/AccountSettings'))
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const Footer = lazy(() => import('./components/Footer'))
const MusicPlayer = lazy(() => import('./components/MusicPlayer'))
const HomeBackgroundCustomizer = lazy(() => import('./components/HomeBackgroundCustomizer'))
const Live2DWidget = lazy(() => import('./components/Live2DWidget'))

function setupAdminApiInterceptor() {
  const originalFetch = window.fetch
  window.fetch = async (url, options = {}) => {
    const res = await originalFetch(url, options)

    if (
      typeof url === 'string'
      && url.includes('/api/admin/')
      && res.status === 401
      && !window.location.pathname.includes('/admin/login')
    ) {
      localStorage.removeItem('token')
      window.location.href = '/admin/login'
      return res
    }

    return res
  }
}

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
    fetch(`${API_BASE}/api/public/profile`)
      .then(res => res.json())
      .then(data => {
        setProfile(data)
        localStorage.setItem('website-profile', JSON.stringify(data))
        if (data.nickname) {
          document.title = `${data.nickname} - 个人网站`
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setupAdminApiInterceptor()
    loadProfile()
    window.addEventListener('profile:updated', loadProfile)
    return () => window.removeEventListener('profile:updated', loadProfile)
  }, [loadProfile])

  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="theme-page-background" aria-hidden="true" />
        <Router>
          <div className="theme-app-shell min-h-screen flex flex-col">
            <CursorEffects />
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/admin/login" element={<LoginPage />} />
                <Route path="/admin/*" element={
                  <PrivateRoute>
                    <AdminLayout />
                  </PrivateRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="articles" element={<ArticleManager />} />
                  <Route path="projects" element={<ProjectManager />} />
                  <Route path="feature-cards" element={<FeatureCardManager />} />
                  <Route path="skills" element={<SkillManager />} />
                  <Route path="profile" element={<ProfileManager />} />
                  <Route path="account" element={<AccountSettings />} />
                  <Route path="theme" element={<ThemeManager />} />
                  <Route path="live2d" element={<Live2DManager />} />
                  <Route path="music" element={<MusicManager />} />
                  <Route path="upload-settings" element={<UploadSettingsManager />} />
                  <Route path="stability" element={<StabilityManager />} />
                </Route>
                <Route path="/*" element={
                  <>
                    <Navbar profile={profile} />
                    <main className="flex-1">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/:id" element={<ArticleDetailPage />} />
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route path="/search" element={<SearchPage />} />
                      </Routes>
                    </main>
                    <DeferredMount timeout={900}>
                      <Suspense fallback={null}>
                        <Footer profile={profile} />
                      </Suspense>
                    </DeferredMount>
                    <DeferredMount timeout={1400}>
                      <Suspense fallback={null}>
                        <MusicPlayer />
                      </Suspense>
                    </DeferredMount>
                    <DeferredMount timeout={1800}>
                      <Suspense fallback={null}>
                        <HomeBackgroundCustomizer />
                      </Suspense>
                    </DeferredMount>
                    <DeferredMount timeout={2400}>
                      <Suspense fallback={null}>
                        <Live2DWidget />
                      </Suspense>
                    </DeferredMount>
                  </>
                } />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  )
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/admin/login" replace />
}

export default App
