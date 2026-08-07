# 内容沉淀功能增量部署

本次更新包含 RSS/Atom、文章专题导航、上一篇/下一篇、相关文章，以及后台健康检查和可迁移备份。

## 部署顺序

1. 先备份网站根目录、`config/`、`uploads/` 和 MySQL 数据库。
2. 在 phpMyAdmin 中导入 `migrations/010_content_discovery.sql`。该脚本可重复执行，不会删除文章。
3. 上传补丁中的 `assets/`、`index.html`、`app/`、`api/index.php`、`migrations/` 和 `server-config/`，不要覆盖服务器上的 `config/`、`uploads/` 或 `setup.php`。
4. 将 `server-config/apache.htaccess` 或 `server-config/nginx-rewrite.conf` 同步到主机对应配置；Apache 还要把 `server-config/uploads.htaccess` 放到网站的 `uploads/.htaccess`。新增的 `/feed.xml` 和 `/atom.xml` 路由需要使用新规则。
5. 登录后台后打开 `/api/health`，确认返回 schema `010`。如果迁移未导入，接口会返回 `MIGRATION_REQUIRED`，不会再误报成功。再访问 `/feed.xml` 和 `/atom.xml`。

完整备份需要主机启用 `ZipArchive` 和 `OpenSSL`，并将 PHP 的 `upload_max_filesize`、`post_max_size` 设置为大于备份 ZIP 大小。导入前必须先配置新服务器自己的数据库连接；备份会恢复数据库内容和应用密钥，但不会覆盖数据库连接参数。

## 使用说明

- 文章专题在后台文章编辑器的“文章专题”和“专题顺序”中填写；相同专题名的文章会显示专题导航。
- 本版本不提供阅读历史、阅读进度或文章收藏功能；浏览器不会保存这些数据。
- 搜索页支持按文章、项目、留言和技能筛选，并会高亮匹配关键词。
- 后台“导出完整备份”会生成 ZIP，包含数据库全部表数据、所有 `uploads/` 文件和应用密钥快照；数据库与应用密钥使用 AES-256-GCM 加密，uploads 会按原文件打包，因此 ZIP 本身必须安全保存。
- 新服务器先部署代码并配置数据库，再在后台点击“导入完整备份”。导入会替换数据库和 `uploads/`，恢复后当前管理员会话失效，需要重新登录。备份密码无法找回，请与 ZIP 分开保存。
