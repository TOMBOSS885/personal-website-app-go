<script lang="ts" setup>
import { ref } from 'vue';

const props = defineProps<{
  demo: string
}>();

const running = ref(false);
const iframeSrc = ref('');

function run() {
  if (running.value) {
    running.value = false;
    iframeSrc.value = '';
    return;
  }
  iframeSrc.value = `/demos/runner.html?demo=${props.demo}`;
  running.value = true;
}
</script>

<template>
  <div class="demo-block">
    <div class="demo-code">
      <slot />
    </div>
    <div class="demo-toolbar">
      <button class="demo-btn" :class="running ? 'demo-btn-stop' : 'demo-btn-run'" @click="run">
        {{ running ? '■ 停止' : '▶ 运行' }}
      </button>
    </div>
    <div v-if="running" class="demo-preview">
      <iframe :src="iframeSrc" class="demo-iframe" />
    </div>
  </div>
</template>

<style scoped>
.demo-block {
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
}

.demo-code :deep(div[class*='language-']) {
  margin: 0 !important;
  border-radius: 0 !important;
}

.demo-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.demo-btn {
  padding: 4px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.demo-btn:hover {
  opacity: 0.85;
}

.demo-btn-run {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.demo-btn-stop {
  background: var(--vp-c-danger-1, #e53e3e);
  color: #fff;
}

.demo-preview {
  border-top: 1px solid var(--vp-c-divider);
}

.demo-iframe {
  display: block;
  width: 100%;
  height: 350px;
  border: none;
  background: var(--vp-c-bg-soft);
}
</style>
