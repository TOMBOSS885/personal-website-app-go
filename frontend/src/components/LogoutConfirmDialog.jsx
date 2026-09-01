import { useEffect, useRef } from 'react'
import { AlertTriangle, LogOut, X } from 'lucide-react'

export default function LogoutConfirmDialog({ open, identity = '', busy = false, onCancel, onConfirm }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description" className="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl outline-none dark:border-red-500/30 dark:bg-slate-900">
        <div className="flex items-start gap-4 border-b border-red-100 bg-red-50 px-5 py-5 dark:border-red-500/20 dark:bg-red-950/35">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"><AlertTriangle className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="logout-confirm-title" className="text-lg font-bold text-red-900 dark:text-red-100">确认退出登录？</h2>
            <p id="logout-confirm-description" className="mt-1 text-sm leading-6 text-red-800/80 dark:text-red-200/80">退出后需要重新登录才能查看受限内容和继续管理操作。</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg p-1.5 text-red-500 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/20" title="取消退出" aria-label="取消退出"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">
          {identity && <p className="truncate text-sm text-gray-600 dark:text-slate-300">当前账号：<span className="font-semibold text-gray-900 dark:text-slate-100">{identity}</span></p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">继续登录</button>
            <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"><LogOut className="h-4 w-4" />{busy ? '正在退出...' : '确认退出'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
