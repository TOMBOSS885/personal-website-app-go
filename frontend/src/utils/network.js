export function getConnectionInfo() {
  if (typeof navigator === 'undefined') {
    return {}
  }
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || {}
}

export function isConstrainedConnection() {
  const connection = getConnectionInfo()
  return Boolean(
    connection.saveData
      || connection.effectiveType === 'slow-2g'
      || connection.effectiveType === '2g'
  )
}

export function isLowEndDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }
  return navigator.deviceMemory && navigator.deviceMemory <= 2
}

export function requestIdle(callback, timeout = 1500) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout })
  }
  return window.setTimeout(callback, Math.min(timeout, 500))
}

export function cancelIdle(handle) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle)
    return
  }
  window.clearTimeout(handle)
}

export function fetchWithTimeout(input, init = {}, timeout = 8000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const { signal, ...rest } = init

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  return fetch(input, {
    ...rest,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer)
  })
}
