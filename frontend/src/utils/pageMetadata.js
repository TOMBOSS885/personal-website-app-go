import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  return element
}

function absoluteUrl(value, fallback) {
  try {
    return new URL(value || fallback, window.location.origin).toString()
  } catch {
    return new URL(fallback, window.location.origin).toString()
  }
}

export function applyPageMetadata(metadata, owner = window.location.pathname) {
  const title = metadata.title || 'tombossking'
  const description = metadata.description || '个人作品、技术文章与项目展示'
  const canonical = absoluteUrl(metadata.canonical, window.location.pathname)
  const image = metadata.image ? absoluteUrl(metadata.image, '/favicon.ico') : ''
  const robots = metadata.robots || 'index, follow'

  document.title = title
  document.documentElement.dataset.metadataOwner = owner
  ensureMeta('meta[name="description"]', { name: 'description', content: description })
  ensureMeta('meta[name="robots"]', { name: 'robots', content: robots })
  ensureMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  ensureMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.type || 'website' })
  ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: metadata.siteName || 'tombossking' })
  ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' })
  ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  if (image) {
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  } else {
    document.head.querySelector('meta[property="og:image"]')?.remove()
    document.head.querySelector('meta[name="twitter:image"]')?.remove()
  }

  let canonicalLink = document.head.querySelector('link[rel="canonical"]')
  if (!canonicalLink) {
    canonicalLink = document.createElement('link')
    canonicalLink.rel = 'canonical'
    document.head.appendChild(canonicalLink)
  }
  canonicalLink.href = canonical
}

export function usePageMetadata(metadata) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (metadata) applyPageMetadata(metadata, pathname)
  }, [metadata, pathname])
}
