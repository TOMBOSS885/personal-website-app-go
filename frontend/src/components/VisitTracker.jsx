import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const VISITOR_KEY = 'site-visitor-id'

export default function VisitTracker() {
  const location = useLocation()
  const lastPath = useRef('')

  useEffect(() => {
    const path = location.pathname || '/'
    if (lastPath.current === path) return undefined
    lastPath.current = path

    const send = () => {
      const visitorId = getVisitorId()
      if (!visitorId) return
      const payload = JSON.stringify({
        visitorId,
        path,
        title: document.title,
        referrerHost: getReferrerHost(),
        screenWidth: Math.round(window.screen?.width || window.innerWidth || 0),
      })
      fetch('/api/public/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {})
    }

    let timer
    let idleId
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(send, { timeout: 2500 })
    else timer = window.setTimeout(send, 1200)
    return () => {
      if (idleId) window.cancelIdleCallback?.(idleId)
      if (timer) window.clearTimeout(timer)
    }
  }, [location.pathname])

  return null
}

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

function getReferrerHost() {
  try {
    return document.referrer ? new URL(document.referrer).host : ''
  } catch {
    return ''
  }
}
