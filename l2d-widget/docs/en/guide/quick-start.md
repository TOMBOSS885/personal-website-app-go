# Quick Start

## Minimal Example

```ts
import { createWidget } from 'l2d-widget';

const widget = createWidget({
  model: {
    path: 'https://model.hacxy.cn/cat-black/model.json',
  },
});
```

That's it — a Live2D model appears at the bottom-left corner with all defaults applied.

## What Happens Under the Hood

1. A fixed-position canvas is created and appended to the page
2. The model loads from the specified path
3. Once ready, it slides in with a transition animation
4. Hover over the model to reveal the action menu
5. Tip bubbles cycle above the model periodically

## Custom Position

```ts
createWidget({
  model: {
    path: 'https://model.hacxy.cn/cat-black/model.json',
  },
  position: 'bottom-right', // bottom-right corner
  size: 400, // canvas size 400px
});
```

## Next Steps

- [Position & Transition](./position.md) — position, size, animation
- [Menu Customization](./menu.md) — custom menu buttons
- [Tips & Typing](./tips.md) — tip messages and typing animation
- [Multi-Model](./multi-model.md) — switching between models
- [API Reference](/api/) — full API docs
