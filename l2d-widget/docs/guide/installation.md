# 安装

## 包管理器

用你习惯的包管理器装就行：

::: code-group

```bash [npm]
npm install l2d-widget
```

```bash [pnpm]
pnpm add l2d-widget
```

```bash [yarn]
yarn add l2d-widget
```

:::

## CDN

不想装包？直接用 `<script>` 标签引入也可以，全局变量是 `L2D_WIDGET`：

```html
<script src="https://unpkg.com/l2d-widget/dist/index.min.js"></script>
<script>
  L2D_WIDGET.createWidget({
    model: {
      path: 'https://model.hacxy.cn/cat-black/model.json',
    },
  })
</script>
```
