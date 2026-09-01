import { useEffect, useState } from 'react'
import { responsiveImageSourceSet } from '../utils/responsiveImages'

export default function OptimizedImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  loading = 'lazy',
  fetchPriority,
  sizes,
  fallback,
  onLoad,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return fallback || null
  }

  const responsiveSrcSet = responsiveImageSourceSet(src)

  return (
    <span className={`optimized-image-wrap ${wrapperClassName}`}>
      {!loaded && <span className="optimized-image-placeholder" aria-hidden="true" />}
      <img
        src={src}
        srcSet={responsiveSrcSet}
        alt={alt || ''}
        loading={loading}
        decoding="async"
        fetchpriority={fetchPriority}
        sizes={sizes}
        className={`${className} ${loaded ? 'optimized-image-loaded' : 'optimized-image-loading'}`}
        onLoad={(event) => {
          setLoaded(true)
          onLoad?.(event)
        }}
        onError={() => setFailed(true)}
      />
    </span>
  )
}
