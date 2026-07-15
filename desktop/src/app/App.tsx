import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { ArticlesPage } from '../features/articles/ArticlesPage'
import { HomePage } from '../features/home/HomePage'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { SearchPage } from '../features/search/SearchPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AccountPage } from '../features/account/AccountPage'
import { LoadingState } from '../shared/components/AsyncState'

const ArticleDetailPage = lazy(() => import('../features/articles/ArticleDetailPage').then((module) => ({
  default: module.ArticleDetailPage,
})))

export function App() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route
            path="articles/:id"
            element={(
              <Suspense fallback={<LoadingState label="正在打开文章" />}>
                <ArticleDetailPage />
              </Suspense>
            )}
          />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  )
}
