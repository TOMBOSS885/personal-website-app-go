# PHP 共享主机安全性能补丁部署

本补丁用于已经部署过 PHP 迁移版的网站。补丁不会包含或覆盖 `config/`、`uploads/` 和 `setup.php`。

## 本次性能与 SEO 更新

- 首页导航和首页正文共享同一次 `/api/public/home` 请求。
- 首页下方文章封面全部懒加载，博客列表只优先加载第一张封面。
- 新上传的文章图片、头像和主题背景在主机支持 PHP GD 时自动生成响应式尺寸；缺少对应编码器时保留原图，不会导致上传失败。
- Live2D 仅在桌面首页空闲时自动加载；移动端、省流量、弱设备和内容页改为点击左下角按钮后加载。
- `robots.txt` 和 `sitemap.xml` 由 PHP 动态输出，站点地图会包含公开文章。
- 页面路由会更新标题、描述、canonical、Open Graph 和 Twitter 元数据。
- Nginx 配置增加静态页面安全响应头和 CSP Report-Only。

本安全性能部分对应迁移 `006` 至 `009`；本次内容沉淀功能还需要额外导入 `010_content_discovery.sql`，完整顺序请以 `DEPLOY-UPDATE.md` 为准。

## 部署前

1. 在主机面板备份网站文件和 MySQL 数据库。
2. 记下当前后台地址后缀。
3. 保留本地补丁 ZIP，确认解压后根目录包含 `index.html`、`assets/`、`app/`、`api/` 和 `migrations/`。

## 部署顺序

1. 打开 phpMyAdmin，选择网站数据库。
2. 依次导入 `migrations/006_security_performance_hardening.sql`、`migrations/007_friends_guestbook.sql`、`migrations/008_site_monitor.sql`、`migrations/009_guest_message_targets.sql` 和 `migrations/010_content_discovery.sql`。这些脚本都可以重复导入。
3. 在网站根目录把现有 `assets` 目录改名为 `assets-backup`。不要删除 `uploads` 或 `config`。
4. 将补丁 ZIP 上传到网站根目录并直接解压覆盖。
5. 确认新的 `assets` 目录已经生成，再删除 `assets-backup`。
6. Apache 主机将 `server-config/apache.htaccess` 的内容同步到网站根目录 `.htaccess`，并将 `server-config/uploads.htaccess` 上传为 `uploads/.htaccess`；Nginx 主机将 `server-config/nginx-rewrite.conf` 粘贴到面板的伪静态配置。
7. 如果域名正在使用代理/CDN，再清除对应缓存；仅 DNS 模式直接在浏览器强制刷新一次。

## 增量部署（本主机推荐）

这台主机的在线解压功能可能把新文件创建为错误的属主，文件在 FTP 中可见，但 Nginx 的 `try_files` 会返回 `404`。因此前端资源不要继续直接覆盖解压到现有 `assets`。

1. 使用 `scripts/build-shared-host-update.ps1` 构建，新资源会自动带上时间发布前缀。
2. 通过 FTP 将补丁中 `assets/` 下的新文件逐个上传到服务器 `/assets/`，不要先删除旧资源。
3. 随机打开新主文件和新 CSS 的完整 HTTPS 地址，确认都返回 `200`。
4. 将服务器当前 `index.html` 备份为带版本号的文件。
5. 最后上传新的 `index.html`。入口只有不到 1 KiB，这一步完成后整站会一次性切到新资源。
6. API 有改动时，只覆盖 `app/` 和 `api/index.php`；数据库结构有改动时先导入对应迁移。
7. 永远不要覆盖 `config/` 和 `uploads/`。确认新版本稳定后再清理较早的、已经没有任何 `index.html` 引用的编译资源。

Nginx 规则中 `/assets/` 的一年缓存和 `immutable` 可以保留，因为每次构建的文件名都不同；`index.html` 必须继续使用 `no-cache, no-store, must-revalidate`。这套顺序同时解决浏览器旧缓存、半套资源和新文件负缓存问题。

更新会使旧管理员 Session 失效，这是安全迁移的一部分。部署后请使用当前后台后缀重新登录。以后修改管理员密码或后台地址后，所有旧 Session 也会立即失效。

## 验证

依次检查：

1. `/api/health` 返回 `{"status":"ok","database":"ok","schema":"010"}`。
2. 首页、博客列表和主题可以正常打开。
3. 管理员可以登录；连续输错密码 5 次后只锁定当前来源 15 分钟。
4. 加密文章连续输错 5 次后返回 `ARTICLE_PASSWORD_LOCKED`。
5. 后台上传、删除背景图和清理未使用图片均能返回正常 JSON。
6. `/uploads/article-sites/任意路径` 返回 403 或 404。
7. `/friends` 能显示友链和留言区，后台“友链与留言”可以添加友链、隐藏或删除留言。
8. `/monitor` 能显示总访问量、独立访客和估算站点流量，悬停卡片时旋转暂停。
9. `/robots.txt` 返回 `text/plain`，内容包含 `Sitemap:`，不能再返回 React HTML。
10. `/sitemap.xml` 返回 `application/xml`，并包含 `/blog/文章ID`。
11. 打开浏览器开发者工具，首页只出现一次 `/api/public/home?lang=zh` 请求。
12. 移动端和文章页不会自动下载 `.moc3`；点击左下角模型按钮后才开始加载。

首次部署后，请在后台重新上传当前头像、背景图和最常用的文章封面，使现有图片获得响应式变体。旧图片继续兼容，但只有重新上传后的文件名包含 `@responsive-`，浏览器才会使用 `srcset`。生成的 `@320w`、`@640w` 等文件由系统自动管理，不要单独删除或在图库中引用。

如果线上域名并非当前请求的域名，可以在 `config/config.php` 的 `app` 配置中加入：

```php
'site_url' => 'https://你的正式域名',
```

未填写时，`robots.txt` 和 `sitemap.xml` 会使用当前请求域名自动生成地址。

如果 `/api/health` 返回 `DATABASE_ERROR`，通常表示第 2 步迁移没有成功导入。先恢复旧 `app` 目录，检查 phpMyAdmin 中的 SQL 报错，不要反复覆盖 `config` 或清空数据库。

`008_site_monitor.sql` 会从当前仍保留的访问明细建立累计基线，并且可以重复导入。迁移前已经被清理掉的历史明细无法恢复，因此新页面首次显示的累计数可能低于网站真实历史访问量。

“站点流量”是浏览器 Resource Timing 上报的同源资源传输量估算，每次访问最多计入 8 MiB，并受来源校验、30 秒去重和数据库限流保护。它用于观察趋势，不是主机商账单流量；准确流量仍应以虚拟主机面板或 Web 访问日志为准。

留言按服务器看到的来源 IP 使用数据库原子计数，每分钟最多 10 条。邮箱仅在后台显示；留言正文按纯文本渲染，友链和访客网址仅允许 `http`/`https`。透明框切换是访客浏览器的本地偏好，不写入数据库，也不会增加接口请求。
