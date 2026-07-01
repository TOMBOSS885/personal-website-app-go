# Installation

## Package Manager

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

Drop a `<script>` tag and use the `L2D_WIDGET` global:

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
