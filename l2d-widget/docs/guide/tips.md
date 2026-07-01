# 提示气泡

模型上方那个会冒话的小气泡，可以用来展示欢迎语、循环消息，还能配打字动画。

## 基础配置

每个模型的 `tips` 是独立配置的：

```ts
createWidget({
  model: {
    path: '/models/model.json',
    tips: {
      welcomeMessage: ['欢迎来访！', '好久不见！'],
      messages: ['记得多休息哦～', '有什么可以帮你的吗？'],
      duration: 3000, // 每条显示 3 秒（默认）
      interval: 5000, // 每 5 秒切换一条（默认）
    },
  },
});
```

## 位置偏移

气泡位置不太对？用 `offset` 微调一下：

```ts
const options = {
  tips: {
    offset: { x: 20, y: -10 }, // 向右 20px，向上 10px
  },
};
```

## 打字动画

开启 `typing` 后，提示文字会一个字一个字地"打"出来：

```ts
const options = {
  tips: {
    typing: {
      speed: 100, // 每字 100ms（默认）
    },
  },
};
```

## 嘴型同步

如果你的模型支持嘴型参数，打字的时候还能让模型跟着「说话」：

```ts
const options = {
  tips: {
    typing: {
      param: 'PARAM_MOUTH_OPEN_Y', // 嘴型参数名
      speed: 200,
      minValue: 0, // 嘴型开合最小值（0~1）
      maxValue: 1, // 嘴型开合最大值（0~1）
    },
  },
};
```

参数名因模型而异，常见的有 `PARAM_MOUTH_OPEN_Y`、`ParamMouthOpenY` 等，具体看模型文件里的定义。
