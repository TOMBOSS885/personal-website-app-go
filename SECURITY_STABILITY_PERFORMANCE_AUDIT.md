# 生产级安全、稳定性与性能审查

审查日期：2026-09-05   
范围：`php_backend` PHP 后端、`frontend` React/Vite 前端、MySQL 迁移、Docker/Nginx/Supervisor、虚拟主机部署规则、备份与日志代码。

## 结论

当前系统具备较完整的认证、CSRF、对象归属、上传校验、OAuth state/PKCE、备份加密和日志保留机制。基于静态代码和前端实际构建，未发现已确认的普通用户升权、SQL 注入、路径穿越、任意代码执行或 OAuth 账号接管漏洞。

不建议在未完成生产环境验证前直接长期公网运行。主要原因是 PHP/MySQL 运行时未在本审查环境安装，无法做真实 API、数据库恢复、PHP-FPM、Nginx 生效配置和依赖漏洞验证；前端仍有两个超过 1MB 的首屏相关 chunk；创作者文章修改审计与后台审计日志链路不完整。

| 项目 | 评级 | 依据 |
|---|---|---|
| 安全性 | 良好 | 后端权限和输入校验较完整；生产配置与运行时尚未实测 |
| 稳定性 | 一般 | 事务和超时较好，但缺少真实故障/恢复演练，外部服务依赖仍需验证 |
| 性能 | 一般 | 构建成功且有分包，Markdown/ECharts chunk 过大，数据库 EXPLAIN 未验证 |
| 代码质量 | 一般 | 功能覆盖广，但路由和业务集中在大型 bootstrap.php，部分代码压缩成单行 |
| 生产部署成熟度 | 一般 | Docker 和虚拟主机规则齐全，但配置生效、PHP-FPM、HTTPS、备份恢复未现场确认 |

## 已完成修复

### P2：共享主机 CSP 允许脚本 `unsafe-inline`（已修复）

文件：`deploy/shared-host/nginx-rewrite.conf:17`。原策略中的 `script-src 'self' 'unsafe-inline'` 会使任意可注入的 inline script 更容易执行，扩大 XSS 影响。已删除 `unsafe-inline`，保留构建运行时所需 hash 和 `wasm-unsafe-eval`。修复后前端测试 110/110 通过。

### P3：备份清单 schema 版本过期（已修复）

文件：`php_backend/app/bootstrap.php:764,1292`。清单原标记为 `017`，实际迁移已到 `018`，会误导恢复判断；已更新为 `018`。数据库导出本身使用 `SHOW TABLES`，新增角色、作者字段和标签表会被扫描。

## 安全审计结果

### 认证、Session、Cookie：PASS / HARDENING

- 密码使用 `password_hash`/`password_verify`，未发现 MD5/SHA1 直存。
- 登录成功调用 `session_regenerate_id(true)`；启用 strict mode、仅 Cookie、HttpOnly、SameSite=Lax（`php_backend/app/bootstrap.php:72-89`）。
- 管理员和普通用户使用不同 Cookie 名称，避免相互登出。
- Session 版本在数据库校验，禁用账号和过期 Session 会失效。
- `Secure` 由当前 HTTPS/反向代理头决定。生产必须强制 HTTPS，并确认可信代理不会让攻击者伪造 `X-Forwarded-Proto`；此项未在真实代理环境验证。
- 用户/管理员写操作均要求 CSRF header；同时检查 `Sec-Fetch-Site`。未发现只依赖 React 隐藏按钮的权限设计。

### 注册、验证码、暴力破解：PASS / 未验证

验证码使用数据库哈希、10 分钟过期、一次性使用、错误次数上限和 IP/邮箱频率限制（`php_backend/app/mail.php:265-318`）。用户登录失败达到 3 次冻结 24 小时；文章密码有按客户端限制。SMTP 实际连通性、代理/IP 识别和并发竞态未实测。

### OAuth：PASS / HARDENING

OAuth 交易使用随机 state、PKCE、10 分钟过期、Session hash 绑定；身份以 provider + 稳定 subject 绑定，数据库有唯一约束。回调地址限制为本站 HTTPS 路径，外部请求禁跟随跳转并有 5/12 秒超时（`php_backend/app/oauth.php`）。未验证各供应商真实返回字段、生产回调配置和密钥轮换。

### RBAC、IDOR、管理员边界：PASS（代码审计）

- 后台路由先校验隐藏入口后再 `app_admin_required()`；写请求统一 CSRF。
- 创作者接口调用 `app_user_admin_required()`，要求用户角色 ADMIN 且至少绑定一个第三方账号。
- 文章/项目更新和删除带 `creator_user_id = 当前用户` 条件（`php_backend/app/creator.php:17-105`）。思维导图更新显式比较 `creator_id`（`php_backend/app/mind_maps.php:141-152`）。
- 修改用户角色、SMTP、系统设置和后台删除接口位于 `admin/`，不能由普通用户会话直接调用。
- 仍建议用两个真实账号执行 A/B 越权回归；本环境没有可用 PHP/MySQL 服务，标记未验证。

### 文章保护、思维导图、缓存：PASS / 未验证

受保护文章正文在服务端检查登录、第三方绑定和密码，响应设置 `no-store`；公开缓存仅用于公开列表。思维导图列表和详情要求登录及第三方绑定，修改仅限创建者。关联资源接口会返回已发布文章的元数据，不返回正文。真实 HTTP 缓存代理行为和密码文章端到端测试未验证。

### SQL 注入：PASS（静态审计）

数据库连接关闭模拟预处理（`PDO::ATTR_EMULATE_PREPARES=false`）；用户输入值普遍通过参数绑定。动态表名/排序位置使用白名单或正则约束。未发现可控字符串直接拼接为 WHERE 值的路径。仍需在真实库用 ZAP/手工参数做黑盒验证。

### XSS、URL、Markdown：PASS / HARDENING

React 默认转义；Markdown 使用 `react-markdown`，Mermaid SVG 有 DOMParser 清理 script、事件属性和外部 href；URL 通过 `safeUrl` 白名单限制协议。当前仍存在 Mermaid 的 `dangerouslySetInnerHTML`，安全性依赖清洗函数和 CSP，需增加真实恶意 Markdown 回归用例（SVG、data/javascript URL、HTML 注入）。

### 上传、目录穿越、RCE、SSRF：PASS（静态审计）

上传使用 `is_uploaded_file`、大小/扩展名/图像处理、随机文件名；上传目录 Nginx/Apache 规则禁止脚本和主动内容。备份恢复路径做安全相对路径校验，禁止隐藏路径和可执行扩展名。OAuth cURL 仅允许 HTTPS、禁重定向、有超时和响应大小限制。未发现 `eval`、`exec`、`unserialize` 或用户可控动态 include。真实 Web Server handler 配置未验证。

### 敏感信息、CORS、目录暴露：PASS / 部署依赖

SMTP 密码加密后仅返回 configured 标记，OAuth secret 不下发前端；`.env`、配置、迁移、日志、数据库文件在 Nginx 规则中拒绝。`.env` 未被 Git 跟踪。CORS 未发现宽松 credentials 配置。必须确认虚拟主机实际使用完整 `deploy/shared-host/nginx-rewrite.conf`，否则上述保护不成立。

## 发现的问题与风险

### P1：创作者文章修改没有进入现有后台审计日志（已修复）

文件：`php_backend/app/creator.php:78`、`php_backend/app/audit.php:180`。现已允许 `/creator/*` 写入 `admin_operation_logs`，事件类型为 `content_request`，并记录创作者邮箱、资源、差异和请求状态。`details_json.userId` 保存普通用户 ID，避免错误写入管理员外键。

### P2：创作者内容输入边界不足（已修复）

文件：`php_backend/app/creator.php`。文章正文现在限制 2MB，标题、摘要、专题、分类、封面地址、项目描述和技术栈均有长度及控制字符校验；项目外链仅允许 HTTP/HTTPS，排序和数值字段有范围限制，降低异常数据、日志膨胀和危险 URL 风险。

### P2：备份恢复不是任意旧数据库的无条件恢复（CONFIRMED LIMITATION）

`app_backup_execute_schema()` 仅 `CREATE TABLE IF NOT EXISTS`，不会给已有旧表添加新列；恢复到未执行 018 迁移的旧库时，含 `role`/`creator_user_id`/`tags` 的 INSERT 可能失败。恢复前应强制迁移版本检查，或在恢复流程中执行经过验证的迁移。

### P2：配置备份不是完整 `config.php`（CONFIRMED LIMITATION）

备份仅保存选定 app/OAuth 设置（`bootstrap.php:1283-1287`），数据库连接参数及未来新增配置键不会自动包含。恢复仍依赖目标机可写且正确的 `config.php` 与一致 `setup_key`。

### P2：生产 CSP 仍允许 `wasm-unsafe-eval`（HARDENING）

Mermaid/部分运行时可能需要它，但它扩大脚本执行能力。应在确认 Live2D、Mermaid 和 ECharts 不需要后移除，并用 nonce/hash 替代任何新增 inline 脚本。

### P2：MarkdownArticleRenderer 和 ECharts chunk 过大（CONFIRMED）

生产构建中 `MarkdownArticleRenderer` 约 1.35MB、`echarts` 约 1.12MB（未压缩），会影响首次打开文章和低带宽设备。应将 ECharts、Mermaid、Markdown 编辑能力按代码块/路由动态导入，并进一步拆分 renderer。

### P3：日志与临时数据清理依赖请求触发（HARDENING）

操作日志限制最近 200000 条，验证码/OAuth 交易和解锁尝试采用机会式清理。低流量站点可能长期保留过期数据，高流量站点清理会增加请求尾延迟。建议增加每日 cron，删除过期验证码、OAuth transaction、解锁尝试和旧备份，并配合数据库索引。

### P3：未配置 PHP-FPM/OPcache 生产参数（未验证）

仓库提供 Docker/Go 运行方式和虚拟主机规则，但没有当前 PHP-FPM pool、OPcache、内存与 worker 配置。不能据此证明不存在 worker 耗尽或 OOM 风险。部署时必须按服务器 RAM 设置 `pm.max_children`、`pm.max_requests`，启用 OPcache 并验证状态。

### P3：健康检查暴露可用性信息（HARDENING）

`/api/health` 只返回状态和 schema，没有密码/路径，风险较低；但应在公网按需限制来源或保留最小响应，避免被用于数据库版本/迁移状态枚举。

## 性能与稳定性

已具备：PDO 连接复用、事务包裹 OAuth/文章/思维导图写入、请求超时、分页上限、上传/JSON 大小限制、API 公共缓存、Nginx gzip/静态缓存、Supervisor 日志轮转。

主要瓶颈 Top 10：

1. MarkdownArticleRenderer 1.35MB。
2. ECharts 1.12MB。
3. Mermaid/Cytoscape 相关 chunk 仍有 400-660KB。
4. 文章搜索使用 `LIKE '%query%'`，数据增长后会全表扫描。
5. 标签列表从文章字符串逐行聚合，缺少规范化读取路径。
6. 思维导图资源和公开列表固定最多 500/1000 条，增长后响应和排序成本上升。
7. 部分列表仍使用 `SELECT *`，增加传输和内存占用。
8. 首页/公开数据缓存为文件或进程级逻辑，未验证多 PHP worker 一致性。
9. 备份导出把全表数据拼成逐行 SQL，数据量大时 CPU、临时磁盘和请求超时风险高。
10. 未配置/未验证 OPcache、PHP-FPM worker 和 MySQL slow query。

稳定性风险 Top 10：

1. 无真实备份恢复演练证据。
2. 旧迁移结构恢复可能失败。
3. 创作者审计历史缺失。
4. SMTP/OAuth 外部服务故障只能依赖请求内超时。
5. 虚拟主机 Nginx 规则是否完整生效未验证。
6. PHP-FPM 参数未提供，可能排队或 OOM。
7. 过期验证码/OAuth/解锁数据清理非定时任务。
8. 数据库慢查询、连接上限和磁盘容量未监控。
9. `uploads` 和备份磁盘配额未设置硬上限告警。
10. 前端缺少全局 Error Boundary 的完整运行时验证。

## 数据库审计清单

已有关键唯一约束和索引：用户邮箱、昵称规范化、OAuth 身份、文章/项目作者、思维导图作者、日志时间/事件。应在生产库执行 `EXPLAIN` 验证文章列表、作者列表、系列、搜索、日志分页；确认 `creator_user_id`、`updated_at`、`created_at` 复合索引命中。检查日志、site_visits、解锁尝试、验证码和 OAuth transaction 的实际行数与索引基数。

## 前端审计清单

Vite 生产构建成功，文件名带 hash，静态资源可长期缓存；图片组件使用 lazy loading/responsive 处理。路由页面已有较多拆分，但重型 Markdown、Mermaid、ECharts 仍需进一步动态导入。npm audit 因当前环境 DNS 无法访问 registry，未验证依赖漏洞；Browserslist 数据提示已过期。

## 基础设施与部署

Docker Nginx 已设置 gzip、etag、sendfile、静态 immutable 缓存、请求体上限、代理超时和 Supervisor 日志轮转。虚拟主机规则包含敏感文件、上传主动内容、API 路由和安全响应头保护。必须在实际主机检查：HTTPS 强制跳转、证书/HSTS、PHP 版本（建议 8.2+）、`display_errors=Off`、`log_errors=On`、OPcache、PHP-FPM pool、MySQL 版本/备份、Nginx 配置测试以及 `.env`/`.git`/`config.php` 的 HTTP 访问结果。

## 测试证据与未验证项

- `npm test -- --run`：27 个测试文件、110 个测试全部通过。
- `npm run build`：成功；构建警告存在多个超过 500KB 的 chunk。
- PHP CLI：未安装，未能运行 `php -l`。
- Composer：未安装，未能运行 `composer audit`。
- MySQL CLI/数据库：未安装，未能执行迁移、EXPLAIN、导出恢复演练。
- `npm audit`：registry DNS 失败，未得到漏洞数据库结果。
- 未进行真实公网扫描、浏览器端到端、压力测试或 PHP-FPM 监控测试。

## 评分

| 维度 | 分数 | 扣分原因 |
|---|---:|---|
| 安全性 | 78/100 | 运行时/Web Server 未验证，CSP 仍有 wasm 放宽项 |
| 稳定性 | 68/100 | 缺少真实故障和恢复演练，定时清理/监控不足 |
| 后端性能 | 70/100 | 缓存和限制较好，搜索/备份/运行时参数未验证 |
| 前端性能 | 64/100 | 构建成功但重型 chunk 明显 |
| 数据库设计 | 76/100 | 约束和索引较完整，缺少 EXPLAIN/大表实测 |
| 权限设计 | 84/100 | 角色、CSRF、所有权检查清晰，需黑盒回归 |
| 可维护性 | 68/100 | 大型单文件路由和部分压缩代码增加维护风险 |
| 生产部署成熟度 | 65/100 | 配置文件齐全，但 PHP-FPM/HTTPS/备份恢复未现场验收 |

上线判断：在完成 PHP/MySQL 环境验证、恢复演练、创作者审计补齐、生产 HTTPS/PHP-FPM/OPcache 配置确认前，不建议把当前版本视为已经完成生产验收。完成这些项目后，现有代码基础可以支持个人博客规模的公网长期运行。
