import type { MenuItem, Widget } from '../types.js';

const iconCache = new Map<string, string>();

async function fetchIcon(iconId: string): Promise<string | null> {
  if (iconCache.has(iconId))
    return iconCache.get(iconId)!;
  const [prefix, ...rest] = iconId.split(':');
  const name = rest.join(':');
  if (!prefix || !name)
    return null;
  try {
    const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
    if (!res.ok)
      return null;
    const svg = await res.text();
    iconCache.set(iconId, svg);
    return svg;
  }
  catch {
    return null;
  }
}

function createMenuButton(item: MenuItem, widget: Widget, primaryColor: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.title = item.label;
  btn.textContent = item.label;

  Object.assign(btn.style, {
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '50%',
    background: primaryColor,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: 'rgba(255,255,255,0.75)',
    padding: '0',
    transition: 'color 0.15s',
    flexShrink: '0',
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.color = 'rgba(255,255,255,1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.color = 'rgba(255,255,255,0.75)';
  });

  btn.addEventListener('click', () => {
    item.onClick(widget);
  });

  if (item.icon) {
    fetchIcon(item.icon).then(svg => {
      if (!svg)
        return;
      btn.innerHTML = svg;
      btn.title = item.label;
      const svgEl = btn.querySelector('svg');
      if (svgEl) {
        Object.assign(svgEl.style, {
          width: '1em',
          height: '1em',
          pointerEvents: 'none',
        });
      }
    });
  }

  return btn;
}

export interface MenuHandle {
  el: HTMLElement
  show: () => void
  hide: () => void
  destroy: () => void
}

export function createMenu(
  items: MenuItem[],
  widget: Widget,
  { align = 'right', primaryColor, style }: { align?: 'left' | 'right', primaryColor: string, style?: Partial<CSSStyleDeclaration> },
): MenuHandle {
  const bar = document.createElement('div');

  Object.assign(bar.style, {
    position: 'absolute',
    [align]: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '4px',
    zIndex: '1',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease-in-out',
  });

  if (style)
    Object.assign(bar.style, style);

  for (const item of items) {
    bar.appendChild(createMenuButton(item, widget, primaryColor));
  }

  return {
    el: bar,
    show() {
      bar.style.opacity = '1';
      bar.style.pointerEvents = 'auto';
    },
    hide() {
      bar.style.opacity = '0';
      bar.style.pointerEvents = 'none';
    },
    destroy() {
      bar.remove();
    },
  };
}
