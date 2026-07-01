import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: 'Custom Menu',
  description: 'menus.extraItems 在默认菜单末尾追加自定义按钮',
  run(): Widget {
    return createWidget({
      model: {
        path: 'https://model.hacxy.cn/cat-black/model.json',
      },
      menus: {
        extraItems: [
          {
            icon: 'mdi:emoticon-happy-outline',
            label: 'Play motion',
            onClick(widget) {
              const motions = widget.l2d.getMotions();
              const groups = Object.keys(motions);
              if (groups.length > 0) {
                widget.l2d.playMotion(groups[0]!);
              }
            },
          },
        ],
      },
    });
  },
};
