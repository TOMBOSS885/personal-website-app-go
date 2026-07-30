const BUNDLE_MAGIC = 'L2DBNDL1'
const MAX_SOURCE_FILES = 512
const MAX_SOURCE_BYTES = 100 * 1024 * 1024
const MAX_BUNDLE_BYTES = 20 * 1024 * 1024
const MAX_TEXTURE_DIMENSION = 1536
const TARGET_TEXTURE_BYTES = 768 * 1024
const RUNTIME_EXTENSION = /\.(?:json|moc3?|mtn|exp|png|jpe?g|webp)$/i
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i
const AUDIO_EXTENSION = /\.(?:mp3|wav|ogg|m4a)$/i

export function normalizeLive2DPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
}

export function createLive2DSelection(files) {
  const source = Array.from(files || [])
  if (source.length === 0) return { items: [], entries: [], sourceBytes: 0 }
  if (source.length > MAX_SOURCE_FILES) throw new Error(`模型文件不能超过 ${MAX_SOURCE_FILES} 个`)

  const sourceBytes = source.reduce((total, file) => total + Number(file.size || 0), 0)
  if (sourceBytes > MAX_SOURCE_BYTES) throw new Error('模型原始文件超过 100MB，请先删除非运行资源')

  const rawPaths = source.map(file => normalizeLive2DPath(file.webkitRelativePath || file.name))
  const firstSegments = rawPaths.map(path => path.split('/')[0])
  const stripRoot = rawPaths.every(path => path.includes('/'))
    && firstSegments.every(segment => segment === firstSegments[0])
  const items = source.map((file, index) => ({
    file,
    path: stripRoot ? rawPaths[index].split('/').slice(1).join('/') : rawPaths[index],
  })).filter(item => item.path && !item.path.split('/').some(part => part === '.' || part === '..'))

  const entries = items
    .map(item => item.path)
    .filter(path => /(?:^|\/)(?:model\.json|[^/]+\.model(?:3)?\.json)$/i.test(path))
    .sort((a, b) => a.length - b.length)

  return { items, entries, sourceBytes }
}

export async function buildLive2DBundle(selection, entryPath, onProgress = () => {}) {
  const normalizedEntry = normalizeLive2DPath(entryPath)
  const allItems = new Map()
  const lowerPaths = new Map()
  for (const item of selection.items || []) {
    if (!RUNTIME_EXTENSION.test(item.path) || AUDIO_EXTENSION.test(item.path)) continue
    allItems.set(item.path, item)
    lowerPaths.set(item.path.toLowerCase(), item.path)
  }
  if (!allItems.has(normalizedEntry)) throw new Error('找不到选中的模型入口 JSON')

  onProgress({ phase: 'analyzing', completed: 0, total: allItems.size })
  const requiredPaths = await collectRequiredFiles(allItems, lowerPaths, normalizedEntry)
  const selectedItems = Array.from(requiredPaths).map(path => allItems.get(path)).filter(Boolean)
  const pathReplacements = new Map()
  const optimizedImages = new Map()

  let completed = 0
  for (const item of selectedItems.filter(candidate => IMAGE_EXTENSION.test(candidate.path))) {
    const optimized = await optimizeTexture(item.file)
    if (optimized !== item.file) {
      const nextPath = item.path.replace(IMAGE_EXTENSION, '.webp')
      pathReplacements.set(item.path, nextPath)
      optimizedImages.set(item.path, optimized)
    }
    completed += 1
    onProgress({ phase: 'compressing', completed, total: selectedItems.length })
    await yieldToBrowser()
  }

  const outputFiles = []
  for (const item of selectedItems) {
    let outputPath = pathReplacements.get(item.path) || item.path
    let blob = optimizedImages.get(item.path) || item.file
    if (/\.json$/i.test(item.path)) {
      const json = JSON.parse(await item.file.text())
      const optimizedJson = rewriteJsonAssets(json, item.path, pathReplacements)
      blob = new Blob([JSON.stringify(optimizedJson)], { type: 'application/json' })
    }
    outputFiles.push({ path: outputPath, blob })
    completed += 1
    onProgress({ phase: 'packing', completed, total: selectedItems.length * 2 })
  }

  const manifest = {
    version: 1,
    entryPath: pathReplacements.get(normalizedEntry) || normalizedEntry,
    files: outputFiles.map(item => ({ path: item.path, size: item.blob.size })),
  }
  const encoder = new TextEncoder()
  const magic = encoder.encode(BUNDLE_MAGIC)
  const manifestBytes = encoder.encode(JSON.stringify(manifest))
  const manifestLength = new ArrayBuffer(4)
  new DataView(manifestLength).setUint32(0, manifestBytes.length, true)
  const bundle = new Blob(
    [magic, manifestLength, manifestBytes, ...outputFiles.map(item => item.blob)],
    { type: 'application/octet-stream' },
  )
  if (bundle.size > MAX_BUNDLE_BYTES) {
    throw new Error('压缩后的模型仍超过 20MB，请减少纹理或动作文件')
  }

  return {
    bundle,
    fileCount: outputFiles.length,
    sourceBytes: selection.sourceBytes || 0,
    optimizedBytes: bundle.size,
  }
}

async function collectRequiredFiles(items, lowerPaths, entryPath) {
  const required = new Set([entryPath])
  const queue = [entryPath]
  while (queue.length > 0) {
    const currentPath = queue.shift()
    if (!/\.json$/i.test(currentPath)) continue
    const item = items.get(currentPath)
    if (!item) continue
    let json
    try {
      json = JSON.parse(await item.file.text())
    } catch {
      if (currentPath === entryPath) throw new Error('模型入口 JSON 格式无效')
      continue
    }
    walkJsonStrings(json, value => {
      if (typeof value !== 'string' || !RUNTIME_EXTENSION.test(stripQuery(value))) return
      const resolved = resolveReference(currentPath, stripQuery(value))
      const matched = items.has(resolved) ? resolved : lowerPaths.get(resolved.toLowerCase())
      if (matched && !required.has(matched)) {
        required.add(matched)
        queue.push(matched)
      }
    })
  }
  return required
}

function rewriteJsonAssets(value, jsonPath, replacements) {
  if (Array.isArray(value)) return value.map(item => rewriteJsonAssets(item, jsonPath, replacements))
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string' || !IMAGE_EXTENSION.test(stripQuery(value))) return value
    const resolved = resolveReference(jsonPath, stripQuery(value))
    const nextPath = replacements.get(resolved)
    return nextPath ? relativeReference(jsonPath, nextPath) : value
  }

  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if ((key.toLowerCase() === 'sound' || key.toLowerCase() === 'audio')
      && typeof child === 'string' && AUDIO_EXTENSION.test(stripQuery(child))) continue
    result[key] = rewriteJsonAssets(child, jsonPath, replacements)
  }
  return result
}

function walkJsonStrings(value, callback) {
  if (typeof value === 'string') {
    callback(value)
  } else if (Array.isArray(value)) {
    value.forEach(item => walkJsonStrings(item, callback))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => walkJsonStrings(item, callback))
  }
}

function resolveReference(jsonPath, reference) {
  if (/^(?:[a-z]+:|\/)/i.test(reference)) return normalizeLive2DPath(reference)
  const parts = `${dirname(jsonPath)}/${reference}`.split('/')
  const normalized = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') normalized.pop()
    else normalized.push(part)
  }
  return normalized.join('/')
}

function relativeReference(fromFile, toFile) {
  const from = dirname(fromFile).split('/').filter(Boolean)
  const to = toFile.split('/').filter(Boolean)
  while (from.length && to.length && from[0] === to[0]) {
    from.shift()
    to.shift()
  }
  return [...from.map(() => '..'), ...to].join('/')
}

function dirname(path) {
  const parts = normalizeLive2DPath(path).split('/')
  parts.pop()
  return parts.join('/')
}

function stripQuery(value) {
  return String(value).split(/[?#]/)[0]
}

async function optimizeTexture(file) {
  const decoded = await loadTextureForCanvas(file)
  const canvas = document.createElement('canvas')
  canvas.width = decoded.width
  canvas.height = decoded.height
  const context = canvas.getContext('2d')
  if (!context) {
    decoded.release()
    return file
  }
  context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
  decoded.release()

  let smallest = null
  for (const quality of [0.72, 0.58, 0.46]) {
    const blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (!blob || blob.type !== 'image/webp') continue
    if (!smallest || blob.size < smallest.size) smallest = blob
    if (blob.size <= Math.min(TARGET_TEXTURE_BYTES, file.size * 0.6)) break
  }
  canvas.width = 1
  canvas.height = 1
  return smallest && smallest.size < file.size ? smallest : file
}

async function loadTextureForCanvas(file) {
  const dimensions = await readPngDimensions(file)
  const scale = dimensions
    ? Math.min(1, MAX_TEXTURE_DIMENSION / Math.max(dimensions.width, dimensions.height))
    : 1

  if (dimensions && scale < 1 && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, {
        resizeWidth: Math.max(1, Math.round(dimensions.width * scale)),
        resizeHeight: Math.max(1, Math.round(dimensions.height * scale)),
        resizeQuality: 'high',
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Older browsers fall back to the regular image decoder below.
    }
  }

  const image = await loadImage(file)
  const fallbackScale = Math.min(1, MAX_TEXTURE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  return {
    source: image,
    width: Math.max(1, Math.round(image.naturalWidth * fallbackScale)),
    height: Math.max(1, Math.round(image.naturalHeight * fallbackScale)),
    release: () => image.removeAttribute('src'),
  }
}

async function readPngDimensions(file) {
  if (!/\.png$/i.test(file.name || '')) return null
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer())
  if (bytes.length < 24
    || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47
    || bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`无法读取纹理 ${file.name}`))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function yieldToBrowser() {
  return new Promise(resolve => window.setTimeout(resolve, 0))
}
