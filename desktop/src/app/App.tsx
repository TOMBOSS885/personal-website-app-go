import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { ArticleDetailPage } from '../features/articles/ArticleDetailPage'
import { ArticlesPage } from '../features/articles/ArticlesPage'
import { HomePage } from '../features/home/HomePage'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { SearchPage } from '../features/search/SearchPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AccountPage } from '../features/account/AccountPage'

export function App() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles/:id" element={<ArticleDetailPage />} />
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
