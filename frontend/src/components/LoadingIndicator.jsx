export default function LoadingIndicator({ size = 24, className = '', label }) {
  const numericSize = Number(size)
  const resolvedSize = Number.isFinite(numericSize) ? Math.max(14, numericSize) : 24
  const accessibilityProps = label
    ? { role: 'status', 'aria-label': label }
    : { 'aria-hidden': true }

  return (
    <span
      className={`loading-indicator ${className}`.trim()}
      style={{ '--loading-indicator-size': `${resolvedSize}px` }}
      {...accessibilityProps}
    >
      <span className="loading-indicator__dot" />
      <span className="loading-indicator__step loading-indicator__step--1" />
      <span className="loading-indicator__step loading-indicator__step--2" />
      <span className="loading-indicator__step loading-indicator__step--3" />
    </span>
  )
}
