# PHP 虚拟主机初始部署包

这个包适用于一台全新的 Linux PHP 虚拟主机。包内包含当前 React 生产构建、完整 PHP 后端、001–020 数据库迁移、配置模板、初始化管理员页面、Apache 伪静态和 Nginx 伪静态规则。

包内不包含生产数据库、`uploads/` 里的个人文件、真实 OAuth Secret、SMTP 密码和现有站点配置。

## 1. 主机要求

- PHP 8.1 或更高版本。
- `PDO MySQL`、`OpenSSL`、`mbstring`、`fileinfo`、`curl`、`ZipArchive`、Session。
- MySQL 5.7/8.0 或 MariaDB 10.4+，字符集使用 `utf8mb4`。
- Apache `mod_rewrite`，或面板提供 Nginx 伪静态配置入口。
- `uploads/` 可写，建议权限 755；主机不允许时再按主机商要求使用 775。
- 已开启 HTTPS。OAuth、后台登录和 Cookie 都应通过 HTTPS 使用。

## 2. 上传目录

把 ZIP 上传到虚拟主机的网站根目录并解压，确保这些路径直接位于网站根目录：

```text
index.html
assets/
api/index.php
app/
config/config.php
migrations/
uploads/
setup.php
.htaccess
server-config/nginx-rewrite.conf
```

不要再套一层 `personal-website-initial/` 目录。`config/`、`app/`、`migrations/` 和 `server-config/` 应被 Web Server 拒绝访问。

## 3. 数据库

在主机面板创建一个新 MySQL 数据库和专用数据库用户，记下：

```text
数据库主机
数据库端口
数据库名
数据库用户名
数据库密码
```

在 phpMyAdmin 选中这个数据库，按文件名顺序导入：

```text
migrations/001_schema.sql
migrations/002_fix_default_theme.sql
...
migrations/019_admin_totp.sql
migrations/020_webdav_backup.sql
```

可以在 phpMyAdmin 的导入页面一次选择多个 SQL 文件；如果面板不支持多选，就严格按编号从 001 到 020 导入。导入完成后应看到 `admin_account`、`articles`、`projects`、`user_accounts`、`oauth_identities`、`mind_maps`、`mail_settings` 和 `webdav_backup_settings` 等表。

## 4. 配置数据库和应用密钥

在线编辑：

```text
config/config.php
```

填写数据库连接：

```php
'database' => [
    'host' => '主机面板显示的数据库主机',
    'port' => 3306,
    'name' => '数据库名',
    'user' => '数据库用户名',
    'password' => '数据库密码',
    'charset' => 'utf8mb4',
],
```

同时修改：

- `app.setup_key`：至少 32 位随机字符串。它用于 SMTP 密码、TOTP 密钥、OAuth 和完整备份配置的加密关联，迁移旧站时必须保留旧值。
- `app.analytics_key`：至少 32 位随机字符串。迁移旧站时建议保留旧值，便于统计访客摘要保持一致。
- `app.site_url`：新站点完整 HTTPS 地址。
- `app.admin_path_suffix`：后台初始入口后缀。安装后可在“账号安全”中修改。
- `oauth.*.callback_url`：改成新域名下的回调地址。

不要把真实 `config.php`、数据库密码、OAuth Secret 或 SMTP 密码提交到 Git，也不要放在网站可下载目录中。

## 5. 初始化管理员

打开：

```text
https://你的域名/setup.php
```

填写 `setup_key`、管理员用户名和至少 10 位密码。创建成功后立即删除网站根目录的 `setup.php`，再访问页面提示的后台入口。

如果是从旧站迁移，优先在新站完成基础配置后使用后台“导入完整备份”，不要重新创建一个会覆盖旧数据的管理员。

## 6. 第三方登录

当前支持 GitHub、QQ、微信、Google、Microsoft。每个平台都需要在其开发者后台登记完整、逐字一致的 HTTPS 回调地址：

```text
https://你的域名/api/auth/oauth/github/callback
https://你的域名/api/auth/oauth/qq/callback
https://你的域名/api/auth/oauth/wechat/callback
https://你的域名/api/auth/oauth/google/callback
https://你的域名/api/auth/oauth/microsoft/callback
```

在 `config/config.php` 的对应 `oauth` 项中填写 `client_id`、`client_secret`、`callback_url`，确认无误后把 `enabled` 改为 `true`。未配置的平台保持 `false`。

可以复用旧站的第三方应用和 Client Secret，但需要满足以下条件：

- 新旧站使用同一个域名，或已在第三方平台同时登记新域名回调地址。
- 回调路径保持 `/api/auth/oauth/{provider}/callback`。
- 新站配置中的 `client_id` 和 `client_secret` 与第三方平台一致。
- 新站导入旧数据库后，`oauth_identities` 中的绑定关系会保留。

如果域名改变，通常可以继续使用同一个 OAuth 应用，只需在平台后台新增新域名回调地址并修改配置；不要把 Secret 写入 React 前端。

## 7. Nginx / Apache

Apache 虚拟主机直接保留包内 `.htaccess`。Nginx 虚拟主机不能使用 `.htaccess`，请把：

```text
server-config/nginx-rewrite.conf
```

粘贴到面板的伪静态配置中，再根据面板 PHP-FPM 配置确认 `/api/index.php` 能执行。不要使用旧的简化伪静态片段，否则可能无法保护 `config/`、`app/`、`migrations/` 和上传目录。

## 8. 后台完整备份能否一键迁移

可以迁移站点主要数据。当前后台“导出完整备份”会加密保存：

- 当前数据库中的全部表、字段和数据，包括文章、项目、专题、标签、用户、管理员、OAuth 绑定、SMTP 设置、思维导图、修订记录、Live2D 配置、访问统计和操作日志。
- `uploads/articles`、`theme`、`avatars`、`live2d`、`article-sites` 中通过系统允许的文件。
- 应用设置和 OAuth 配置。

新服务器恢复时需要：

1. 先上传初始包并配置新数据库连接。
2. 先导入 001–020 迁移，使 `/api` 能正常启动。
3. 确认 `ZipArchive`、`OpenSSL`、`PDO MySQL` 可用，`config/config.php` 可写，`uploads/` 可写。
4. 登录后台，使用原备份密码导入 ZIP。
5. 恢复成功后所有 Session 会失效，需要重新登录。

备份 ZIP 的数据库和应用设置使用 AES-256-GCM 加密，备份密码无法找回。数据库连接密码不会作为应用设置恢复，仍由新服务器的 `config/config.php` 提供；导入的设置会恢复 `setup_key`、OAuth 等应用配置。旧站与新站若要继续解密已保存的 SMTP/TOTP 数据，必须保留旧站的 `setup_key`。

恢复到空数据库或已经导入最新 020 迁移的数据库最可靠。恢复到缺少新字段的旧结构数据库时，不能保证自动补齐所有字段；恢复前应先执行完整迁移。目标库中备份不存在的额外表也不会自动删除。

## 9. 部署后检查

```text
/api/health
```

应返回 `status: ok`、`database: ok` 和 `schema: 020`。然后检查：

- 首页、文章、项目、搜索和专题。
- 后台登录、账号安全和 2FA。
- 第三方登录入口配置状态。
- 图片、Live2D、静态文章和思维导图。
- `https://你的域名/config/config.php` 返回 403。
- `https://你的域名/uploads/test.php` 不会执行。

完成后删除 `setup.php`、安装包和数据库备份临时文件，并清理 PHP OPcache。
