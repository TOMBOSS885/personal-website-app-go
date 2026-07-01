import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress';

const apiSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '函数',
    items: [
      { text: '创建挂件', link: '/api/functions/createWidget' },
    ],
  },
  {
    text: '接口',
    items: [
      { text: '挂件选项', link: '/api/interfaces/WidgetOptions' },
      { text: '模型选项', link: '/api/interfaces/ModelOptions' },
      { text: '菜单选项', link: '/api/interfaces/MenusOptions' },
      { text: '菜单项', link: '/api/interfaces/MenuItem' },
      { text: '提示框选项', link: '/api/interfaces/TipsOptions' },
      { text: 'Widget 实例', link: '/api/interfaces/Widget' },
    ],
  },
];

export const zh: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: 'zh-CN',
  description: '轻量级 Live2D 网页挂件',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/functions/createWidget', activeMatch: '/api/' },
      { text: '示例', link: '/examples/', activeMatch: '/examples/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/' },
            { text: '安装', link: '/guide/installation' },
            { text: '快速开始', link: '/guide/quick-start' },
          ],
        },
        {
          text: '功能',
          items: [
            { text: '位置与动画', link: '/guide/position' },
            { text: '菜单定制', link: '/guide/menu' },
            { text: '提示气泡', link: '/guide/tips' },
            { text: '多模型切换', link: '/guide/multi-model' },
          ],
        },
      ],
      '/api/': apiSidebar,
    },
    langMenuLabel: '简体中文',
    outline: { label: '目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    editLink: {
      pattern: 'https://github.com/hacxy/oh-my-live2d/edit/l2d-widget/docs/:path',
      text: '在 GitHub 上编辑此页',
    },
  },
};
