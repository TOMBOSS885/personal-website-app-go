import type { Widget } from 'l2d-widget';
import { createWidget } from 'l2d-widget';

export default {
  name: 'Mouth Param',
  description: '开启嘴型同步打字动画，tips 逐字打出时同步驱动模型嘴型',
  run(): Widget {
    return createWidget({
      model: {
        path: 'https://model.hacxy.cn/cat-black/model.json',
        tips: {
          offset: { y: -28, x: 10 },
          typing: {
            param: 'PARAM_MOUTH_OPEN_Y',
            speed: 200,
            minValue: 0,
            maxValue: 1,
          },
          welcomeMessage: [
            '你好，我是猫猫！',
            '今天天气真不错呢～',
            '有什么可以帮助你的吗？',
          ],
          messages: [
            '记得多喝水哦！',
            '休息一下眼睛吧～',
            '今天也要加油！',
            '我在这里陪着你～',
          ],
          duration: 4000,
          interval: 6000,
        },
      },
    });
  },
};
