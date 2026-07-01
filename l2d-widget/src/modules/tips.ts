import type { L2D } from 'l2d';

function ensureTipsStyle() {
  if (document.getElementById('l2dw-tips-style'))
    return;
  const style = document.createElement('style');
  style.id = 'l2dw-tips-style';
  style.textContent = `
    @keyframes l2dw-tips-in {
      from { opacity: 0; transform: translateY(8px) scale(0.9) }
      to   { opacity: 1; transform: translateY(0)   scale(1)   }
    }
    @keyframes l2dw-tips-float {
      0%, 100% { transform: translateY(0) }
      50%      { transform: translateY(-5px) }
    }
  `;
  document.head.appendChild(style);
}

export interface TipsConfig {
  offset?: { x?: number, y?: number }
  typing?: {
    param?: string
    speed?: number
    minValue?: number
    maxValue?: number
  }
  style?: Partial<CSSStyleDeclaration>
}

export interface TipsHandle {
  el: HTMLElement
  show: (text: string, l2d?: L2D) => void
  hide: () => void
  destroy: () => void
}

export function createTips(primaryColor: string, config?: TipsConfig): TipsHandle {
  ensureTipsStyle();

  const { offset, typing, style } = config ?? {};
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;
  const mouthParam = typing?.param;
  const typingSpeed = typing?.speed ?? 100;
  const typingMin = typing?.minValue ?? 0.5;
  const typingMax = typing?.maxValue ?? 1;

  let inTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let typeTimer: ReturnType<typeof setTimeout> | undefined;
  let activeL2d: L2D | undefined;

  // 外层：只负责定位，不参与动画
  const outer = document.createElement('div');
  Object.assign(outer.style, {
    position: 'absolute',
    bottom: `calc(100% + ${10 + oy}px)`,
    left: `calc(50% + ${ox}px)`,
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    zIndex: '2',
  });

  // 内层：负责外观 + 动画，初始不可见
  const inner = document.createElement('div');
  Object.assign(inner.style, {
    position: 'relative',
    background: primaryColor,
    borderRadius: '8px',
    padding: '8px 14px',
    color: 'rgba(255,255,255,0.95)',
    fontSize: '13px',
    lineHeight: '1.5',
    maxWidth: '200px',
    textAlign: 'center',
    wordBreak: 'break-word',
    opacity: '0',
    whiteSpace: 'nowrap',
  });

  if (style)
    Object.assign(inner.style, style);

  const arrow = document.createElement('div');
  Object.assign(arrow.style, {
    position: 'absolute',
    bottom: '-7px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '0',
    height: '0',
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: `7px solid ${primaryColor}`,
  });

  inner.appendChild(arrow);
  outer.appendChild(inner);

  const textEl = document.createElement('span');
  inner.prepend(textEl);

  function closeMouth() {
    if (activeL2d && mouthParam) {
      activeL2d.setParams({ [mouthParam]: 0 });
    }
  }

  function startFloat() {
    inner.style.opacity = '1';
    inner.style.animation = 'l2dw-tips-float 2.5s ease-in-out infinite';
  }

  function startTyping(chars: string[]) {
    let i = 0;

    function tick() {
      if (i >= chars.length) {
        closeMouth();
        startFloat();
        return;
      }

      textEl.textContent = chars.slice(0, i + 1).join('');
      i++;

      if (activeL2d && mouthParam) {
        activeL2d.setParams({ [mouthParam]: typingMin + Math.random() * (typingMax - typingMin) });
        setTimeout(closeMouth, typingSpeed / 2);
      }

      typeTimer = setTimeout(tick, typingSpeed);
    }

    tick();
  }

  function resetInner() {
    clearTimeout(inTimer);
    clearTimeout(hideTimer);
    clearTimeout(typeTimer);
    closeMouth();
    inner.style.transition = 'none';
    inner.style.animation = 'none';
    inner.style.opacity = '0';
    inner.style.transform = '';
    textEl.textContent = '';
  }

  return {
    el: outer,

    show(msg: string, l2d?: L2D) {
      resetInner();
      activeL2d = l2d;
      void inner.offsetHeight;
      inner.style.animation = 'l2dw-tips-in 0.35s ease-out forwards';

      if (typing) {
        // 打字模式：气泡入场后逐字打出；若配置了 param 则同步嘴型
        const chars = [...msg];
        inTimer = setTimeout(() => {
          startTyping(chars);
        }, 350);
      }
      else {
        // 普通模式：直接显示文字，入场后浮动
        textEl.textContent = msg;
        inTimer = setTimeout(() => {
          startFloat();
        }, 350);
      }
    },

    hide() {
      clearTimeout(inTimer);
      clearTimeout(hideTimer);
      clearTimeout(typeTimer);
      closeMouth();
      inner.style.animation = 'none';
      inner.style.opacity = '1';
      void inner.offsetHeight;
      inner.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      inner.style.opacity = '0';
      inner.style.transform = 'translateY(6px)';

      hideTimer = setTimeout(() => {
        inner.style.transition = 'none';
        inner.style.transform = '';
      }, 260);
    },

    destroy() {
      clearTimeout(inTimer);
      clearTimeout(hideTimer);
      clearTimeout(typeTimer);
      closeMouth();
      outer.remove();
    },
  };
}
