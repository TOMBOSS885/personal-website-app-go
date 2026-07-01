import { useEffect, useRef } from 'react'

const API_BASE = ''

export default function Live2DWidget() {
  const widgetRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      try {
        const res = await fetch(`${API_BASE}/api/public/live2d-model`)
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

        const { createWidget } = await import('l2d-widget')
        if (cancelled) {
          return
        }

        const settings = data.settings || {}
        const widgetModels = models.map(model => ({
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
          size: numberOr(settings.size, 280),
          primaryColor: settings.primaryColor || 'rgba(96,165,250,0.92)',
          transitionType: settings.transitionType || 'slide',
          transitionDuration: numberOr(settings.transitionDuration, 1500),
          menus: {
            align: settings.menuAlign || 'right',
            items: menuItems,
          },
        })
      } catch (err) {
        console.warn('Live2D model failed to load:', err)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      if (widgetRef.current) {
        widgetRef.current.destroy()
        widgetRef.current = null
      }
    }
  }, [])

  return null
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
