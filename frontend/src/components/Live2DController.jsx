import { lazy, Suspense, useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { isConstrainedConnection, isLowEndDevice } from '../utils/network'

const Live2DWidget = lazy(() => import('./Live2DWidget'))
const HOME_AUTO_LOAD_DELAY_MS = 24000

function canAutoLoadOnHome() {
  if (typeof window === 'undefined') return false
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return window.innerWidth >= 900
    && !coarsePointer
    && !reducedMotion
    && !isConstrainedConnection()
    && !isLowEndDevice()
}

export default function Live2DController() {
  const { pathname } = useLocation()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(false)
    if (pathname !== '/' || !canAutoLoadOnHome()) return undefined
    const timer = window.setTimeout(() => setEnabled(true), HOME_AUTO_LOAD_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pathname])

  if (enabled) {
    return <Suspense fallback={null}><Live2DWidget /></Suspense>
  }

  return (
    <button
      type="button"
      className="live2d-launcher"
      onClick={() => setEnabled(true)}
      aria-label="加载 Live2D 模型"
      title="加载 Live2D 模型"
    >
      <Bot className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
