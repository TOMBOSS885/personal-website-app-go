import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { collectUnreportedTransferBytes } from '../utils/siteMonitor'

const VISITOR_KEY = 'site-visitor-id'

export default function VisitTracker() {
  const location = useLocation()
  const lastPath = useRef('')
  const reportedPerformanceEntries = useRef(new Set())

  useEffect(() => {
    const path = location.pathname || '/'
    if (lastPath.current === path) return undefined
    lastPath.current = path

    let sent = false
    const send = (preferBeacon = false) => {
      if (sent) return
      sent = true
      const visitorId = getVisitorId()
      if (!visitorId) return
      const payload = JSON.stringify({
        visitorId,
        path,
        title: document.title,
        referrerHost: getReferrerHost(),
        screenWidth: Math.round(window.screen?.width || window.innerWidth || 0),
        transferredBytes: collectUnreportedTransferBytes(window.performance, reportedPerformanceEntries.current),
      })

      if (preferBeacon && typeof navigator.sendBeacon === 'function') {
        const body = new Blob([payload], { type: 'application/json' })
        if (navigator.sendBeacon('/api/public/analytics/visit', body)) return
      }

      fetch('/api/public/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => {})
    }

    let timer = null
    let idleId = null
    let removeLoadListener = null
    const handlePageHide = () => send(true)
    window.addEventListener('pagehide', handlePageHide, { once: true })

    const schedule = () => {
      // Analytics is useful but must never compete with the page's data,
      // images, or article renderer on a high-latency shared host.
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(send, { timeout: 3000 })
        else send()
      }, 6000)
    }

    if (document.readyState === 'complete') {
      schedule()
    } else {
      window.addEventListener('load', schedule, { once: true })
      removeLoadListener = () => window.removeEventListener('load', schedule)
    }

    return () => {
      removeLoadListener?.()
      if (idleId !== null) window.cancelIdleCallback?.(idleId)
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener('pagehide', handlePageHide)
      send()
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
