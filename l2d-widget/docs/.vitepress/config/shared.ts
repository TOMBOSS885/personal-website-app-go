import type { Plugin } from 'vite';
import type { DefaultTheme } from 'vitepress';
import type { ThemeConfig } from 'vitepress-theme-mild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const docsRoot = resolve(import.meta.dirname, '../..');
const projectRoot = resolve(docsRoot, '..');

function demoHtmlPlugin(): Plugin {
  const files: Record<string, string> = {
    '/demos/runner.html': resolve(docsRoot, 'demos/runner.html'),
    '/demos/hero.html': resolve(docsRoot, 'demos/hero.html'),
  };
  return {
    name: 'l2d-widget-demo-html',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const pathname = url.split('?')[0]!;
        const match = Object.entries(files).find(([prefix]) => pathname === prefix);
        if (!match)
          return next();
        const raw = readFileSync(match[1], 'utf-8');
        const html = await server.transformIndexHtml(pathname, raw);
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },
  };
}

export const shared: Partial<import('vitepress').UserConfig<ThemeConfig>> = {
  title: 'l2d-widget',
  description: 'A lightweight Live2D widget for the web',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],
  ignoreDeadLinks: true,
  vite: {
    resolve: {
      alias: {
        'l2d-widget': resolve(projectRoot, 'src/index.ts'),
      },
    },
    server: {
      fs: {
        allow: [projectRoot],
      },
    },
    plugins: [demoHtmlPlugin()],
    build: {
      rollupOptions: {
        input: {
          'demos-runner': resolve(docsRoot, 'demos/runner.html'),
          'demos-hero': resolve(docsRoot, 'demos/hero.html'),
        },
      },
    },
  },
  themeConfig: {
    outline: [2, 3],
    logo: '/logo.svg',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/hacxy/oh-my-live2d' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'MIT Licensed',
      copyright: 'Copyright © 2024-Present <a href="https://github.com/hacxy">Hacxy</a>',
    },
  } as ThemeConfig & DefaultTheme.Config,
};
