import { useEffect, useState } from 'react'
import { cancelIdle, requestIdle } from '../utils/network'

export default function DeferredMount({ children, timeout = 1500 }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted) return undefined

    const handle = requestIdle(() => {
      setMounted(true)
    }, timeout)

    return () => cancelIdle(handle)
  }, [mounted, timeout])

  return mounted ? children : null
}
