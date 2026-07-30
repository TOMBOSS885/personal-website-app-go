# PHP 虚拟主机部署指南

本指南对应分支 `codex/php-shared-host`，目标是部署到 300MB 网站空间、200MB MySQL 的普通 PHP 虚拟主机。

## 一、迁移版包含什么

保留：

- React 前台、明暗主题、动画、Markdown、代码高亮、数学公式
- 首页、博客、文章详情、分类、标签、搜索、项目展示
- 单管理员后台
- 文章、项目、技能、能力卡片、个人资料和主题管理
- 文章封面、正文图片、头像和主题背景上传
- 文章独立访问密码
- 静态前端 ZIP 文章，包括安全解压、签名资源地址和 sandbox iframe
- Live2D 文件夹导入、自动纹理压缩和最多 3 个模型管理
- 匿名访问统计，包括趋势、访客、热门页面、来源、设备和最近访问

已删除：

- 音乐播放、音乐上传和音乐后台
- 普通用户注册、登录、账号和评论
- 客户端发布
- 用户监控、稳定性、安全大屏
- Redis、Go 服务、Docker、邮件验证码和 JWT

## 二、先确认主机能力

在主机面板中确认：

1. PHP 8.1 或更高版本（最低建议 PHP 7.4）。
2. MySQL 5.7/8.0，数据库配额至少 200MB。
3. 已启用 `PDO MySQL`、`session`、`mbstring` 和 `ZipArchive`；建议启用 `fileinfo`，未启用时迁移版会使用图片解析结果识别上传类型。
4. 支持 `.htaccess` 和 Apache `mod_rewrite`，或面板提供“伪静态”设置。
5. 网站根目录允许 PHP 写入 `uploads`。
6. 域名已经解析到主机，面板可以开启免费 HTTPS。

如果面板显示 PHP 版本低于 7.4，先切换版本再上传。

## 三、本地生成部署包

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-shared-host.ps1
```

生成：

```text
release/php-shared-host/
release/php-shared-host.zip
```

默认不打包旧上传文件，避免不小心超过 300MB。确认旧 `uploads` 已清理后，可运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-shared-host.ps1 -IncludeExistingUploads
```

脚本超过 270MB 会停止，给主机日志、Session 和后续图片留出空间。

已经部署过迁移版时，使用不会覆盖配置和上传文件的增量更新包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-shared-host-update.ps1
```

生成 `release/php-shared-host-update.zip`。它只包含新版前端、PHP 应用和数据库迁移，明确不包含 `config`、`uploads`、`setup.php` 和伪静态文件。

## 四、创建并导入数据库

1. 在主机面板创建一个 MySQL 数据库和数据库用户。
2. 打开 phpMyAdmin，选中刚创建的数据库。
3. 导入部署包中的 `migrations/001_schema.sql`。
4. 按文件名顺序继续导入其余迁移文件，例如 `migrations/002_fix_default_theme.sql`。
5. 导入后应看到 `admin_account`、`site_profile`、`articles`、`projects` 等表。

建议使用全新的空数据库。不要直接把脚本导入旧 Go 数据库，因为旧表包含已删除字段和用户/评论/音乐数据。

## 五、填写配置

先记下主机面板中的数据库参数。最省事的做法是在完成下一节的上传和解压后，使用主机文件管理器在线编辑：

```text
config/config.php
```

至少修改：

```php
'host' => '主机面板显示的数据库地址',
'name' => '数据库名',
'user' => '数据库用户名',
'password' => '数据库密码',
'setup_key' => '一段至少 32 位的随机字符串',
```

数据库地址不一定是 `localhost`，以主机面板为准。不要直接修改 ZIP 内部文件；也不要把真实配置提交到 Git。

## 六、上传网站

1. 在主机文件管理器中找到网站根目录，常见名称为 `wwwroot`、`public_html`、`htdocs`。
2. 上传 `php-shared-host.zip` 并解压。
3. 确保 `index.html`、`.htaccess`、`api`、`app`、`config`、`uploads` 直接位于网站根目录，不要多套一层 `php-shared-host` 文件夹。
4. 在线编辑 `config/config.php`，填写上一节列出的数据库配置和 `setup_key`。
5. 给 `uploads` 及其子目录设置写权限。常见值为 `755`；如果无法上传图片，再按主机商要求使用 `775`，不要直接使用 `777`。
6. 确认文件管理器没有漏掉两个 `.htaccess` 文件。

上传后目录应为：

```text
网站根目录/
├── index.html
├── assets/
├── api/index.php
├── app/bootstrap.php
├── config/config.php
├── migrations/001_schema.sql
├── uploads/.htaccess
├── setup.php
└── .htaccess
```

## 七、初始化管理员

浏览器打开：

```text
https://你的域名/setup.php?key=你在配置中填写的setup_key
```

创建唯一管理员，密码至少 10 位。成功后立即在主机文件管理器中删除：

```text
setup.php
```

然后访问：

```text
https://你的域名/admin/login
```

## 八、旧数据迁移

当前迁移版建议先上线空站，再按下面顺序搬数据：

1. 在旧服务导出文章、项目、技能、能力卡片和个人资料。
2. 通过新后台重新录入少量内容；文章很多时，再使用 phpMyAdmin 批量导入。
3. 旧 `articles` 映射到新表时只删除 `requires_login`，保留 `content_type`、`static_site_key` 和 `static_site_name`。
4. 旧静态文章还需要把原 ZIP 重新通过后台上传；只导入数据库字段不会自动复制静态文件。
5. 将旧管理员 BCrypt 哈希导入 `admin_account.password_hash` 也可以，但首次部署更建议用 `setup.php` 创建新密码。
6. 只上传仍被文章或资料引用的图片，避免占满 300MB。

字段对应：

| 旧数据 | 新位置 |
|---|---|
| 管理员用户 | `admin_account` |
| 站长公开资料 | `site_profile` |
| Markdown 文章 | `articles` |
| 项目 | `projects` |
| 技能 | `skills` |
| 能力卡片 | `feature_cards` |
| 当前主题 | `themes` |

普通用户、评论和音乐不迁移。

## 九、Live2D 导入（可选）

1. 登录后台并打开“Live2D 管理”。
2. 点击文件夹选择框，选择包含 `model.json` 或 `*.model3.json` 的完整模型文件夹。
3. 如果检测到多个入口，在“模型入口”中选需要使用的一个，然后点击“导入文件夹”。
4. 浏览器会删除未引用资源、去除 JSON 空白，并把纹理最长边缩到 1536px 后转为 WebP；音频不会上传。
5. 最多保留 3 个模型，前台同一时间只加载当前模型。建议只保留实际使用的一个，节省网站空间。

上传包限制为 20MB、256 个运行文件。若主机 PHP 的 `post_max_size` 小于 20MB，以主机限制为准；可以先删除模型目录中的预览图、PSD、说明文件和音频后重试。

## 十、静态前端文章

已有迁移版网站升级时，先在 phpMyAdmin 导入：

```text
migrations/004_static_frontend_articles.sql
```

然后上传增量包并更新伪静态规则。后台进入“文章管理”，新建或编辑文章，在“正文类型”选择“静态前端”，上传包含 `index.html` 的 ZIP。Vite、React 或 Vue 项目应先设置相对资源路径再构建：

```js
export default {
  base: './'
}
```

共享主机默认限制为 ZIP 12MB、解压后 40MB、最多 400 个文件；可以在“上传限制”调整，但仍受 PHP `upload_max_filesize`、`post_max_size`、执行时间和网站剩余空间限制。建议静态前端单包控制在 10MB 以内。

静态页面运行在不带 `allow-same-origin` 的 sandbox iframe 中，不能读取主站 Cookie、后台 Session 或 localStorage。文件保存在 `uploads/article-sites`，该目录必须禁止直链，只允许通过带 HMAC 签名的 `/api/public/article-sites/...` 读取。

## 十一、图片上传优化

后台所有普通图片都会在浏览器发送前先压缩，减少共享主机上的等待时间和 PHP 临时文件占用：

- 文章封面：最长边 1440px，目标不超过 800KB。
- 正文图片：最长边 1600px，目标不超过 1MB。
- 主题背景：最长边 1920px，目标不超过 1.5MB。
- 头像：裁剪为 512px 正方形，目标不超过 220KB。

JPEG、PNG 和普通图片会优先转为 WebP；动画 GIF 会保留原格式，过大的 GIF 需要先转换为 WebP。小于约 256KB 且尺寸合适的图片会直接上传，避免无意义的二次编码。Live2D ZIP 内的贴图不会单独重编码，以免破坏模型包结构。

已有的旧图片不会自动重压缩；Nginx 规则会为带日期目录的新上传图片设置一年缓存，更新图片时会生成新文件名，不会命中旧缓存。

## 十二、访问统计

前台公开页面会在浏览器空闲时记录一次访问，后台“访问统计”提供 7、30、90 天视图。数据库不保存原始 IP，只保存不可逆的匿名访客摘要；同一访客 30 秒内重复打开同一路径只记录一次。

明细最多保留 180 天且不超过 50000 行，清理由访问请求低概率触发，不需要定时任务。已有网站升级时必须先在 phpMyAdmin 导入：

```text
migrations/003_site_analytics.sql
```

## 十三、伪静态故障处理

先测试：

```text
https://你的域名/api/health
```

正常返回：

```json
{"status":"ok","database":"ok"}
```

如果首页能开但刷新 `/blog` 或 `/admin/login` 出现 404，说明伪静态未生效：

- Apache：确认网站根目录的 `.htaccess` 已上传，主机允许 `mod_rewrite`。
- Nginx 面板：`.htaccess` 不会生效。在“设置伪静态”中粘贴以下完整规则并保存：

```nginx
location ^~ /app/ {
    deny all;
}
location ^~ /config/ {
    deny all;
}
location ^~ /migrations/ {
    deny all;
}
location = /uploads/article-sites {
    return 404;
}
location ^~ /uploads/article-sites/ {
    return 404;
}
location ^~ /uploads/ {
    if ($uri ~* "\.(?:php[0-9]?|phtml|phar)$") {
        return 403;
    }
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
location ^~ /assets/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
location = /api {
    rewrite ^ /api/index.php?route= last;
}
location /api/ {
    rewrite ^/api/?(.*)$ /api/index.php?route=$1 last;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

在以上 `location` 规则前加入以下压缩设置，可把 Live2D 的 `.moc3` 传输体积减少约一半：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 5;
gzip_types text/plain text/css application/javascript application/json application/octet-stream image/svg+xml;
```

同样的规则保存在仓库的 `deploy/shared-host/nginx-rewrite.conf`。配置、迁移文件以及 `uploads/article-sites` 保护规则不要省略，否则静态文章可能绕过签名地址直接访问。

共享主机通常不能自行修改 Nginx 配置；若面板没有伪静态入口，需要联系主机商开启。

## 十四、上线检查

- `/api/health` 返回数据库正常。
- 首页、博客、项目和搜索可访问。
- 直接刷新 `/blog/1`、`/admin/login` 不出现 404。
- 管理员可以登录、退出和修改密码。
- 新建草稿不会显示在前台，发布后会显示。
- 封面、正文图片、头像和主题背景可以上传。
- Live2D 文件夹可以导入，前台启用后能显示。
- 静态前端 ZIP 可以导入并在文章页运行。
- `https://你的域名/uploads/article-sites/任意路径` 返回 403 或 404。
- “访问统计”在打开前台页面后出现记录。
- `https://你的域名/config/config.php` 返回 403。
- `https://你的域名/uploads/test.php` 无法执行。
- 已删除 `setup.php`。
- 已开启 HTTPS，并强制跳转 HTTPS。
- 部署文件明显低于 300MB，数据库明显低于 200MB。

## 十五、常见错误

`CONFIG_MISSING`：`config/config.php` 没上传或路径不对。

`DATABASE_ERROR`：数据库地址、库名、账号、密码错误，或没有导入 SQL。

首页或主题管理白屏，并且 `/api/public/theme` 返回 `{"preset":"default"}`：在 phpMyAdmin 导入 `migrations/002_fix_default_theme.sql`，然后强制刷新页面。

`CSRF_FAILED`：后台页面打开太久或 Session 失效，刷新后台重新登录。

图片上传 413：PHP 面板中的 `upload_max_filesize` / `post_max_size` 小于后台设置；把后台限制调低，或在面板提高 PHP 限制。

静态前端上传提示主机未启用 Zip：在主机面板 PHP 扩展中启用 `zip`/`ZipArchive`；面板没有该扩展时需要联系主机商。

静态前端上传提示 ZIP 超限：同时检查后台“上传限制”、PHP `upload_max_filesize`、`post_max_size` 和网站剩余空间。

图片上传返回 `INTERNAL_ERROR`：先上传新版 `app/bootstrap.php`。如果随后提示 `UPLOAD_DIR_FAILED` 或 `UPLOAD_FAILED`，将 `uploads` 及其子目录权限设为 `755`，仍不可写时按主机商要求使用 `775`。

删除操作返回 Nginx `405 Not Allowed`：主机屏蔽了原生 `DELETE`。上传最新版前端文件和 `app/bootstrap.php`；迁移版会自动使用 `POST + X-HTTP-Method-Override`，无需修改 Nginx。

登录后立即掉线：主机 Session 目录不可写，联系主机商修复 PHP Session，或检查域名是否在 HTTP/HTTPS 间来回跳转。

开启 FlClash TUN 后域名解析为 `198.18.x.x` 属于 Fake-IP 的正常行为。如果只有本站出现 TLS 中断，应先切换代理节点，或在 FlClash 中为 `blog.tombossking.xyz` 添加 `DIRECT` 规则；请求尚未到达 PHP 时，修改网站代码无法解决。需要兼容不同代理线路时，可以使用 Cloudflare 等 CDN 代理域名并缓存 `/assets/`、`/uploads/`。
