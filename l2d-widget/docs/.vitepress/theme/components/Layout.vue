<script lang="ts" setup>
import type { Widget } from '../../../../src/index';
import { useData } from 'vitepress';
import MildTheme from 'vitepress-theme-mild';
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import HeroBrowser from './HeroBrowser.vue';

const { Layout } = MildTheme;
const { frontmatter } = useData();
const isHome = computed(() => frontmatter.value.layout === 'home');
const widget = shallowRef<Widget | null>(null);

async function initWidget() {
  if (widget.value || isHome.value)
    return;
  const { createWidget } = await import('../../../../src/index');
  widget.value = createWidget({
    model: {
      path: 'https://model.hacxy.cn/cat-black/model.json',
    },
    primaryColor: 'rgba(255, 130, 160, 0.9)',
  });
}

function destroyWidget() {
  widget.value?.destroy();
  widget.value = null;
}

watch(isHome, home => {
  if (home) {
    destroyWidget();
  }
  else {
    initWidget();
  }
});

onMounted(() => {
  initWidget();
});

onBeforeUnmount(() => {
  destroyWidget();
});
</script>

<template>
  <Layout>
    <template v-if="isHome" #home-hero-image>
      <HeroBrowser />
    </template>
  </Layout>
</template>
