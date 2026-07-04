import { useEffect, useRef } from 'react'
import { isConstrainedConnection, isLowEndDevice } from '../utils/network'

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
    let particles = []
    let lastFrameTime = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      const areaCount = Math.floor((canvas.width * canvas.height) / 28000)
      const particleCount = Math.min(window.innerWidth < 768 ? 28 : 72, Math.max(18, areaCount))
      particles = []
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          color: `hsla(${240 + Math.random() * 60}, 70%, 60%, `
        })
      }
    }

    const drawParticles = (timestamp = 0) => {
      if (timestamp - lastFrameTime < 33) {
        animationFrameId = requestAnimationFrame(drawParticles)
        return
      }
      lastFrameTime = timestamp

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle, i) => {
        // 更新位置
        particle.x += particle.vx
        particle.y += particle.vy

        // 边界处理
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        // 绘制粒子
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = particle.color + particle.opacity + ')'
        ctx.fill()

        // 绘制连线
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x
          const dy = particle.y - otherParticle.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 120) {
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(otherParticle.x, otherParticle.y)
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - distance / 120)})`
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
      resize()
      createParticles()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
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
