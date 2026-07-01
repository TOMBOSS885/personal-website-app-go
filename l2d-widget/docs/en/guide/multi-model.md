# Multi-Model Switching

## Configuring Multiple Models

Pass an array to `model` and you get multi-model switching for free:

```ts
createWidget({
  model: [
    { path: '/models/cat-black/model.json' },
    { path: '/models/cat-white/model.json' },
  ],
});
```

A "Switch Model" button shows up in the menu automatically.

## Per-Model Configuration

Each model can have its own scale, offset, volume, and tips:

```ts
createWidget({
  model: [
    {
      path: '/models/cat-black/model.json',
      scale: 1.2,
      tips: {
        welcomeMessage: ['I am the black cat!'],
      },
    },
    {
      path: '/models/cat-white/model.json',
      offset: [0.5, 0],
      tips: {
        welcomeMessage: ['I am the white cat!'],
      },
    },
  ],
});
```

## Programmatic Switching

Switch models from code with `widget.switchModel(index)`:

```ts
const widget = createWidget({
  model: [
    { path: '/models/cat-black/model.json' },
    { path: '/models/cat-white/model.json' },
  ],
});

// Switch to the second model
await widget.switchModel(1);
```

Under the hood, switching runs a full exit animation, destroys the old model, rebuilds, and plays the entrance animation.
