import type { MenuItem, ModelOptions, Widget } from './types.js';

export function getDefaultItems(models: ModelOptions[]): MenuItem[] {
  const items: MenuItem[] = [];

  if (models.length > 1) {
    let idx = 0;
    items.push({
      icon: 'mdi:shuffle-variant',
      label: 'Switch model',
      onClick(widget: Widget) {
        idx = (idx + 1) % models.length;
        void widget.switchModel(idx);
      },
    });
  }

  items.push({
    icon: 'mdi:bed',
    label: '休眠',
    onClick(widget: Widget) {
      widget.sleep();
    },
  });

  items.push({
    icon: 'mdi:information-outline',
    label: 'About',
    onClick() {
      window.open('https://github.com/hacxy/oh-my-live2d', '_blank', 'noopener');
    },
  });

  return items;
}
