import { useEffect, useRef } from 'react'
import { preloadImage, resolveAssetUrl } from '../utils/assets'
import { cancelIdle, fetchWithTimeout, isConstrainedConnection, isLowEndDevice, requestIdle } from '../utils/network'

const API_BASE = ''

export default function Live2DWidget() {
  const widgetRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let idleHandle = null
    let retryTimer = null
    let retryCount = 0

    async function loadModel() {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/public/live2d-model`, {}, 7000)
        if (!res.ok) {
          return
        }

        const data = await res.json()
        const models = Array.isArray(data.models)
          ? data.models
          : data.modelPath
            ? [data]
            : []

        if (cancelled || data.enabled === false || models.length === 0) {
          return
        }

        const constrained = isConstrainedConnection()
        const lowEnd = isLowEndDevice()
        const selectedModels = constrained || lowEnd ? models.slice(0, 1) : models
        const prewarmed = await prewarmLive2DModels(selectedModels)
        if (!prewarmed) {
          if (retryCount < 2) {
            retryCount += 1
            retryTimer = window.setTimeout(() => {
              if (!cancelled) {
                void loadModel()
              }
            }, constrained ? 12000 : 5000)
          }
          return
        }

        const { createWidget } = await import('l2d-widget')
        if (cancelled) {
          return
        }

        const settings = data.settings || {}
        const widgetModels = selectedModels.map(model => ({
          path: model.modelPath,
          scale: numberOr(model.scale, 1),
          offset: [numberOr(model.offsetX, 0), numberOr(model.offsetY, 0)],
          volume: numberOr(model.volume, 0),
          tips: model.tipsEnabled === false
            ? false
            : {
                welcomeMessage: splitLines(model.welcomeMessages),
                messages: splitLines(model.tipMessages),
                duration: numberOr(model.tipDuration, 3500),
                interval: numberOr(model.tipInterval, 9000),
                offset: {
                  x: numberOr(model.tipOffsetX, 0),
                  y: numberOr(model.tipOffsetY, 0),
                },
                typing: model.typingEnabled
                  ? {
                      param: model.typingParam || undefined,
                      speed: numberOr(model.typingSpeed, 120),
                      minValue: numberOr(model.typingMinValue, 0),
                      maxValue: numberOr(model.typingMaxValue, 1),
                    }
                  : undefined,
          },
        }))

        const menuItems = []
        if (widgetModels.length > 1) {
          let nextModelIndex = 0
          menuItems.push({
            icon: 'mdi:shuffle-variant',
            label: '切换模型',
            onClick(widget) {
              nextModelIndex = (nextModelIndex + 1) % widgetModels.length
              void widget.switchModel(nextModelIndex)
            },
          })
        }
        if (settings.showSleepButton !== false) {
          menuItems.push({
            icon: 'mdi:bed',
            label: '休眠',
            onClick(widget) {
              widget.sleep()
            },
          })
        }
        if (settings.showAboutButton) {
          menuItems.push({
            icon: 'mdi:information-outline',
            label: '关于',
            onClick() {
              window.open('https://github.com/hacxy/l2d-widget', '_blank', 'noopener')
            },
          })
        }

        widgetRef.current = createWidget({
          model: widgetModels.length === 1 ? widgetModels[0] : widgetModels,
          position: settings.position || 'bottom-right',
          size: lowEnd || window.innerWidth < 640
            ? Math.min(numberOr(settings.size, 280), 220)
            : numberOr(settings.size, 280),
          primaryColor: settings.primaryColor || 'rgba(96,165,250,0.92)',
          transitionType: settings.transitionType || 'slide',
          transitionDuration: lowEnd ? 400 : numberOr(settings.transitionDuration, 1500),
          menus: {
            align: settings.menuAlign || 'right',
            items: menuItems,
          },
        })
      } catch (err) {
        console.warn('Live2D model failed to load:', err)
      }
    }

    idleHandle = requestIdle(() => {
      void loadModel()
    }, isConstrainedConnection() ? 3000 : 1200)

    return () => {
      cancelled = true
      if (idleHandle) {
        cancelIdle(idleHandle)
      }
      if (retryTimer) {
        window.clearTimeout(retryTimer)
      }
      if (widgetRef.current) {
        widgetRef.current.destroy()
        widgetRef.current = null
      }
    }
  }, [])

  return null
}

async function prewarmLive2DModels(models) {
  if (!Array.isArray(models) || models.length === 0) {
    return false
  }
  const results = await Promise.allSettled(models.slice(0, 1).map(prewarmLive2DModel))
  return results.some(result => result.status === 'fulfilled' && result.value)
}

async function prewarmLive2DModel(model) {
  if (!model?.modelPath) {
    return false
  }
  const modelUrl = resolveAssetUrl(model.modelPath)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(modelUrl, {
      cache: 'force-cache',
      signal: controller.signal,
    })
    if (!res.ok) {
      return false
    }
    const modelJson = await res.json()
    const textures = getLive2DTextureUrls(modelJson, modelUrl)
    if (textures.length === 0) {
      return true
    }
    const textureResults = await Promise.allSettled(
      textures.slice(0, 4).map(src => preloadImage(src, { timeout: 12000 }))
    )
    return textureResults.some(result => result.status === 'fulfilled' && result.value)
  } catch (err) {
    console.warn('Live2D prewarm failed:', err)
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

function getLive2DTextureUrls(modelJson, modelUrl) {
  const refs = modelJson?.FileReferences || {}
  const textures = Array.isArray(refs.Textures)
    ? refs.Textures
    : Array.isArray(modelJson?.textures)
      ? modelJson.textures
      : []

  return textures
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => resolveAssetUrl(item, modelUrl))
}

function splitLines(value) {
  if (!value || typeof value !== 'string') {
    return []
  }
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

function numberOr(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
