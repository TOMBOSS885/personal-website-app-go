# 多模型切换

## 配置多个模型

把 `model` 从对象改成数组，就自动开启了多模型切换：

```ts
createWidget({
  model: [
    { path: '/models/cat-black/model.json' },
    { path: '/models/cat-white/model.json' },
  ],
});
```

菜单里会自动多出一个"切换模型"按钮，不用额外配。

## 独立配置

每个模型可以有自己的缩放、位置偏移、音量和提示气泡：

```ts
createWidget({
  model: [
    {
      path: '/models/cat-black/model.json',
      scale: 1.2,
      tips: {
        welcomeMessage: ['我是黑猫！'],
      },
    },
    {
      path: '/models/cat-white/model.json',
      offset: [0.5, 0],
      tips: {
        welcomeMessage: ['我是白猫！'],
      },
    },
  ],
});
```

## 编程式切换

除了用户点菜单切换，你也可以在代码里调 `widget.switchModel(index)`：

```ts
const widget = createWidget({
  model: [
    { path: '/models/cat-black/model.json' },
    { path: '/models/cat-white/model.json' },
  ],
});

// 切换到第二个模型
await widget.switchModel(1);
```

切换过程是完整的：退场动画 -> 销毁旧模型 -> 重建新模型 -> 入场动画。
