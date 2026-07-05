import { useEffect, useState } from 'react'
import { AlertTriangle, Music, ShieldAlert, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AccessAlert() {
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    const onAlert = event => {
      setAlert({
        id: Date.now(),
        type: event.detail?.type || 'limit',
        category: event.detail?.category || '',
        message: event.detail?.message || '访问次数过多，请稍后重试',
      })
    }
    window.addEventListener('access-alert', onAlert)
    return () => window.removeEventListener('access-alert', onAlert)
  }, [])

  useEffect(() => {
    if (!alert) return undefined
    const timer = window.setTimeout(() => setAlert(null), 4200)
    return () => window.clearTimeout(timer)
  }, [alert])

  const isMusic = alert?.category === 'music' || alert?.category === 'music-stream'
  const isBan = alert?.type === 'ban'
  const Icon = isBan ? ShieldAlert : isMusic ? Music : AlertTriangle
  const tone = isBan
    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/80 dark:text-red-100'
    : isMusic
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-100'
      : 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/80 dark:text-indigo-100'

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          className={`fixed right-4 top-5 z-[120] flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${tone}`}
        >
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {isBan ? '访问已被限制' : isMusic ? '音乐访问过于频繁' : '访问过于频繁'}
            </div>
            <div className="mt-0.5 text-sm opacity-85">{alert.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
