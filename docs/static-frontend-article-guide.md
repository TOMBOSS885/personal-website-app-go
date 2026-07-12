# 静态前端文章使用说明

静态前端文章与普通 Markdown 文章共用标题、摘要、封面、分类、标签、发布状态、访问密码、阅读量、搜索和分享功能。区别只在正文区域：Markdown 文章渲染 Markdown，静态前端文章运行上传的 HTML/CSS/JS。

## 最简单的使用方式

1. 准备静态项目，入口文件必须是 `index.html`。
2. 确保 HTML 中引用 CSS、JS、图片时使用相对路径，例如 `./assets/app.js`，不要写服务器本机路径。
3. 将 `index.html`、CSS、JS 和资源文件压缩成一个 ZIP。
4. 后台进入“文章管理”，新建或编辑文章。
5. 正文区域选择“静态前端”，点击“选择 ZIP”。
6. 上传检查成功后，正常填写标题、摘要、封面、分类、标签、发布和密码保护，最后保存。

也可以直接压缩整个 `dist` 或 `build` 文件夹。后端会自动识别只有一个 `index.html` 的外层目录并去掉这一层。

## ZIP 示例

```text
my-site.zip
├── index.html
├── assets/
│   ├── app.js
│   ├── app.css
│   └── logo.webp
└── data.json
```

## Vite / React / Vue 构建建议

使用相对资源路径构建最稳定：

```js
// vite.config.js / vite.config.ts
export default {
  base: './'
}
```

然后执行构建并压缩 `dist`：

```bash
npm run build
```

## 兼容与安全边界

- 支持 HTML、CSS、JavaScript、JSON、source map、常见图片、字体、音视频、字幕、PDF、WebAssembly 和常见 glTF 3D 资源。
- 支持多级目录和不带扩展名的 SPA 路由回退。
- 静态页面运行在 sandbox iframe 中，可以执行脚本、表单、弹窗、下载、全屏和音视频。
- 为防止静态代码读取主站后台 token，不开放 `allow-same-origin`，因此静态页面不能使用主站的 Cookie、localStorage 或直接操作父页面。
- 静态资源必须通过短期签名 URL 读取；`/uploads/article-sites` 直链被禁止，加锁文章不能通过文件地址绕过。
- 静态前端签名默认有效 3600 秒，可通过 `ARTICLE_SITE_URL_TTL_SECONDS` 调整，允许范围为 300 至 86400 秒；较长时间运行且大量使用懒加载的应用可以适当增加。
- ZIP 会检查路径穿越、软链接、隐藏目录、文件类型、文件数量和解压总大小。
- HTML 单文件最大 10 MB，其他单文件最大 256 MB，避免异常压缩包在访问时占用过多内存。
- 资源地址会先完成 HMAC 验签，再读取文章状态；校验结果采用 Go 内存 L1、Redis L2、MySQL 最终校验的三级策略。文章更新、下架、换包或删除时会同步失效内存与 Redis 缓存；Redis 不可用时自动回退到短时内存缓存和 MySQL，不影响访问正确性。
- 签名地址按短时间窗口复用，同一版本文章反复打开时可继续使用浏览器缓存，不会因为每次请求的秒数不同而重复下载全部静态资源。
- 替换静态包或删除文章时会清理旧包；未保存的孤立包超过 24 小时后由维护任务清理。

## 上传限制

后台“上传限制”可以调整：

- ZIP 最大大小；
- 解压后的总大小；
- 解压后的文件数量。

如果生产环境使用 `AUTO_MIGRATE=false`，部署前需要给 `articles` 和 `upload_settings` 表增加对应字段；使用 `AUTO_MIGRATE=true` 时会自动补齐。

```sql
ALTER TABLE articles
  ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT 'markdown',
  ADD COLUMN static_site_key VARCHAR(64) NULL,
  ADD COLUMN static_site_name VARCHAR(255) NULL,
  ADD INDEX idx_articles_content_type (content_type);

ALTER TABLE upload_settings
  ADD COLUMN article_site_zip_max_mb INT DEFAULT 30,
  ADD COLUMN article_site_total_mb INT DEFAULT 100,
  ADD COLUMN article_site_file_count INT DEFAULT 1000;
```

## 宝塔自定义 Nginx 注意事项

Docker 配置已经自带保护规则。如果在宝塔中自行配置 Nginx，并且通过 `alias` 直接暴露整个 `uploads` 目录，必须把下面两段放在通用的 `/uploads/` 规则之前，禁止绕过 Go 后端的签名和文章密码校验：

```nginx
location = /uploads/article-sites {
    return 404;
}

location ^~ /uploads/article-sites/ {
    return 404;
}
```

浏览器应只通过 `/api/public/article-sites/...` 访问静态前端资源，不要为 `article-sites` 单独配置公开目录。
