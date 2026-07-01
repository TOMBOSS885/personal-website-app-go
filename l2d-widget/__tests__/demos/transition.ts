import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: '动画效果',
  description: '测试动画效果',
  run(): Widget {
    return createWidget({
      transitionType: 'slide',
      position: 'bottom-left',
      model: [
        { path: 'https://model.hacxy.cn/cat-black/model.json' },
        { path: 'https://model.hacxy.cn/cat-white/model.json' },
      ],
    });
  },
};
