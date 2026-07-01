import type { Theme } from 'vitepress';
import MildTheme from 'vitepress-theme-mild';
import DemoBlock from './components/DemoBlock.vue';
import Layout from './components/Layout.vue';
import './style/vars.css';

export default {
  extends: MildTheme,
  Layout,
  enhanceApp(ctx) {
    ctx.app.component('DemoBlock', DemoBlock);
  },
} satisfies Theme;
