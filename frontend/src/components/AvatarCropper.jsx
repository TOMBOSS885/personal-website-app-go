import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader, X } from 'lucide-react'

const CROP_SIZE = 256
const OUTPUT_SIZE = 512
const MAX_OUTPUT_BYTES = 500 * 1024

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function AvatarCropper({ file, onCancel, onConfirm, onError, processing = false }) {
  const imageRef = useRef(null)
  const dragRef = useRef(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [compressing, setCompressing] = useState(false)
  const busy = processing || compressing

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!file) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, file, onCancel])

  const getBaseScale = (size = naturalSize) => {
    if (!size.width || !size.height) return 1
    return Math.max(CROP_SIZE / size.width, CROP_SIZE / size.height)
  }

  const getDisplaySize = (nextZoom = zoom, size = naturalSize) => {
    const scale = getBaseScale(size) * nextZoom
    return {
      width: size.width * scale,
      height: size.height * scale,
      scale,
    }
  }

  const clampOffset = (nextOffset, nextZoom = zoom, size = naturalSize) => {
    const display = getDisplaySize(nextZoom, size)
    return {
      x: clamp(nextOffset.x, CROP_SIZE - display.width, 0),
      y: clamp(nextOffset.y, CROP_SIZE - display.height, 0),
    }
  }

  const handleImageLoad = (event) => {
    const size = {
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    }
    const display = getDisplaySize(1, size)
    setNaturalSize(size)
    setZoom(1)
    setOffset({
      x: (CROP_SIZE - display.width) / 2,
      y: (CROP_SIZE - display.height) / 2,
    })
  }

  const handlePointerDown = (event) => {
    if (busy) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset(clampOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }))
  }

  const handlePointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }

  const handleZoomChange = (event) => {
    const nextZoom = Number(event.target.value)
    const oldDisplay = getDisplaySize()
    const nextDisplay = getDisplaySize(nextZoom)
    const centerX = CROP_SIZE / 2
    const centerY = CROP_SIZE / 2
    const imageCenterXRatio = (centerX - offset.x) / oldDisplay.width
    const imageCenterYRatio = (centerY - offset.y) / oldDisplay.height
    const nextOffset = {
      x: centerX - nextDisplay.width * imageCenterXRatio,
      y: centerY - nextDisplay.height * imageCenterYRatio,
    }
    setZoom(nextZoom)
    setOffset(clampOffset(nextOffset, nextZoom))
  }

  const confirmCrop = async () => {
    const image = imageRef.current
    if (busy || !image || !naturalSize.width || !naturalSize.height) return
    setCompressing(true)
    try {
      const display = getDisplaySize()
      const sourceX = -offset.x / display.scale
      const sourceY = -offset.y / display.scale
      const sourceSize = CROP_SIZE / display.scale

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('当前浏览器无法处理图片')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      let blob = null
      for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
        blob = await canvasToBlob(canvas, 'image/jpeg', quality)
        if (blob && blob.size <= MAX_OUTPUT_BYTES) break
      }
      if (!blob || blob.size > MAX_OUTPUT_BYTES) throw new Error('图片压缩失败，请更换一张图片')
      await onConfirm(blob)
    } catch (error) {
      onError?.(error.message || '头像处理失败')
    } finally {
      setCompressing(false)
    }
  }

  if (!file) return null

  return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-2 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
		<div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
				<h3 id="avatar-crop-title" className="text-lg font-semibold text-gray-900 dark:text-white">裁剪头像</h3>
				<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">拖动图片并调整缩放，裁剪结果会压缩到 500KB 内。</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
				disabled={busy}
				aria-label="关闭头像裁剪"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center">
          <div
			className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-gray-100 active:cursor-grabbing dark:bg-gray-800"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={previewUrl}
              alt="avatar crop preview"
              draggable={false}
              onLoad={handleImageLoad}
              className="absolute max-w-none select-none"
              style={{
                width: `${getDisplaySize().width}px`,
                height: `${getDisplaySize().height}px`,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full border-4 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
          </div>
        </div>

		<label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-200">
          缩放
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={handleZoomChange}
			disabled={busy}
            className="mt-2 w-full accent-purple-500"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
			disabled={busy}
			className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={confirmCrop}
			disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 font-medium text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
          >
			{busy ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
			{compressing ? '压缩中...' : processing ? '上传中...' : '使用头像'}
          </button>
        </div>
      </div>
    </div>
  )
}
