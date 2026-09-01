import { lazy, Suspense, useState } from 'react'
import { Bot } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const Live2DWidget = lazy(() => import('./Live2DWidget'))

export default function Live2DController() {
  const { pathname } = useLocation()
  const [enabled, setEnabled] = useState(false)
  const isArticleDetail = /^\/blog\/[^/]+\/?$/.test(pathname)

  if (enabled) {
    return <Suspense fallback={null}><Live2DWidget compact={isArticleDetail} position="bottom-left" /></Suspense>
  }

  return (
    <button
      type="button"
      className={`live2d-launcher ${isArticleDetail ? 'live2d-launcher--article' : ''}`}
      onClick={() => setEnabled(true)}
      aria-label="加载 Live2D 模型"
      title="加载 Live2D 模型"
    >
      <Bot className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
