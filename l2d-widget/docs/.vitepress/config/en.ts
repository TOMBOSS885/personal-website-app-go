import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress';

const apiSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Functions',
    items: [
      { text: 'createWidget', link: '/api/functions/createWidget' },
    ],
  },
  {
    text: 'Interfaces',
    items: [
      { text: 'WidgetOptions', link: '/api/interfaces/WidgetOptions' },
      { text: 'ModelOptions', link: '/api/interfaces/ModelOptions' },
      { text: 'MenusOptions', link: '/api/interfaces/MenusOptions' },
      { text: 'MenuItem', link: '/api/interfaces/MenuItem' },
      { text: 'TipsOptions', link: '/api/interfaces/TipsOptions' },
      { text: 'Widget', link: '/api/interfaces/Widget' },
    ],
  },
];

export const en: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: 'en-US',
  description: 'A lightweight Live2D widget for the web',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/en/guide/', activeMatch: '/en/guide/' },
      { text: 'API', link: '/api/functions/createWidget', activeMatch: '/api/' },
      { text: 'Examples', link: '/en/examples/', activeMatch: '/en/examples/' },
    ],
    sidebar: {
      '/en/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/en/guide/' },
            { text: 'Installation', link: '/en/guide/installation' },
            { text: 'Quick Start', link: '/en/guide/quick-start' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Position & Transition', link: '/en/guide/position' },
            { text: 'Menu Customization', link: '/en/guide/menu' },
            { text: 'Tips & Typing', link: '/en/guide/tips' },
            { text: 'Multi-Model', link: '/en/guide/multi-model' },
          ],
        },
      ],
      '/api/': apiSidebar,
    },
    langMenuLabel: 'English',
    editLink: {
      pattern: 'https://github.com/hacxy/oh-my-live2d/edit/l2d-widget/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
};
