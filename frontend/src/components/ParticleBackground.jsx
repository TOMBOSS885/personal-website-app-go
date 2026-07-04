import { useEffect, useRef } from 'react'
import { isConstrainedConnection, isLowEndDevice } from '../utils/network'

const DPR_LIMIT = 2
const FRAME_INTERVAL = 33
const LINK_DISTANCE = 120
const LINK_DISTANCE_SQUARED = LINK_DISTANCE * LINK_DISTANCE

export default function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    if (
      prefersReducedMotion.matches
      || coarsePointer.matches
      || isConstrainedConnection()
      || isLowEndDevice()
    ) {
      return undefined
    }

    const ctx = canvas.getContext('2d')
    let animationFrameId
    let resizeFrameId
    let particles = []
    let lastFrameTime = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const createParticles = () => {
      const areaCount = Math.floor((window.innerWidth * window.innerHeight) / 28000)
      const particleCount = Math.min(window.innerWidth < 768 ? 28 : 72, Math.max(18, areaCount))
      particles = []
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: Math.random() * 2 + 1,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          color: `hsla(${240 + Math.random() * 60}, 70%, 60%, `
        })
      }
    }

    const drawParticles = (timestamp = 0) => {
      if (timestamp - lastFrameTime < FRAME_INTERVAL) {
        animationFrameId = requestAnimationFrame(drawParticles)
        return
      }
      lastFrameTime = timestamp

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      particles.forEach((particle, i) => {
        // 更新位置
        particle.x += particle.vx
        particle.y += particle.vy

        // 边界处理
        if (particle.x < 0 || particle.x > window.innerWidth) particle.vx *= -1
        if (particle.y < 0 || particle.y > window.innerHeight) particle.vy *= -1

        // 绘制粒子
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = particle.color + particle.opacity + ')'
        ctx.fill()

        // 绘制连线
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x
          const dy = particle.y - otherParticle.y
          const distanceSquared = dx * dx + dy * dy

          if (distanceSquared < LINK_DISTANCE_SQUARED) {
            const distance = Math.sqrt(distanceSquared)
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(otherParticle.x, otherParticle.y)
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - distance / LINK_DISTANCE)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })

      animationFrameId = requestAnimationFrame(drawParticles)
    }

    resize()
    createParticles()
    drawParticles()

    const handleResize = () => {
      if (resizeFrameId) return
      resizeFrameId = requestAnimationFrame(() => {
        resizeFrameId = null
        resize()
        createParticles()
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}
