function ensureSpinnerStyle() {
  if (document.getElementById('l2dw-spin'))
    return;
  const style = document.createElement('style');
  style.id = 'l2dw-spin';
  style.textContent = '@keyframes l2dw-spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

export interface StatusBarHandle {
  el: HTMLElement
  showLoading: (label?: string) => void
  showRest: (onWake: () => void) => void
  hide: () => void
  destroy: () => void
}

export function createStatusBar(
  position: 'bottom-left' | 'bottom-right',
  transitionDuration: number,
  height: number,
  primaryColor: string,
  style?: Partial<CSSStyleDeclaration>,
): StatusBarHandle {
  ensureSpinnerStyle();

  const isRight = position === 'bottom-right';
  const hiddenTransform = `translateY(50%) translateX(${isRight ? '100%' : '-100%'})`;
  const visibleTransform = 'translateY(50%) translateX(0)';

  let wakeHandler: (() => void) | null = null;

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed',
    [isRight ? 'right' : 'left']: '0',
    bottom: `${height / 2}px`,
    transform: hiddenTransform,
    transition: `transform ${transitionDuration}ms cubic-bezier(0.19, 1, 0.22, 1)`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 3px',
    background: primaryColor,
    backdropFilter: 'blur(8px)',
    borderRadius: isRight ? '8px 0 0 8px' : '0 8px 8px 0',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '12px',
    zIndex: '9998',
    pointerEvents: 'none',
    willChange: 'transform',
  });

  if (style)
    Object.assign(bar.style, style);

  bar.addEventListener('click', () => {
    wakeHandler?.();
  });

  const spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.25)',
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderRadius: '50%',
    animation: 'l2dw-spin 0.7s linear infinite',
    flexShrink: '0',
  });

  const text = document.createElement('span');
  text.style.writingMode = 'vertical-rl';

  bar.appendChild(text);
  bar.appendChild(spinner);

  return {
    el: bar,

    showLoading(label = '正在加载') {
      text.textContent = label;
      spinner.style.display = 'block';
      bar.style.pointerEvents = 'none';
      bar.style.cursor = 'default';
      wakeHandler = null;
      void bar.offsetHeight;
      bar.style.transform = visibleTransform;
    },

    showRest(onWake: () => void) {
      text.textContent = '正在休息';
      spinner.style.display = 'none';
      bar.style.pointerEvents = 'auto';
      bar.style.cursor = 'pointer';
      wakeHandler = onWake;
      void bar.offsetHeight;
      bar.style.transform = visibleTransform;
    },

    hide() {
      bar.style.pointerEvents = 'none';
      bar.style.cursor = 'default';
      wakeHandler = null;
      bar.style.transform = hiddenTransform;
    },

    destroy() {
      bar.remove();
    },
  };
}
