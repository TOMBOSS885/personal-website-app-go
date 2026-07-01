import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: 'Bottom Right',
  description: '模型展示在右下角',
  run(): Widget {
    return createWidget({
      model: {
        path: 'https://model.hacxy.cn/cat-black/model.json',
      },
      position: 'bottom-right',
      transitionType: 'fade',
    });
  },
};
