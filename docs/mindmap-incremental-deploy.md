# 思维导图增量更新部署说明（PHP 虚拟主机）

本压缩包用于已经部署本站 PHP 共享主机版本的网站。

## 更新包内容

- `index.html`：新版前端入口。
- `assets/`：带独立发布前缀的新版静态资源。
- `api/index.php`：PHP API 入口。
- `app/bootstrap.php`：新增思维导图路由。
- `app/mind_maps.php`：思维导图 API、权限和修改记录存储。
- `migrations/016_mind_maps.sql`：本次数据库迁移。
- 前台关联项目和文章时支持按名称、标题、摘要等关键词即时筛选。
- Markdown 支持 ` ```echarts ` 代码块，文章阅读页和后台预览会渲染交互式 ECharts 图表。

本包不包含 `config/`、`uploads/`、`.htaccess`、`setup.php`，不会覆盖生产数据库配置、上传文件和现有伪静态规则。

## 部署顺序

1. 在虚拟主机面板备份网站文件和当前 MySQL 数据库。
2. 打开“SQL 管理面板”，选中网站正在使用的数据库，导入 `migrations/016_mind_maps.sql`。此迁移只新增 `mind_maps` 和 `mind_map_revisions` 两张表，不删除或修改已有数据。
3. 打开“在线文件管理”，进入网站运行目录。正确目录中应能直接看到当前的 `index.html`、`assets`、`api`、`app`、`config`、`uploads`。
4. 将本 ZIP 上传到该目录，执行“解压”，目标选择当前目录，并允许覆盖同名文件。
5. 不要删除或覆盖服务器已有的 `config/` 和 `uploads/`。
6. 删除服务器上的更新 ZIP。如面板提供 PHP OPcache 清理或“重载 PHP”功能，执行一次。
7. 浏览器强制刷新后访问 `/api/health`，返回的 `schema` 应为 `016`；再访问 `/mindmaps` 验收。

## 验收项目

- 原站点首页、文章、项目和 `/monitor` 正常。
- 已登录但未绑定第三方账号的用户会被引导到账号设置。
- 已绑定至少一个第三方账号的用户可以创建和查看思维导图。
- 创建者可以编辑自己的导图，其他用户只能查看。
- 后台“思维导图”页面只提供删除整张导图；修改记录仍由后台保存，但不在界面展示。

若 `/api/health` 返回 `MIGRATION_REQUIRED`，说明 `016_mind_maps.sql` 尚未成功导入当前网站实际使用的数据库。
