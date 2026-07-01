import { createWidget } from 'l2d-widget';

const params = new URLSearchParams(location.search);
const modelPath = params.get('model');
if (!modelPath)
  throw new Error('missing model param');

interface Token { text: string, cls?: string }

function buildCodeTokens(path: string): Token[][] {
  return [
    [
      { text: 'import', cls: 'kw' },
      { text: ' { ' },
      { text: 'createWidget', cls: 'fn' },
      { text: ' } ' },
      { text: 'from', cls: 'kw' },
      { text: ' ' },
      { text: '\'l2d-widget\'', cls: 'str' },
    ],
    [],
    [
      { text: 'createWidget', cls: 'fn' },
      { text: '({ ' },
      { text: 'model', cls: 'prop' },
      { text: ': { ' },
      { text: 'path', cls: 'prop' },
      { text: ': ' },
      { text: `'${path}'`, cls: 'str' },
      { text: ' } })' },
    ],
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

const codeEl = document.getElementById('code')!;
const editorEl = document.getElementById('editor')!;
const runBtn = document.getElementById('runBtn')!;
const mousePtr = document.getElementById('mousePtr')!;

async function typeCode(lines: Token[][]) {
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  cursor.textContent = '​';

  for (let i = 0; i < lines.length; i++) {
    const lineEl = document.createElement('div');
    lineEl.style.minHeight = '1.7em';
    codeEl.appendChild(lineEl);

    const tokens = lines[i]!;
    if (tokens.length === 0) {
      lineEl.appendChild(cursor);
      await sleep(60);
      continue;
    }

    for (const token of tokens) {
      const span = document.createElement('span');
      if (token.cls)
        span.className = token.cls;
      lineEl.appendChild(span);

      for (const ch of token.text) {
        cursor.remove();
        span.textContent += ch;
        lineEl.appendChild(cursor);
        await sleep(12 + Math.random() * 10);
      }
    }
  }

  cursor.remove();
}

async function animateMouseClick() {
  const rect = runBtn.getBoundingClientRect();
  const startX = rect.left + rect.width + 40;
  const startY = rect.top - 30;

  mousePtr.style.left = `${startX}px`;
  mousePtr.style.top = `${startY}px`;
  mousePtr.classList.add('visible');

  await sleep(100);

  mousePtr.style.left = `${rect.left + rect.width / 2 - 4}px`;
  mousePtr.style.top = `${rect.top + rect.height / 2 - 2}px`;

  await sleep(650);

  runBtn.classList.add('pressed');
  await sleep(150);
  runBtn.classList.remove('pressed');

  await sleep(200);
  mousePtr.classList.remove('visible');
}

async function run() {
  const tokens = buildCodeTokens(modelPath!);

  await typeCode(tokens);

  await sleep(300);
  runBtn.classList.add('visible');

  await sleep(400);
  await animateMouseClick();

  await sleep(300);
  editorEl.classList.add('hidden');

  await sleep(500);
  createWidget({
    model: { path: modelPath!, tips: false },
    primaryColor: 'rgba(255, 130, 160, 0.9)',
  });
}

run();

window.addEventListener('message', e => {
  if (e.data?.type === 'theme-change')
    document.documentElement.classList.toggle('dark', e.data.dark);
});
