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
  // `deviceMemory` is not exposed by every browser (notably some Linux
  // Chromium builds), so also use the CPU count as a conservative signal.
  // This is only used to disable decorative effects; it never changes
  // application functionality or data fetching.
  const memory = Number(navigator.deviceMemory)
  const cores = Number(navigator.hardwareConcurrency)
  return (Number.isFinite(memory) && memory > 0 && memory <= 4)
    || (Number.isFinite(cores) && cores > 0 && cores <= 4)
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
  let removeAbortListener = null

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      const onAbort = () => controller.abort()
      signal.addEventListener('abort', onAbort, { once: true })
      removeAbortListener = () => signal.removeEventListener('abort', onAbort)
    }
  }

  return fetch(input, {
    ...rest,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer)
    removeAbortListener?.()
  })
}
