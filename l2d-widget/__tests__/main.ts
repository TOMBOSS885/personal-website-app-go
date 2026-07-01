import type { Widget } from 'l2d-widget';

interface DemoModule {
  name?: string
  description?: string
  run: () => Widget
}

const modules = import.meta.glob<DemoModule>('./demos/*.ts', { import: 'default' });

let currentWidget: Widget | null = null;

function nameFromPath(path: string): string {
  return path.replace('./demos/', '').replace('.ts', '');
}

async function runDemo(path: string, load: () => Promise<DemoModule>, btn: HTMLButtonElement) {
  void currentWidget?.destroy();
  currentWidget = null;

  document.querySelectorAll<HTMLButtonElement>('.demo-btn').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  location.hash = nameFromPath(path);

  const mod = await load();

  const nameEl = document.getElementById('demo-name')!;
  const descEl = document.getElementById('demo-desc')!;
  nameEl.textContent = mod.name ?? nameFromPath(path);
  descEl.textContent = mod.description ?? '';

  currentWidget = mod.run();
}

const list = document.getElementById('demo-list')!;
const entries = Object.entries(modules);

if (entries.length === 0) {
  list.innerHTML = '<span class="empty">demos/ 下暂无测试用例</span>';
}
else {
  for (const [path, load] of entries) {
    const btn = document.createElement('button');
    btn.className = 'demo-btn';
    btn.textContent = nameFromPath(path);
    btn.addEventListener('click', () => {
      void runDemo(path, load, btn);
    });
    list.appendChild(btn);
  }

  // 优先恢复 hash 对应的 demo，否则运行第一个
  const hashName = location.hash.slice(1);
  const initialIndex = hashName
    ? entries.findIndex(([p]) => nameFromPath(p) === hashName)
    : -1;
  const targetIndex = initialIndex >= 0 ? initialIndex : 0;
  const [targetPath, targetLoad] = entries[targetIndex]!;
  const targetBtn = list.querySelectorAll<HTMLButtonElement>('.demo-btn')[targetIndex]!;
  void runDemo(targetPath, targetLoad, targetBtn);
}
