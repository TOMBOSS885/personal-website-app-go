(function () {
  const jsStatus = document.querySelector('#js-status');
  const jsMessage = document.querySelector('#js-message');
  const image = document.querySelector('#test-image');
  const imageStatus = document.querySelector('#image-status');
  const imageMessage = document.querySelector('#image-message');
  const overallStatus = document.querySelector('#overall-status');
  const testButton = document.querySelector('#test-button');
  const actionResult = document.querySelector('#action-result');
  const clock = document.querySelector('#clock');
  const viewportSize = document.querySelector('#viewport-size');

  let imageReady = false;

  function markSuccess(element) {
    element.classList.remove('is-pending', 'is-error');
    element.classList.add('is-success');
  }

  function updateOverallStatus() {
    if (!imageReady) return;
    overallStatus.textContent = '全部正常';
    overallStatus.classList.add('is-success');
    document.documentElement.dataset.staticSiteReady = 'true';
  }

  function updateClock() {
    clock.textContent = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  function updateViewport() {
    viewportSize.textContent = `${window.innerWidth} × ${window.innerHeight}`;
  }

  markSuccess(jsStatus);
  jsMessage.textContent = '脚本已执行';

  if (image.complete && image.naturalWidth > 0) {
    imageReady = true;
    markSuccess(imageStatus);
    imageMessage.textContent = '相对路径图片已加载';
    updateOverallStatus();
  } else {
    image.addEventListener('load', function () {
      imageReady = true;
      markSuccess(imageStatus);
      imageMessage.textContent = '相对路径图片已加载';
      updateOverallStatus();
    });

    image.addEventListener('error', function () {
      imageStatus.classList.remove('is-pending', 'is-success');
      imageStatus.classList.add('is-error');
      imageMessage.textContent = '图片加载失败，请检查资源地址';
      overallStatus.textContent = '存在异常';
    });
  }

  testButton.addEventListener('click', function () {
    const time = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
    actionResult.textContent = `交互测试成功 · ${time}`;
    testButton.textContent = '再次运行';
  });

  window.addEventListener('resize', updateViewport);
  updateClock();
  updateViewport();
  window.setInterval(updateClock, 1000);
})();
