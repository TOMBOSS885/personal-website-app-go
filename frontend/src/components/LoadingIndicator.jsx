export default function LoadingIndicator({ size = 24, className = '', label }) {
  const numericSize = Number(size)
  const resolvedSize = Number.isFinite(numericSize) ? Math.max(14, numericSize) : 24
  const accessibilityProps = label
    ? { role: 'status', 'aria-label': label }
    : { 'aria-hidden': true }

  return (
    <span
      className={`loading-indicator ${className}`.trim()}
      style={{
        '--loading-indicator-size': `${resolvedSize}px`,
        '--loading-indicator-scale': (resolvedSize / 150).toFixed(4),
      }}
      {...accessibilityProps}
    >
      <span className="loading-indicator__scene">
        <span className="loading-indicator__grid" />
        <span className="loading-indicator__ring loading-indicator__ring--outer">
          <span className="loading-indicator__item loading-indicator__item--1"><span className="loading-indicator__symbol">∫</span></span>
          <span className="loading-indicator__item loading-indicator__item--2"><span className="loading-indicator__symbol">∑</span></span>
          <span className="loading-indicator__item loading-indicator__item--3"><span className="loading-indicator__symbol">∂</span></span>
        </span>
        <span className="loading-indicator__ring loading-indicator__ring--middle">
          <span className="loading-indicator__item loading-indicator__item--1"><span className="loading-indicator__symbol">π</span></span>
          <span className="loading-indicator__item loading-indicator__item--2"><span className="loading-indicator__symbol">e</span></span>
        </span>
        <span className="loading-indicator__ring loading-indicator__ring--inner">
          <span className="loading-indicator__item loading-indicator__item--1"><span className="loading-indicator__symbol">∞</span></span>
          <span className="loading-indicator__item loading-indicator__item--2"><span className="loading-indicator__symbol">√</span></span>
        </span>
        <span className="loading-indicator__core" />
      </span>
    </span>
  )
}
