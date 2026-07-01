# 快速开始

## 最小示例

```ts
import { createWidget } from 'l2d-widget';

const widget = createWidget({
  model: {
    path: 'https://model.hacxy.cn/cat-black/model.json',
  },
});
```

就这几行，页面左下角就会出现一个 Live2D 模型，默认配置全部就绪。

## 背后发生了什么？

1. 往页面里插了一个固定定位的 canvas
2. 从指定路径加载 Live2D 模型并渲染
3. 加载完成后模型滑入登场
4. 鼠标悬浮到模型上，右侧弹出操作菜单
5. 模型上方定时冒出提示气泡

## 改个位置试试

```ts
createWidget({
  model: {
    path: 'https://model.hacxy.cn/cat-black/model.json',
  },
  position: 'bottom-right', // 右下角
  size: 400, // canvas 尺寸 400px
});
```

## 下一步

- [位置与动画](./position.md) — 调位置、改大小、换动画
- [菜单定制](./menu.md) — 加你自己的菜单按钮
- [提示气泡](./tips.md) — 配置提示内容和打字动画
- [多模型切换](./multi-model.md) — 在多个模型之间切换
- [API 参考](/api/) — 完整的接口文档
