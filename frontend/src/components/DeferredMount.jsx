import { useEffect, useState } from 'react'
import { cancelIdle, requestIdle } from '../utils/network'

export default function DeferredMount({ children, timeout = 1500, delay = 0, afterLoad = false }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted) return undefined

    let idleHandle = null
    let timer = null
    let removeLoadListener = null

    const schedule = () => {
      timer = window.setTimeout(() => {
        idleHandle = requestIdle(() => {
          idleHandle = null
          setMounted(true)
        }, timeout)
      }, Math.max(0, delay))
    }

    if (afterLoad && document.readyState !== 'complete') {
      window.addEventListener('load', schedule, { once: true })
      removeLoadListener = () => window.removeEventListener('load', schedule)
    } else {
      schedule()
    }

    return () => {
      removeLoadListener?.()
      if (timer !== null) window.clearTimeout(timer)
      if (idleHandle !== null) cancelIdle(idleHandle)
    }
  }, [afterLoad, delay, mounted, timeout])

  return mounted ? children : null
}
