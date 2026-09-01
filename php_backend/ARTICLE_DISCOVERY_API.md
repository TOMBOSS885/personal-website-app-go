# PHP 文章发现接口

升级已有站点时，确认已经执行 `migrations/010_content_discovery.sql`，再上传新版 PHP 文件和迁移脚本并立即在 phpMyAdmin 中导入 `migrations/011_article_discovery.sql`，最后切换新版前端。迁移可重复执行，不删除或改写已有文章；导入后 `/api/health` 的 `schema` 应为 `011`。在迁移导入完成前，新版文章接口会因缺少字段而不可用，因此应把上传与导入安排在同一次维护窗口内。

迁移完成后先访问 `/api/health`，确认响应为 `{"status":"ok","database":"ok","schema":"011"}`，再启用依赖这些接口的前端页面。

## 公开接口

- `GET /api/public/articles/archive?year=2026`：返回 `{ totalArticles, years }`。`year` 可省略，支持 1970 至下一自然年；`years[]` 包含 `year`、`count`、`months`，`months[]` 包含两位数字的 `month`、`count` 和按发布时间倒序排列的 `articles`。单次最多返回 500 篇，超过时应带 `year` 缩小范围。
- `GET /api/public/articles/series`：返回系列数组。每项包含 `name`、`count`、`coverImage`、`summary`、`latestAt` 和按 `seriesOrder` 排列的 `articles`；系列内文章同时提供兼容导航组件的 `order` 字段。系列索引总计最多处理 500 篇文章。
- `GET /api/public/articles/popular?limit=6`：按 `views` 降序返回文章，`limit` 范围为 1-20，默认 6。
- `GET /api/public/articles/featured?limit=6`：只返回精选文章，按 `displayOrder` 升序排列，`limit` 范围为 1-20，默认 6。
- `GET /api/public/discovery?limit=6`：一次返回 `{ featured, popular, series }`，适合首页或内容发现页；为控制首页体积，组合接口中的每个系列最多携带 3 篇文章，`count` 仍是该系列完整文章数。

文章项沿用现有列表字段：`id`、`title`、`summary`、`coverImage`、`category`、`tags`、`seriesName`、`seriesOrder`、`featured`、`displayOrder`、`views`、`contentType`、`createdAt` 和 `updatedAt` 等。

这些接口只返回已发布文章的列表元数据，不返回正文和密码哈希。加锁文章与现有文章列表一致，只公开标题、摘要和 `isLocked` 标记，访问正文仍需密码。归档、系列和精选聚合结果缓存 60 秒；热门和组合接口缓存 15 秒，文章编辑或删除时自动清除服务端缓存。阅读量刚增加后，热门顺序最多可能延迟 15 秒更新。

## 文章管理字段

现有后台文章新增以下可选 JSON 字段：

- `featured: boolean`：是否进入精选文章列表。
- `displayOrder: number`：精选文章顺序，数字越小越靠前。

文章响应也会返回 `featured` 和 `displayOrder`。旧版前端在更新文章时不提交这两个字段，后端会保留其原值；新建文章时默认分别为 `false` 和 `0`。
