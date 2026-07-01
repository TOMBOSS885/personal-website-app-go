import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: 'Basic',
  description: '最小配置，模型展示在左下角（默认）',
  run(): Widget {
    return createWidget({
      model: {
        path: 'https://model.hacxy.cn/cat-black/model.json',
      },
    });
  },
};
