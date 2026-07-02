export function preloadImage(src, { timeout = 12000 } = {}) {
  if (!src) return Promise.resolve(false)

  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const timer = window.setTimeout(() => finish(false), timeout)

    function finish(ok) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(ok)
    }

    img.onload = async () => {
      try {
        if (img.decode) {
          await img.decode()
        }
        finish(true)
      } catch {
        finish(true)
      }
    }
    img.onerror = () => finish(false)
    img.decoding = 'async'
    img.src = src
  })
}

export function resolveAssetUrl(path, baseUrl = window.location.href) {
  try {
    return new URL(path, baseUrl).href
  } catch {
    return path
  }
}
