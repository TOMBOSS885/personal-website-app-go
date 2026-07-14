import { lazy, Suspense, type ComponentType } from 'react'
import { createHashRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { RouteError } from './RouteError'
import { useAuth } from '@features/auth/AuthContext'
import { ConnectionPage } from '@features/auth/ConnectionPage'
import { LoginPage } from '@features/auth/LoginPage'
import { LoadingState } from '@shared/components/ui'

const DashboardPage = lazy(() => import('@features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ArticlesPage = lazy(() => import('@features/articles/ArticlesPage').then((module) => ({ default: module.ArticlesPage })))
const ProjectsPage = lazy(() => import('@features/content/ResourcePages').then((module) => ({ default: module.ProjectsPage })))
const SkillsPage = lazy(() => import('@features/content/ResourcePages').then((module) => ({ default: module.SkillsPage })))
const FeatureCardsPage = lazy(() => import('@features/content/ResourcePages').then((module) => ({ default: module.FeatureCardsPage })))
const ImagesPage = lazy(() => import('@features/assets/ImagesPage').then((module) => ({ default: module.ImagesPage })))
const ThemesPage = lazy(() => import('@features/media/MediaPages').then((module) => ({ default: module.ThemesPage })))
const MusicPage = lazy(() => import('@features/media/MediaPages').then((module) => ({ default: module.MusicPage })))
const Live2DPage = lazy(() => import('@features/media/MediaPages').then((module) => ({ default: module.Live2DPage })))
const CommunityPage = lazy(() => import('@features/community/CommunityPage').then((module) => ({ default: module.CommunityPage })))
const StabilityPage = lazy(() => import('@features/operations/OperationsPages').then((module) => ({ default: module.StabilityPage })))
const SecurityPage = lazy(() => import('@features/operations/OperationsPages').then((module) => ({ default: module.SecurityPage })))
const ProfilePage = lazy(() => import('@features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('@features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function RootGate() {
  const { booting, profile, token } = useAuth()
  if (booting) return <main className="flex min-h-screen items-center justify-center bg-canvas"><LoadingState label="正在启动 Personal Website Studio" /></main>
  if (!profile) return <ConnectionPage />
  if (!token) return <LoginPage />
  return <Outlet />
}

function NotFound() { return <Navigate to="/" replace /> }

function LazyPage({ component: Component }: { component: ComponentType }) {
  return <Suspense fallback={<LoadingState label="正在加载页面" />}><Component /></Suspense>
}

export const router: ReturnType<typeof createHashRouter> = createHashRouter([{
  element: <RootGate />,
  errorElement: <RouteError />,
  children: [{
    element: <AppShell />,
    children: [
      { index: true, element: <LazyPage component={DashboardPage} /> },
      { path: 'content/articles', element: <LazyPage component={ArticlesPage} /> },
      { path: 'content/projects', element: <LazyPage component={ProjectsPage} /> },
      { path: 'content/skills', element: <LazyPage component={SkillsPage} /> },
      { path: 'content/feature-cards', element: <LazyPage component={FeatureCardsPage} /> },
      { path: 'assets/images', element: <LazyPage component={ImagesPage} /> },
      { path: 'assets/themes', element: <LazyPage component={ThemesPage} /> },
      { path: 'assets/music', element: <LazyPage component={MusicPage} /> },
      { path: 'assets/live2d', element: <LazyPage component={Live2DPage} /> },
      { path: 'community', element: <LazyPage component={CommunityPage} /> },
      { path: 'operations/stability', element: <LazyPage component={StabilityPage} /> },
      { path: 'operations/security', element: <LazyPage component={SecurityPage} /> },
      { path: 'settings/profile', element: <LazyPage component={ProfilePage} /> },
      { path: 'settings', element: <LazyPage component={SettingsPage} /> },
      { path: '*', element: <NotFound /> },
    ],
  }],
}])
