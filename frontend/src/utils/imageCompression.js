const DEFAULT_MAX_DIMENSION = 1920
const DEFAULT_MAX_BYTES = 1.5 * 1024 * 1024
const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54]

export function calculateContainedSize(width, height, maxDimension = DEFAULT_MAX_DIMENSION) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const scale = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight))
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取背景图片'))
    }
    image.src = url
  })
}

function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function getExtension(type) {
  return {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }[type] || 'jpg'
}

export async function optimizeImageFile(file, options = {}) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES
  const skipBelowBytes = options.skipBelowBytes ?? 256 * 1024
  const image = await loadImage(file)
  const size = calculateContainedSize(image.naturalWidth, image.naturalHeight, maxDimension)

  // Animated GIFs cannot be safely drawn to a canvas without losing animation.
  if (file.type === 'image/gif') {
    if (file.size > maxBytes) throw new Error('GIF 图片过大，请换用 JPG 或 WebP')
    return file
  }

  if (file.size <= Math.min(maxBytes, skipBelowBytes) && size.width === image.naturalWidth && size.height === image.naturalHeight && options.skipSmall !== false) {
    return file
  }

  await yieldToBrowser()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法压缩图片')

  let best = null
  const dimensionScales = [1, 0.82, 0.68, 0.56, 0.46]
  compressionLoop:
  for (const dimensionScale of dimensionScales) {
    canvas.width = Math.max(1, Math.round(size.width * dimensionScale))
    canvas.height = Math.max(1, Math.round(size.height * dimensionScale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality)
      if (!blob) continue
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= maxBytes) {
        best = blob
        break compressionLoop
      }
    }
    await yieldToBrowser()
  }
  if (!best) throw new Error('图片压缩失败')

  // Never replace a small source with a larger encoded result.
  if (best.size >= file.size && file.size <= maxBytes && size.width === image.naturalWidth && size.height === image.naturalHeight) return file

  const type = best.type === 'image/webp' ? best.type : 'image/jpeg'
  return new File([best], `${options.name || 'image'}-${Date.now()}.${getExtension(type)}`, { type })
}

export function optimizeArticleImage(file, options = {}) {
  return optimizeImageFile(file, {
    maxDimension: options.maxDimension || 1600,
    maxBytes: options.maxBytes || 1024 * 1024,
    name: options.name || 'article',
    ...options,
  })
}

export function optimizeCoverImage(file, options = {}) {
  return optimizeImageFile(file, {
    maxDimension: options.maxDimension || 1440,
    maxBytes: options.maxBytes || 800 * 1024,
    name: options.name || 'cover',
    ...options,
  })
}

export function optimizeBackgroundImage(file, options = {}) {
  return optimizeImageFile(file, {
    maxDimension: options.maxDimension || DEFAULT_MAX_DIMENSION,
    maxBytes: options.maxBytes || DEFAULT_MAX_BYTES,
    name: options.name || 'background',
    ...options,
  })
}
