export default function ProfileAvatar({
  profile,
  sizeClass = 'h-12 w-12',
  textClass = 'text-xl',
  className = '',
  imageClassName = '',
  fallbackClassName = '',
}) {
  const initial = profile?.nickname?.trim()?.charAt(0)?.toUpperCase() || 'W'
  const avatarSrc = typeof profile?.avatar === 'string' && profile.avatar.startsWith('/uploads/avatars/')
    ? profile.avatar
    : ''

  return (
    <div
      className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${className}`}
      aria-label={profile?.nickname ? `${profile.nickname} avatar` : 'avatar'}
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={profile?.nickname || 'avatar'}
          loading="lazy"
          decoding="async"
          className={`h-full w-full rounded-full object-cover ${imageClassName}`}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full text-white shadow-lg ${fallbackClassName}`}
          style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
        >
          <span className={`font-bold leading-none ${textClass}`}>{initial}</span>
        </div>
      )}
    </div>
  )
}
