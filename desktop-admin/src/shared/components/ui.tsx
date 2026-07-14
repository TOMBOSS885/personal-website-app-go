import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'border-primary bg-primary text-white hover:bg-[var(--color-primary-hover)]',
    secondary: 'border-line bg-surface text-ink hover:bg-[var(--color-surface-subtle)]',
    danger: 'border-danger bg-danger text-white hover:opacity-90',
    ghost: 'border-transparent bg-transparent text-muted hover:bg-[var(--color-surface-subtle)] hover:text-ink',
  }
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center justify-center gap-2 border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      style={{ borderRadius: 'var(--radius-control)' }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={`control ${props.className || ''}`} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={`control resize-y py-2 ${props.className || ''}`} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select ref={ref} {...props} className={`control ${props.className || ''}`} />
})

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex min-h-12 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : '操作失败，请稍后重试'
  return (
    <div role="alert" className="flex items-start gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" style={{ borderRadius: 6 }}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="break-words">{message}</p>
        {onRetry ? <button type="button" className="mt-2 font-medium underline" onClick={onRetry}>重新尝试</button> : null}
      </div>
    </div>
  )
}

export function LoadingState({ label = '正在加载' }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
      <Inbox className="mb-3 h-9 w-9 text-muted/60" />
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  }
  return <span className={`inline-flex min-h-6 items-center px-2 text-xs font-medium ${tones[tone]}`} style={{ borderRadius: 999 }}>{children}</span>
}

export function Dialog({ open, title, description, children, onClose, footer, size = 'md' }: {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  onClose: () => void
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className={`panel flex max-h-[calc(100vh-40px)] w-full flex-col ${widths[size]}`}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="dialog-title" className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" className="h-8 min-h-8 w-8 px-0" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </header>
        {children ? <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">{children}</div> : null}
        {footer ? <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
      </section>
    </div>
  )
}

export function ConfirmDialog({ open, title, description, confirmLabel = '确认', busy, onCancel, onConfirm }: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="sm"
      footer={<><Button onClick={onCancel} disabled={busy}>取消</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? '处理中...' : confirmLabel}</Button></>}
    />
  )
}
