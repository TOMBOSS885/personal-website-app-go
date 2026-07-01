import type { ThemeConfig } from 'vitepress-theme-mild';
import { defineConfigWithTheme } from 'vitepress';
import baseConfig from 'vitepress-theme-mild/config';
import { en } from './en';
import { shared } from './shared';
import { zh } from './zh';

export default defineConfigWithTheme<ThemeConfig>({
  ...shared,
  extends: baseConfig,
  locales: {
    root: { label: '简体中文', ...zh },
    en: { label: 'English', ...en },
  },
});
