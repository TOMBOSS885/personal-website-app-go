# 部署安全审计（2026-08-14）

本次审计覆盖共享主机的 Apache/Nginx 规则、上传目录、全量和增量发布脚本、发布 ZIP 边界，以及前端、PHP 应用和部署文档中的安全操作。审计没有读取或输出线上主机凭据。

## 已修复

### 1. 敏感文件与部署材料暴露（高）

根目录规则原来只保护 `app/`、`config/` 和 `migrations/`。现在 Apache 与 Nginx 同时拒绝 `server-config/`、点文件（保留 ACME 的 `.well-known`）、编辑器备份、环境文件、日志、数据库转储、私钥和常见依赖配置文件。这样即使误将源码或补丁说明解压到 Web 根目录，也不会被直接下载。

### 2. 上传目录主动内容（高）

上传目录新增拒绝 PHP、CGI、Shell、HTML、JavaScript、CSS、SVG、XML 等扩展名的规则，并保留 `nosniff`。这降低了同源存储型 XSS、脚本执行和错误 MIME 配置带来的风险。静态前端文章目录仍整体禁止直链，只能走签名资源 API。

### 3. 安全响应头与 CSP（中）

Apache 和 Nginx 均发送 HSTS、`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy`、`X-Permitted-Cross-Domain-Policies` 和关闭过时 XSS Auditor 的响应头。CSP 已从 Report-Only 改为执行模式：脚本只允许本站，并使用 `wasm-unsafe-eval` 兼容 Mermaid 的 WebAssembly（未开放普通 `unsafe-eval`）；连接仅允许本站及 HTTPS/WSS 资源，禁止对象、跨站表单和页面被第三方嵌入。

### 4. 发布 ZIP 路径穿越与供应链边界（中）

`build-shared-host.ps1` 与 `build-shared-host-update.ps1` 现在会：

- 拒绝重解析点和不在允许顶层目录内的文件；
- 拒绝发布包中的隐藏文件（必要的根 `.htaccess` 和 `uploads/.htaccess` 除外）；
- 拒绝上传目录的主动 Web 内容；
- 检测私钥、常见云/代码托管 Token 和带用户名密码的 FTP(S) URL；
- 生成 `SHA256SUMS.txt`；
- 校验 ZIP 条目不能使用绝对路径、盘符路径、`..` 路径或重复条目。

全量包仍包含首次初始化所需的模板 `config/config.php` 和 `setup.php`。初始化完成后必须删除 `setup.php`，并把 `config/config.php` 留在包外维护；增量包不包含这两者，也不包含 `uploads/` 或线上根 `.htaccess`。

## 仍需主机侧完成

- 全站启用 HTTPS，并确认 HTTP 到 HTTPS 的跳转；HSTS 只有在 HTTPS 响应上才会生效。
- Apache 主机把 `server-config/apache.htaccess` 同步为根 `.htaccess`，并把 `server-config/uploads.htaccess` 放到 `uploads/.htaccess`。Nginx 主机将 `server-config/nginx-rewrite.conf` 粘贴到面板伪静态配置。
- 首次初始化管理员后立即删除 `setup.php`。不要把数据库备份、ZIP 备份或 `config/` 放在 Web 根目录。
- 上传后使用 `SHA256SUMS.txt` 对文件做完整性核对；若 CDN 有缓存，先清理 `index.html`，再按文档的增量切换顺序发布。

## 验证记录

- PowerShell AST 解析：两个发布脚本通过。
- 增量构建（跳过前端重建，使用当前 `dist`）：通过；未压缩 5.52 MB，ZIP 约 1.75 MB。
- ZIP 边界检查：通过，包含路径安全校验和 SHA-256 清单。
- Node 依赖完整审计：`npm audit` 和 `npm audit --omit=dev` 均为 0 vulnerabilities；`nanoid` 已升级到 `3.3.18`。
- PHP 语法检查：当前执行环境没有 PHP CLI，无法在本机运行 `php -l`；上线前应在主机面板或 PHP CLI 对 `app/` 和 `api/index.php` 做语法检查。

## 残余风险

Mermaid 及其图形依赖使用 `wasm-unsafe-eval` 兼容 WebAssembly 运行时，未开放普通 JavaScript `unsafe-eval`；如后续构建链完全不需要 WebAssembly，可进一步删除该指令。PHP 应用层本次已增加备份导入白名单、上传路径和类型校验、CSRF 来源校验、会话失效绑定和文章响应缓存控制；上线前仍应按部署文档执行迁移并进行主机侧语法和回归检查。
