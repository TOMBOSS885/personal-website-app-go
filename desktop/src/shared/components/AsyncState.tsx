import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'

export function LoadingState({ label = '正在同步内容' }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={24} />
      <strong>{label}</strong>
      <span>请稍候</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, action }: { error: unknown; onRetry?: () => void; action?: ReactNode }) {
  const message = error instanceof Error ? error.message : '加载失败'
  const requestId = error instanceof ApiError ? error.requestId : undefined
  return (
    <div className="state-panel state-error" role="alert">
      <AlertCircle size={24} />
      <strong>暂时无法读取内容</strong>
      <span>{message}</span>
      {requestId && <small>请求编号：{requestId}</small>}
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          重试
        </button>
      )}
      {action}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="state-panel">
      <Inbox size={24} />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  )
}
