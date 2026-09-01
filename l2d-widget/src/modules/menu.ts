import type { MenuItem, Widget } from '../types.js';

const iconCache = new Map<string, string>();
const localIcons: Record<string, string> = {
  'mdi:bed': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 10.78V9a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v1H5V6a2 2 0 0 0-2-2H2v16h2v-3h16v3h2v-7a2.22 2.22 0 0 0-1-2.22M13 9h6v1h-6v-1M4 6h1v4H4V6m16 9H4v-3h16v3Z"/></svg>',
  'mdi:shuffle-variant': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 3h5v5l-2-2-4.5 4.5-1.4-1.4L17.6 4.6 16 3M3 6h3.5c1.4 0 2.7.6 3.6 1.7l6.8 8.1 2.1-2.1V19h-5.3l1.8-1.8-6.9-8.1A2.8 2.8 0 0 0 6.5 8H3V6m0 10h3.5c.8 0 1.6-.4 2.1-1l1.7-2 1.3 1.6-1.5 1.8A4.8 4.8 0 0 1 6.5 18H3v-2Z"/></svg>',
  'mdi:information-outline': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 17h2v-6h-2v6m1-15a10 10 0 1 1 0 20 10 10 0 0 1 0-20m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m-1 5h2V7h-2v2Z"/></svg>',
};

async function fetchIcon(iconId: string): Promise<string | null> {
  if (!/^\w+(?:-\w+)*:\w+(?:-\w+)*$/.test(iconId))
    return null;
  if (localIcons[iconId])
    return localIcons[iconId];
  if (iconCache.has(iconId))
    return iconCache.get(iconId)!;
  const [prefix, ...rest] = iconId.split(':');
  const name = rest.join(':');
  if (!prefix || !name)
    return null;
  try {
    const res = await fetch(`https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`, { referrerPolicy: 'no-referrer' });
    if (!res.ok)
      return null;
    const svg = await res.text();
    if (svg.length > 128 * 1024 || !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg))
      return null;
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
    const image = btn.querySelector('img');
    if (image)
      image.style.opacity = '1';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.color = 'rgba(255,255,255,0.75)';
    const image = btn.querySelector('img');
    if (image)
      image.style.opacity = '0.75';
  });

  btn.addEventListener('click', () => {
    item.onClick(widget);
  });

  if (item.icon) {
    fetchIcon(item.icon).then(svg => {
      if (!svg)
        return;
      // SVG is loaded as an image document so remote markup never enters the
      // widget DOM (and cannot execute event handlers or script elements).
      const image = document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      Object.assign(image.style, {
        width: '1em',
        height: '1em',
        opacity: '0.75',
        pointerEvents: 'none',
        transition: 'opacity 0.15s',
      });
      image.addEventListener('load', () => btn.replaceChildren(image), { once: true });
      image.src = toSvgImageSource(svg);
    });
  }

  return btn;
}

function toSvgImageSource(svg: string): string {
  const standaloneSvg = /<svg\b[^>]*\bxmlns\s*=/i.test(svg)
    ? svg
    : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const visibleSvg = standaloneSvg.replace(/\bcurrentColor\b/g, '#ffffff');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(visibleSvg)}`;
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
