# Tips & Typing Animation

A speech bubble floats above the model — it can show welcome messages, cycle through tips, and even type them out character by character.

## Basic Configuration

Each model gets its own `tips` config:

```ts
createWidget({
  model: {
    path: '/models/model.json',
    tips: {
      welcomeMessage: ['Welcome!', 'Nice to see you!'],
      messages: ['Take a break~', 'Need any help?'],
      duration: 3000, // display for 3s (default)
      interval: 5000, // switch every 5s (default)
    },
  },
});
```

## Position Offset

Nudge the bubble with `offset`:

```ts
const options = {
  tips: {
    offset: { x: 20, y: -10 }, // right 20px, up 10px
  },
};
```

## Typing Animation

Turn on `typing` to reveal tip text one character at a time:

```ts
const options = {
  tips: {
    typing: {
      speed: 100, // 100ms per character (default)
    },
  },
};
```

## Lip-Sync

If the model has mouth parameters, you can make its mouth move along with the typing:

```ts
const options = {
  tips: {
    typing: {
      param: 'PARAM_MOUTH_OPEN_Y', // mouth parameter name
      speed: 200,
      minValue: 0, // min mouth open value (0~1)
      maxValue: 1, // max mouth open value (0~1)
    },
  },
};
```

The parameter name varies by model. Common ones are `PARAM_MOUTH_OPEN_Y` and `ParamMouthOpenY`.
