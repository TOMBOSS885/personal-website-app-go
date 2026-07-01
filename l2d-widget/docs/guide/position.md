# 位置与动画

## 位置

`position` 决定挂件固定在页面的哪个角落——`'bottom-left'`（默认）或 `'bottom-right'`：

```ts
createWidget({
  model: { path: '/models/model.json' },
  position: 'bottom-right',
});
```

## 尺寸

`size` 设置 canvas 大小，默认 `300`。传数字就是正方形，传对象可以分别指定宽高：

```ts
// 正方形 400x400
createWidget({
  model: { path: '/models/model.json' },
  size: 400,
});

// 宽高分别指定
createWidget({
  model: { path: '/models/model.json' },
  size: { width: 350, height: 500 },
});
```

## 动画类型

`transitionType` 设置入场和退场的过渡效果。`'slide'`（默认）是滑入滑出，`'fade'` 是淡入淡出：

```ts
createWidget({
  model: { path: '/models/model.json' },
  transitionType: 'fade',
  transitionDuration: 1000, // 动画时长 1000ms（默认 1500）
});
```

## 主题色

`primaryColor` 统一控制菜单、状态栏、提示气泡这些 UI 元素的颜色，一处配置全局生效：

```ts
createWidget({
  model: { path: '/models/model.json' },
  primaryColor: 'rgba(255, 130, 130, 0.9)', // 粉红色主题
});
```
