import { ImageOff } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'
import { resolveServerUrl } from '../api/client'
import { useSettings } from '../settings/SettingsContext'

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  source?: string | null
  fallbackLabel?: string
}

export function RemoteImage({ source, fallbackLabel, className, alt = '', ...props }: Props) {
  const { settings } = useSettings()
  const [failed, setFailed] = useState(false)
  const src = resolveServerUrl(settings.serverUrl, source)

  if (!src || failed) {
    return (
      <span className={`image-fallback ${className ?? ''}`} aria-label={alt}>
        <ImageOff size={20} />
        {fallbackLabel && <span>{fallbackLabel.slice(0, 1)}</span>}
      </span>
    )
  }

  return <img {...props} className={className} src={src} alt={alt} onError={() => setFailed(true)} />
}
