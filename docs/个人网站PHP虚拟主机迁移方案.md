# 个人网站 PHP 虚拟主机迁移方案

## 1. 项目目标

将当前项目：

- React 18 + Vite 前端
- Go + Gin 后端
- MySQL 数据库
- Redis 缓存与限流
- 管理员登录
- 普通用户注册、登录、评论和用户管理

改造为可直接部署到普通 PHP 虚拟主机的版本：

```text
React/Vite 静态前端
        +
PHP 8.1+ 后端 API
        +
MySQL 数据库
        +
单管理员 Session 登录
```

改造后不再需要：

- Go 运行环境
- Docker
- Redis
- Node.js 常驻进程
- Supervisor
- Nginx 反向代理
- 自定义监听端口

Node.js 只在本地用于构建前端，构建完成后上传静态文件即可。

---

## 2. 总体改造原则

### 2.1 保留内容

必须保留以下功能和观感：

- 原 React 页面布局
- TailwindCSS 样式
- Framer Motion 动画
- 明暗主题
- Markdown 文章渲染
- 代码高亮
- 数学公式
- Live2D 前台展示
- 首页个人资料
- 博客列表
- 文章详情
- 分类、标签和搜索
- 项目展示
- 技能展示
- 管理后台
- 后台新增、修改、删除和发布文章
- 文章封面和正文图片上传
- 管理员修改密码

### 2.2 删除内容

删除下列模块：

- 普通用户注册
- 普通用户登录
- 普通用户账户页面
- 邮箱验证码
- 用户密码重置
- 用户评论系统
- 用户活动记录
- 用户监控
- 用户封禁和审核
- 文章“登录后可查看”
- Redis 缓存
- Redis 限流
- Redis 阅读量缓冲
- SMTP 邮件验证码
- 高级安全统计
- 多用户相关 API
- 多用户相关数据库表

### 2.3 暂缓迁移内容

以下功能建议放在第二阶段：

- 多 Live2D 模型后台上传
- 音乐文件上传和流媒体播放
- 客户端下载管理
- 操作日志
- 高级安全仪表盘
- 数据自动导出
- 图片自动 WebP 转换
- 对象存储和 CDN 集成

---

## 3. 推荐的新架构

```text
浏览器
  │
  ├── React 静态文件
  │     ├── index.html
  │     ├── assets/*.js
  │     └── assets/*.css
  │
  ├── /api/*
  │     └── PHP 统一入口
  │
  ├── /uploads/*
  │     ├── articles/
  │     ├── avatars/
  │     ├── theme/
  │     └── live2d/
  │
  └── MySQL
        ├── admin_account
        ├── site_profile
        ├── articles
        ├── projects
        ├── skills
        ├── feature_cards
        ├── themes
        └── live2d_settings
```

虚拟主机需要支持：

- PHP 8.1 或更高版本
- MySQL 5.7 或 8.0
- PDO MySQL
- PHP Session
- `password_hash()` 和 `password_verify()`
- `finfo`
- 文件上传
- URL 重写或伪静态
- HTTPS
- 可写目录

---

## 4. Git 分支建议

不要直接覆盖现有 Go 版本。

建议创建新分支：

```bash
git checkout -b php-shared-host
```

原 `main` 分支继续保留 Go 版本。

建议迁移后的仓库结构：

```text
personal-website-app-go/
├── frontend/
├── php_backend/
│   ├── app/
│   ├── config/
│   ├── migrations/
│   └── public/
├── legacy/
│   └── go_back/
├── deploy/
│   ├── .htaccess
│   └── nginx-rewrite.conf
└── docs/
    └── php-shared-host-deploy.md
```

---

## 5. 前端改造方案

## 5.1 保持原页面设计

保留现有：

- React
- Vite
- TailwindCSS
- Framer Motion
- React Router
- React Markdown
- KaTeX
- Live2D
- Lucide 图标

最终前端仍执行：

```bash
cd frontend
npm install
npm run build
```

生成：

```text
frontend/dist/
```

上传 `dist` 目录中的内容即可。

---

## 5.2 修改 `frontend/src/App.jsx`

删除：

```text
UserAuthProvider
UserLoginPage
UserAccountPage
/login
/account
普通用户会话恢复
普通用户账号相关路由
```

保留：

```text
/
/blog
/blog/:id
/projects
/search
/admin/login
/admin/*
```

管理员路由由异步 Session 检查保护：

```text
访问 /admin
→ 请求 GET /api/admin/session
→ 已登录：进入后台
→ 未登录：跳转 /admin/login
```

不能再只检查 `sessionStorage` 中是否有 token。

---

## 5.3 新增管理员认证上下文

新增：

```text
frontend/src/contexts/AdminAuthContext.jsx
frontend/src/api/adminFetch.js
```

职责：

- 检查管理员 Session
- 登录
- 退出
- 保存 CSRF Token
- 管理接口自动携带 CSRF Token
- 遇到 401 时跳转 `/admin/login`

推荐请求格式：

```javascript
fetch('/api/admin/articles', {
  credentials: 'same-origin',
  headers: {
    'X-CSRF-Token': csrfToken
  }
})
```

---

## 5.4 修改后台登录页

保留：

- 页面背景
- 明暗主题
- 用户名输入
- 密码输入
- 登录按钮
- 加载动画
- 错误提示

删除：

- 邮箱验证码
- 验证码重发
- 验证邮箱提示
- JWT 保存
- `sessionStorage.setItem('token')`

登录接口：

```text
POST /api/auth/login
```

请求：

```json
{
  "username": "admin",
  "password": "你的密码"
}
```

成功：

```json
{
  "success": true,
  "username": "admin"
}
```

登录成功后跳转：

```text
/admin
```

---

## 5.5 修改文章管理页面

第一版保留：

- 标题
- 摘要
- 正文
- 分类
- 标签
- 封面
- 是否发布
- 新增
- 编辑
- 删除
- 本地草稿自动保存
- 封面上传
- 正文图片上传
- Markdown / 静态前端正文类型切换
- 静态前端 ZIP 安全导入

删除：

- `requiresLogin`
- 批量设置登录可见
- 普通用户权限设置

可选保留：

- `isLocked`
- `accessPassword`

文章独立密码不依赖普通用户体系，可以通过 PHP Session 实现。

---

## 5.6 修改后台菜单

从 `AdminLayout.jsx` 删除：

```text
用户监控
访问安全
站点稳定性
```

建议第一版后台菜单：

```text
概览
文章管理
项目管理
能力卡片
专业技能
个人信息
主题管理
Live2D 设置
上传设置
账号安全
```

---

## 5.7 删除或停用的前端文件

```text
frontend/src/contexts/UserAuthContext.jsx
frontend/src/pages/UserLoginPage.jsx
frontend/src/pages/UserAccountPage.jsx
frontend/src/components/CommentSection.jsx
frontend/src/pages/admin/UserMonitor.jsx
frontend/src/pages/admin/SecurityManager.jsx
frontend/src/pages/admin/StabilityManager.jsx
```

同时清理相关 import、路由和菜单。

---

## 6. PHP 后端结构

推荐使用原生 PHP，不建议使用 Laravel。

原因：

- 300MB 网站空间较小
- 共享主机性能有限
- Composer 依赖较多
- 原生 PHP 足以实现个人博客
- 部署简单

推荐目录：

```text
php_backend/
├── app/
│   ├── Controllers/
│   │   ├── AuthController.php
│   │   ├── ArticleController.php
│   │   ├── ProjectController.php
│   │   ├── ProfileController.php
│   │   ├── ThemeController.php
│   │   └── UploadController.php
│   ├── Middleware/
│   │   ├── AdminAuth.php
│   │   └── CsrfGuard.php
│   ├── Repositories/
│   ├── Services/
│   └── Support/
│       ├── Database.php
│       ├── JsonResponse.php
│       ├── Router.php
│       ├── Validator.php
│       └── Session.php
├── config/
│   └── config.php
├── migrations/
│   ├── 001_schema.sql
│   └── 002_import_old_data.sql
└── public/
    └── api/
        └── index.php
```

---

## 7. 单管理员登录方案

## 7.1 使用 PHP Session

流程：

```text
管理员输入用户名和密码
→ PHP 查询 admin_account
→ password_verify() 校验
→ session_regenerate_id(true)
→ 写入管理员 Session
→ 浏览器保存 HttpOnly Cookie
```

Session Cookie 应设置：

```text
HttpOnly
Secure
SameSite=Lax
```

---

## 7.2 管理员接口

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/admin/session
PUT  /api/admin/account/password
```

Session 检查响应：

```json
{
  "authenticated": true,
  "username": "admin",
  "csrfToken": "随机令牌"
}
```

所有修改数据的请求携带：

```http
X-CSRF-Token: 随机令牌
```

包括：

```text
POST
PUT
PATCH
DELETE
```

---

## 7.3 登录失败限制

不使用 Redis。

在 `admin_account` 中保存：

```text
failed_login_attempts
locked_until
```

规则建议：

```text
连续失败 5 次
→ 锁定 10 分钟

登录成功
→ failed_login_attempts 清零
→ locked_until 清空
```

---

## 8. API 兼容方案

为尽量不改前端，继续使用原接口路径。

## 8.1 公开接口

```text
GET /api/health
GET /api/public/profile
GET /api/public/home
GET /api/public/stats
GET /api/public/articles
GET /api/public/articles/{id}
GET /api/public/categories
GET /api/public/tags
GET /api/public/projects
GET /api/public/projects/featured
GET /api/public/skills
GET /api/public/feature-cards
GET /api/public/theme
GET /api/public/live2d-model
GET /api/public/search
```

---

## 8.2 管理接口

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/admin/session

GET    /api/admin/articles
POST   /api/admin/articles
PUT    /api/admin/articles/{id}
DELETE /api/admin/articles/{id}

GET    /api/admin/article-images
POST   /api/admin/article-images

GET    /api/admin/projects
POST   /api/admin/projects
PUT    /api/admin/projects/{id}
DELETE /api/admin/projects/{id}

GET    /api/admin/skills
POST   /api/admin/skills
PUT    /api/admin/skills/{id}
DELETE /api/admin/skills/{id}

GET    /api/admin/feature-cards
POST   /api/admin/feature-cards
PUT    /api/admin/feature-cards/{id}
DELETE /api/admin/feature-cards/{id}

GET    /api/admin/profile
PUT    /api/admin/profile
POST   /api/admin/profile/avatar

GET    /api/admin/theme
POST   /api/admin/theme

GET    /api/admin/dashboard-stats
PUT    /api/admin/account/password
```

---

## 8.3 分页格式

继续保留：

```json
{
  "content": [],
  "totalElements": 0,
  "totalPages": 0,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true,
  "empty": true
}
```

不要改为其他分页格式，否则博客页面和文章管理页面都需要大量调整。

---

## 8.4 错误格式

统一返回：

```json
{
  "message": "错误信息",
  "code": "ERROR_CODE"
}
```

常用状态码：

| 场景 | 状态码 |
|---|---:|
| 成功 | 200 |
| 新建成功 | 201 |
| 参数错误 | 400 |
| 未登录 | 401 |
| 无权限 | 403 |
| 不存在 | 404 |
| 文件过大 | 413 |
| 服务器错误 | 500 |

---

## 9. 数据库设计

## 9.1 保留的表

```text
admin_account
site_profile
articles
projects
skills
feature_cards
themes
live2d_models
live2d_settings
article_images
upload_settings
client_download_settings
```

---

## 9.2 唯一管理员表

```sql
CREATE TABLE admin_account (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

只保留：

```text
id = 1
```

密码必须使用：

```php
password_hash($password, PASSWORD_DEFAULT);
password_verify($password, $hash);
```

---

## 9.3 个人资料表

```sql
CREATE TABLE site_profile (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL,
    avatar VARCHAR(500) DEFAULT '',
    bio VARCHAR(1000) DEFAULT '',
    bio_en VARCHAR(1000) DEFAULT '',
    location VARCHAR(255) DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    github VARCHAR(255) DEFAULT '',
    twitter VARCHAR(255) DEFAULT '',
    linkedin VARCHAR(255) DEFAULT '',
    email_public VARCHAR(255) DEFAULT '',
    tags VARCHAR(500) DEFAULT '',
    tags_en VARCHAR(500) DEFAULT '',
    welcome_text VARCHAR(255) DEFAULT '',
    welcome_text_en VARCHAR(255) DEFAULT '',
    cta_title VARCHAR(255) DEFAULT '',
    cta_title_en VARCHAR(255) DEFAULT '',
    cta_description VARCHAR(1000) DEFAULT '',
    cta_description_en VARCHAR(1000) DEFAULT '',
    coffee_count INT NOT NULL DEFAULT 0,
    stars_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

管理员账号和前台个人资料拆开，避免继续耦合。

---

## 9.4 文章表

```sql
CREATE TABLE articles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(1000) DEFAULT '',
    content MEDIUMTEXT NOT NULL,
    cover_image VARCHAR(500) DEFAULT '',
    category VARCHAR(100) DEFAULT '',
    tags VARCHAR(500) DEFAULT '',
    views INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 0,
    content_type VARCHAR(20) NOT NULL DEFAULT 'markdown',
    static_site_key VARCHAR(64) DEFAULT NULL,
    static_site_name VARCHAR(255) DEFAULT NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    access_password_hash VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_articles_published_created (published, created_at),
    INDEX idx_articles_category (category),
    INDEX idx_articles_content_type (content_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

删除：

```text
requires_login
```

文章支持 Markdown 和静态前端 ZIP。静态资源保存在受保护目录中，通过 PHP 短期签名 URL 读取，并运行在不带 `allow-same-origin` 的 sandbox iframe 中。

---

## 9.5 删除的旧表

完成备份和迁移后删除：

```text
users
comments
email_verification_codes
user_sessions
user_activities
rate_limit_settings
security_access_stats
ip_bans
```

实际名称以当前数据库导出结果为准。

---

## 10. Redis 删除方案

Redis 当前承担：

- 公共接口缓存
- 阅读量缓冲
- 限流
- 登录失败统计
- 健康检查

PHP 版改造如下。

### 10.1 公共接口

直接查询 MySQL。

个人博客访问量一般较低，只要建立索引，不需要 Redis。

### 10.2 阅读量

直接执行：

```sql
UPDATE articles
SET views = views + 1
WHERE id = ?;
```

### 10.3 登录限制

使用 `admin_account` 表中的：

```text
failed_login_attempts
locked_until
```

### 10.4 缓存

静态文件：

```http
Cache-Control: public, max-age=604800, immutable
```

公开 JSON：

```http
Cache-Control: public, max-age=30
```

后台接口：

```http
Cache-Control: no-store
```

---

## 11. 文件上传设计

300MB 空间很有限，应严格控制上传。

| 文件类型 | 建议上限 |
|---|---:|
| 头像 | 2MB |
| 文章封面 | 3MB |
| 正文图片 | 5MB |
| 主题背景 | 5MB |
| Live2D | 浏览器压缩后导入，最多保留 3 个模型 |
| 音频 | 不上传到虚拟主机 |

上传要求：

1. 使用 `finfo_file()` 检测 MIME
2. 只允许 JPG、PNG、GIF、WebP
3. 生成随机文件名
4. 禁止使用用户原始文件名作为保存路径
5. 禁止 PHP、PHTML、PHAR、HTML
6. 上传目录禁止执行 PHP
7. 使用年月目录
8. 数据库保存相对 URL
9. 防止目录穿越
10. 限制总上传空间

示例路径：

```text
/uploads/articles/2026/07/随机字符串.webp
```

---

## 12. URL 重写与 SPA 路由

由于项目使用 React BrowserRouter，必须配置 SPA 回退。

Apache `.htaccess` 示例：

```apache
RewriteEngine On

# PHP API 路由
RewriteCond %{REQUEST_URI} ^/api/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^api/(.*)$ api/index.php?route=$1 [QSA,L]

# 已存在文件和目录直接返回
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# React 前端路由
RewriteRule ^ index.html [L]
```

这样可以直接刷新：

```text
/blog
/blog/123
/projects
/admin/login
/admin/articles
```

而不会出现 404。

如果主机使用 Nginx，需在面板“伪静态”中填写对应规则，`.htaccess` 不生效。

---

## 13. 正式部署目录

建议网站目录：

```text
网站根目录/
├── index.html
├── assets/
├── api/
│   └── index.php
├── uploads/
│   ├── articles/
│   ├── avatars/
│   ├── theme/
│   └── live2d/
├── app/
├── config/
└── .htaccess
```

更安全的做法是把：

```text
app/
config/
migrations/
```

放在网站根目录之外。

虚拟主机不支持时，需要用规则禁止外部访问。

不要上传：

```text
node_modules
desktop
output
playwright
.git
Dockerfile
docker-compose.yml
Go 源代码
测试截图
开发文档
```

---

## 14. 数据迁移

### 14.1 迁移前备份

必须备份：

```text
MySQL 数据库
uploads 目录
.env
管理员账号
文章数据
项目数据
主题数据
Live2D 数据
```

### 14.2 数据迁移映射

```text
旧 users 管理员记录
→ admin_account
→ site_profile

旧 articles
→ 新 articles

projects
→ projects

skills
→ skills

feature_cards
→ feature_cards

themes
→ themes

live2d_settings
→ live2d_settings
```

### 14.3 密码迁移

如果旧管理员密码使用 BCrypt，可直接复用哈希。

PHP `password_verify()` 通常可以校验标准 BCrypt 哈希。

迁移后必须实际测试管理员登录。

---

## 15. 实施步骤

## 阶段 1：建立迁移基线

1. 创建 `php-shared-host` 分支
2. 导出数据库
3. 备份 uploads
4. 截图记录原页面
5. 保存公开 API 返回样例
6. 统计构建文件和上传目录大小
7. 确认虚拟主机 PHP、MySQL 和伪静态能力

## 阶段 2：创建 PHP 基础框架

实现：

```text
数据库连接
JSON 响应
统一路由
错误处理
Session
管理员登录
管理员退出
CSRF
健康检查
```

首先完成：

```text
GET  /api/health
POST /api/auth/login
GET  /api/admin/session
```

## 阶段 3：实现公开接口

顺序：

```text
profile
stats
articles
article detail
categories
tags
projects
skills
feature cards
theme
Live2D
search
```

## 阶段 4：实现文章后台

优先完成：

```text
文章列表
新建文章
编辑文章
删除文章
发布和取消发布
封面上传
正文图片上传
修改管理员密码
```

## 阶段 5：删除普通用户模块

删除：

```text
UserAuthContext
UserLoginPage
UserAccountPage
CommentSection
用户监控后台
普通用户 API
requiresLogin
SMTP
验证码
Redis
```

## 阶段 6：迁移其他后台

继续实现：

```text
个人资料
项目
技能
能力卡片
主题
Live2D 基础设置
上传限制
```

## 阶段 7：迁移数据

1. 创建新数据库表
2. 导入管理员
3. 导入个人资料
4. 导入文章
5. 导入项目和技能
6. 导入主题
7. 上传清理后的 uploads
8. 检查中文和时间字段
9. 检查图片路径

## 阶段 8：构建前端

```bash
cd frontend
npm install
npm run build
```

统计目录大小：

PowerShell：

```powershell
(Get-ChildItem .\dist -Recurse |
  Measure-Object -Property Length -Sum).Sum / 1MB
```

## 阶段 9：上传和部署

上传：

```text
frontend/dist/*
PHP 后端
.htaccess
uploads
```

导入 MySQL。

配置：

```text
数据库地址
数据库名称
数据库用户
数据库密码
Session
上传目录
站点域名
HTTPS
```

---

## 16. 安全要求

必须做到：

- 管理员密码使用哈希
- 管理接口检查 Session
- 所有写请求检查 CSRF
- 登录后重新生成 Session ID
- 后台接口 `Cache-Control: no-store`
- 上传文件严格验证
- 上传目录禁止执行 PHP
- SQL 使用 PDO 预处理
- 不向前端返回完整数据库错误
- 不在 Git 中提交数据库密码
- 不暴露配置文件
- 不允许访问 migration 文件
- 生产环境关闭 PHP 错误显示
- 错误写入日志文件
- 管理后台必须使用 HTTPS

---

## 17. 监控方案

在另一台服务器使用 Uptime Kuma 监控：

```text
https://你的域名/
https://你的域名/api/health
https://你的域名/api/public/articles?page=0&size=1
```

建议监控：

- HTTP 状态
- 首页关键词
- API JSON 关键词
- SSL 证书
- 响应时间
- DNS 解析

`/api/health` 建议返回：

```json
{
  "status": "ok",
  "database": "ok"
}
```

不要返回：

- 数据库密码
- 数据库地址
- 文件绝对路径
- PHP 配置详情
- Session 信息

---

## 18. 验收标准

| 测试项 | 验收结果 |
|---|---|
| 首页外观 | 与原版本基本一致 |
| 明暗主题 | 正常 |
| 动画 | 正常 |
| Live2D | 正常 |
| 博客列表 | 正常 |
| 分类和标签 | 正常 |
| 文章搜索 | 正常 |
| 文章详情 | Markdown、代码和公式正常 |
| 后台登录 | 唯一管理员可登录 |
| 后台刷新 | 不出现 404 |
| 发布文章 | 前台立即显示 |
| 草稿文章 | 前台不可见 |
| 编辑文章 | 正常 |
| 删除文章 | 正常 |
| 上传图片 | 正常 |
| 修改密码 | 正常 |
| 普通用户入口 | 完全删除 |
| 评论入口 | 完全删除 |
| Redis | 无依赖 |
| Go 服务 | 不需要运行 |
| Docker | 不需要 |
| Node.js | 只用于本地构建 |
| 网站文件 | 明显低于 300MB |
| 数据库 | 明显低于 200MB |
| HTTPS | 正常 |
| Uptime Kuma | 可正常监控 |

---

## 19. 第一版推荐范围

第一版仅实现：

```text
React 原前台
+ PHP API
+ MySQL
+ 单管理员 Session
+ 文章发布后台
+ 图片上传
+ 项目管理
+ 技能管理
+ 个人资料管理
+ 主题管理
+ 浏览器压缩导入 Live2D 模型
+ 匿名访问统计与 180 天明细
+ 静态前端 ZIP 文章
```

第一版不迁移：

```text
普通用户
评论
Redis
邮箱验证码
用户活动
用户监控
本地音乐上传
高级安全统计
未压缩的原始 Live2D 模型上传
```

---

## 20. 最终结论

该项目可以改造为适合普通 PHP 虚拟主机运行的版本。

最关键的三点：

1. 保留 React 前端，只修改认证和多用户相关代码；
2. 使用轻量 PHP API 替代 Go 后端；
3. 保持现有 `/api` 路径和 JSON 字段兼容。

采用该方案后，可以在不明显改变原网站观感的情况下，保留后台发布文章、项目管理、主题和个人资料功能，同时彻底移除 Go、Redis、Docker 和普通用户体系。
