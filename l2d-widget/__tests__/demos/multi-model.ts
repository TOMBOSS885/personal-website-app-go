import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: 'Multi Model',
  description: 'model 传数组时菜单自动出现切换按钮',
  run(): Widget {
    return createWidget({
      transitionType: 'fade',
      position: 'bottom-right',
      model: [
        { path: 'https://model.hacxy.cn/cat-black/model.json' },
        { path: 'https://model.hacxy.cn/cat-white/model.json' },
      ],
    });
  },
};
