import { ImageOff } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'
import { resolveSameOriginServerUrl } from '../api/client'
import { useSettings } from '../settings/SettingsContext'

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  source?: string | null
  fallbackLabel?: string
}

export function RemoteImage({ source, fallbackLabel, className, alt = '', ...props }: Props) {
  const { settings } = useSettings()
  const [failed, setFailed] = useState(false)
  const src = resolveSameOriginServerUrl(settings.serverUrl, source)

  if (!src || failed) {
    return (
      <span className={`image-fallback ${className ?? ''}`} aria-label={alt}>
        <ImageOff size={20} />
        {fallbackLabel && <span>{fallbackLabel.slice(0, 1)}</span>}
      </span>
    )
  }

  return <img {...props} referrerPolicy="no-referrer" className={className} src={src} alt={alt} onError={() => setFailed(true)} />
}
