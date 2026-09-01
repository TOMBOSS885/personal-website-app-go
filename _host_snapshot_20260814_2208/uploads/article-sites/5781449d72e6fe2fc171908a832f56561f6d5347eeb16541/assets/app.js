(function () {
  function enableHostResize() {
    if (window.parent === window || window.__OMBLOG_STATIC_RESIZE__) return;
    window.__OMBLOG_STATIC_RESIZE__ = true;
    let lastHeight = 0;
    let lastWidth = window.innerWidth;
    let frame = 0;

    function measure() {
      frame = 0;
      const root = document.documentElement;
      const body = document.body;
      const height = Math.ceil(Math.max(root.scrollHeight, root.offsetHeight, body.scrollHeight, body.offsetHeight));
      if (!Number.isFinite(height) || height < 1 || height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'omblog:static-site-size', height }, '*');
    }

    function scheduleMeasure() {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    }

    window.addEventListener('load', scheduleMeasure);
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      scheduleMeasure();
    }, { passive: true });
    document.addEventListener('load', scheduleMeasure, true);
    new MutationObserver(scheduleMeasure).observe(rootForObservation(), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open'],
      characterData: true,
    });
    if (document.fonts?.ready) document.fonts.ready.then(scheduleMeasure);
    scheduleMeasure();
  }

  function rootForObservation() {
    return document.documentElement || document.body;
  }

  enableHostResize();

  const memeCopy = {
    ai: { tag: '检测结果 / 99%', title: '含机量爆表', copy: '老师问：为什么你的参考文献语气像董事会纪要？我说这是数字化学习成果。其实只是我和电子室友进行了一场长达四小时的甲方拉扯。', quote: '“我不是不会写，我只是在监督人工智能完成素质教育。”' },
    hack: { tag: '流派认证 / 野路子', title: '校园邪修', copy: '正统做法是早睡早起，校园邪修是七点五十八睁眼、共享单车一路御剑、在老师点名的前一秒完成空间折叠。方法不一定优雅，结果必须到场。', quote: '“过程仅供参考，活着抵达就是版本答案。”' },
    out: { tag: '能量方向 / 向外', title: '今天不内耗', copy: '作业不会因为我焦虑就自己写完，所以我决定停止攻击自己，开始质问网速、天气、格式规范和那位从未在群里说过话的组员。', quote: '“不内耗自己，偶尔外耗一下世界。”' },
    pickle: { tag: '人格口感 / 嘎嘣脆', title: '酸黄瓜人格', copy: '没有逆天家境，没有主角光环，只有一张校园卡和一颗泡过现实盐水但依旧清醒的心。普通、略酸，关键时刻还能配一碗白粥。', quote: '“我很普通，但不耽误我发出清脆的声音。”' },
    self: { tag: '关系状态 / 自己人', title: '爱你老己', copy: '绩点可以明天查，邮件可以十分钟后回，先把饭吃了、觉补了、窗外那口气喘匀。大学不是连续四年的自我答辩。', quote: '“先别证明自己，先把自己从 DDL 里捞出来。”' },
  };

  const buttons = Array.from(document.querySelectorAll('.meme'));
  const title = document.querySelector('#meme-title');
  const tag = document.querySelector('#meme-tag');
  const copy = document.querySelector('#meme-copy');
  const quote = document.querySelector('#meme-quote');
  const form = document.querySelector('#status-form');
  const verdictText = document.querySelector('#verdict-text');
  const copyButton = document.querySelector('#copy-button');
  const panicButton = document.querySelector('#panic-button');
  const canvas = document.querySelector('#storm-canvas');
  const context = canvas.getContext('2d');
  let panicTimer = 0;

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      const content = memeCopy[button.dataset.meme];
      if (!content) return;
      buttons.forEach(function (item) {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      tag.textContent = content.tag;
      title.textContent = content.title;
      copy.textContent = content.copy;
      quote.textContent = content.quote;
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const scene = document.querySelector('#scene-select').value;
    const power = document.querySelector('#power-select').value;
    const style = document.querySelector('#style-select').value;
    const endings = ['能交就行，能过就是版本答案。', '保持活人感，禁止向绩点献祭灵魂。', '今天先赢五分钟，剩下的交给明天。', '雷霆归雷霆，饭还是要按时吃。'];
    const ending = endings[Math.floor(Math.random() * endings.length)];
    verdictText.textContent = `在${scene}以 ${power} 电量修炼${style}：${ending}`;
  });

  copyButton.addEventListener('click', function () {
    const text = verdictText.textContent;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    document.body.removeChild(textarea);
    copyButton.textContent = copied ? '✓' : '×';
    window.setTimeout(function () { copyButton.textContent = '⧉'; }, 1200);
  });

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function lightning() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(233,255,56,0.08)';
    context.fillRect(0, 0, width, height);
    for (let strike = 0; strike < 4; strike += 1) {
      let x = Math.random() * width;
      let y = -20;
      context.beginPath();
      context.moveTo(x, y);
      while (y < height) {
        x += (Math.random() - 0.5) * 80;
        y += 35 + Math.random() * 45;
        context.lineTo(x, y);
      }
      context.strokeStyle = strike % 2 ? '#00c8d7' : '#e9ff38';
      context.lineWidth = strike === 0 ? 5 : 2;
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = 16;
      context.stroke();
    }
    context.shadowBlur = 0;
  }

  panicButton.addEventListener('click', function () {
    window.clearTimeout(panicTimer);
    resizeCanvas();
    lightning();
    document.body.classList.add('is-panicking');
    panicButton.textContent = '雷霆已抵达';
    panicTimer = window.setTimeout(function () {
      document.body.classList.remove('is-panicking');
      context.clearRect(0, 0, canvas.width, canvas.height);
      panicButton.textContent = '启动雷霆模式';
    }, 1000);
  });

  function updateTime() {
    const now = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    document.querySelector('#local-time').textContent = `LOCAL TIME ${now}`;
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();
  updateTime();
  window.setInterval(updateTime, 60000);
})();
