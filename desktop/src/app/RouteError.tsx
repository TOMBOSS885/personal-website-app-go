import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@shared/components/ui'

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : '页面发生未知错误'
  return <main className="flex min-h-screen items-center justify-center bg-canvas p-6"><section className="panel max-w-lg p-7 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-4 text-lg font-semibold">页面无法继续运行</h1><p className="mt-2 break-words text-sm text-muted">{message}</p><Button variant="primary" className="mt-5" onClick={() => window.location.reload()}><RotateCcw className="h-4 w-4" />重新加载应用</Button></section></main>
}
