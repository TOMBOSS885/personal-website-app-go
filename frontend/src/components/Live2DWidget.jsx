import { useEffect, useRef } from 'react'

const API_BASE = ''

export default function Live2DWidget() {
  const widgetRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      try {
        const res = await fetch(`${API_BASE}/api/public/live2d-model`)
        if (!res.ok) {
          return
        }

        const data = await res.json()
        if (cancelled || data.enabled === false || !data.modelPath) {
          return
        }

        const { createWidget } = await import('l2d-widget')
        if (cancelled) {
          return
        }

        widgetRef.current = createWidget({
          model: {
            path: data.modelPath,
            tips: {
              welcomeMessage: ['欢迎回来，今天也要开心写代码。'],
              messages: ['需要休息一下眼睛吗？', '记得保存你的灵感。'],
              duration: 3500,
              interval: 9000,
            },
          },
          position: 'bottom-right',
          size: 280,
          primaryColor: 'rgba(96,165,250,0.92)',
        })
      } catch (err) {
        console.warn('Live2D model failed to load:', err)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      if (widgetRef.current) {
        widgetRef.current.destroy()
        widgetRef.current = null
      }
    }
  }, [])

  return null
}
