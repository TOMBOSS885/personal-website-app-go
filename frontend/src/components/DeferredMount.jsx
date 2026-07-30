import { useEffect, useState } from 'react'
import { cancelIdle, requestIdle } from '../utils/network'

export default function DeferredMount({ children, timeout = 1500, delay = 0 }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted) return undefined

    let idleHandle = null
    const timer = window.setTimeout(() => {
      idleHandle = requestIdle(() => {
        idleHandle = null
        setMounted(true)
      }, timeout)
    }, Math.max(0, delay))

    return () => {
      window.clearTimeout(timer)
      if (idleHandle !== null) cancelIdle(idleHandle)
    }
  }, [delay, mounted, timeout])

  return mounted ? children : null
}
