import { useEffect, useRef } from 'react'

const MAX_PARTICLES = 90
const MOVE_DISTANCE = 10
const MOVE_INTERVAL = 22
const DPR_LIMIT = 2

function parseColor(value, fallback) {
  const text = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return {
      r: parseInt(text.slice(1, 3), 16),
      g: parseInt(text.slice(3, 5), 16),
      b: parseInt(text.slice(5, 7), 16),
    }
  }

  const rgb = text.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    }
  }

  return fallback
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    primary: parseColor(styles.getPropertyValue('--theme-primary'), { r: 99, g: 102, b: 241 }),
    secondary: parseColor(styles.getPropertyValue('--theme-secondary'), { r: 139, g: 92, b: 246 }),
    accent: parseColor(styles.getPropertyValue('--theme-accent'), { r: 245, g: 158, b: 11 }),
  }
}

function isInputTarget(target) {
  return target?.closest?.('input, textarea, select, [contenteditable="true"]')
}

export default function CursorEffects() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const particlesRef = useRef([])
  const ringsRef = useRef([])
  const lastPointRef = useRef({ x: 0, y: 0, time: 0, hasPoint: false })
  const colorsRef = useRef({
    primary: { r: 99, g: 102, b: 241 },
    secondary: { r: 139, g: 92, b: 246 },
    accent: { r: 245, g: 158, b: 11 },
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    if (reducedMotion.matches || coarsePointer.matches) {
      canvas.style.display = 'none'
      return undefined
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      colorsRef.current = getThemeColors()
    }

    const draw = () => {
      const particles = particlesRef.current
      const rings = ringsRef.current
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]
        p.age += 1
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.size *= 0.985

        const progress = p.age / p.life
        const alpha = Math.max(0, (1 - progress) * p.alpha)
        if (progress >= 1 || alpha <= 0.01) {
          particles.splice(i, 1)
          continue
        }

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.4)
        gradient.addColorStop(0, rgba(p.color, alpha))
        gradient.addColorStop(0.45, rgba(p.color, alpha * 0.34))
        gradient.addColorStop(1, rgba(p.color, 0))
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3.4, 0, Math.PI * 2)
        ctx.fill()
      }

      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i]
        ring.age += 1
        const progress = ring.age / ring.life
        if (progress >= 1) {
          rings.splice(i, 1)
          continue
        }

        const eased = 1 - (1 - progress) ** 3
        const radius = ring.start + (ring.end - ring.start) * eased
        const alpha = (1 - progress) * 0.58
        ctx.strokeStyle = rgba(ring.color, alpha)
        ctx.lineWidth = Math.max(1, 3 * (1 - progress))
        ctx.beginPath()
        ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (particles.length || rings.length) {
        rafRef.current = window.requestAnimationFrame(draw)
      } else {
        rafRef.current = null
      }
    }

    const ensureAnimation = () => {
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(draw)
      }
    }

    const pushParticle = (x, y, color, options = {}) => {
      const angle = Math.random() * Math.PI * 2
      const speed = options.speed ?? (0.45 + Math.random() * 1.15)
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed + (options.vx || 0),
        vy: Math.sin(angle) * speed + (options.vy || 0),
        size: options.size ?? (2.2 + Math.random() * 3.2),
        age: 0,
        life: options.life ?? (28 + Math.random() * 18),
        alpha: options.alpha ?? 0.78,
        color,
      })

      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES)
      }
    }

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch' || isInputTarget(event.target)) return
      const now = performance.now()
      const last = lastPointRef.current
      const dx = event.clientX - last.x
      const dy = event.clientY - last.y
      const distance = Math.hypot(dx, dy)
      if (last.hasPoint && distance < MOVE_DISTANCE && now - last.time < MOVE_INTERVAL) return

      const colors = colorsRef.current
      const color = Math.random() > 0.45 ? colors.primary : colors.secondary
      const velocityScale = Math.min(distance / 42, 1.4)
      pushParticle(event.clientX, event.clientY, color, {
        vx: last.hasPoint ? -dx * 0.018 : 0,
        vy: last.hasPoint ? -dy * 0.018 : 0,
        size: 2.1 + velocityScale * 1.8,
        life: 24 + velocityScale * 14,
        alpha: 0.6,
      })

      lastPointRef.current = { x: event.clientX, y: event.clientY, time: now, hasPoint: true }
      ensureAnimation()
    }

    const handlePointerDown = (event) => {
      if (event.pointerType === 'touch' || event.button > 0 || isInputTarget(event.target)) return
      const colors = colorsRef.current
      ringsRef.current.push({
        x: event.clientX,
        y: event.clientY,
        start: 6,
        end: 42,
        age: 0,
        life: 32,
        color: colors.accent,
      })

      for (let i = 0; i < 16; i += 1) {
        pushParticle(event.clientX, event.clientY, i % 2 ? colors.accent : colors.secondary, {
          speed: 1.8 + Math.random() * 2.6,
          size: 2.3 + Math.random() * 2,
          life: 30 + Math.random() * 16,
          alpha: 0.8,
        })
      }
      ensureAnimation()
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-effects-canvas" aria-hidden="true" />
}
