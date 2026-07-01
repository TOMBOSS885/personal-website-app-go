# Go 后端轻量化迁移接口与部署规范

本文档用于指导将当前 `backend` 目录下的 Spring Boot 后端迁移为轻量级 Go 后端。迁移后的 Go 服务必须优先保证前端兼容：公开接口、管理端接口、JWT 鉴权、上传文件路径、Live2D 模型资源路径和分页返回结构应尽量保持不变，避免大范围改动 `frontend`。

## 1. 迁移目标

### 1.1 核心目标

- 用 Go 单体服务替换 Java Spring Boot 后端，降低运行内存、镜像体积和冷启动成本。
- 保持现有接口路径兼容，前端仍通过 `/api/public/**`、`/api/admin/**`、`/api/auth/**` 访问。
- 保持 MySQL 数据库表结构基本兼容，现有数据可以直接复用或通过少量迁移脚本适配。
- 保持 `/uploads/**` 静态资源路径兼容，文章图片、主题背景图、Live2D 模型资源继续可访问。
- 支持普通二进制部署、Nginx 反向代理部署、Docker 单服务部署和 Docker Compose 部署。

### 1.2 非目标

- 不在本次迁移中重写前端页面。
- 不强制引入微服务架构。
- 不强制引入 Redis、消息队列、对象存储；如未来访问量上升，可再扩展。

## 2. 推荐 Go 技术栈

| 层级 | 推荐方案 | 说明 |
| --- | --- | --- |
| HTTP 框架 | Gin | 简洁、生态成熟、性能足够，适合轻量化单体服务 |
| ORM | GORM | 对 MySQL 兼容好，便于从 JPA 实体迁移 |
| 数据库驱动 | `gorm.io/driver/mysql` | 连接 MySQL 8.0+ |
| JWT | `github.com/golang-jwt/jwt/v5` | 兼容 HMAC SHA 签名 |
| 密码哈希 | `golang.org/x/crypto/bcrypt` | 兼容当前 BCrypt 管理员密码 |
| 配置 | 环境变量 + `.env` 可选 | 生产环境优先环境变量 |
| 日志 | `log/slog` 或 zap | 小项目可先用标准库 `slog` |
| 静态资源 | Gin Static 或 Nginx | `/uploads/**` 必须保持 URL 兼容 |

推荐目录结构：

```text
go_back/
  cmd/server/main.go
  internal/config/
  internal/db/
  internal/model/
  internal/repository/
  internal/service/
  internal/handler/
  internal/middleware/
  internal/response/
  internal/storage/
  migrations/
  Dockerfile
  go.mod
```

职责划分：

- `handler`：只处理 HTTP 参数、状态码、响应格式。
- `service`：处理业务逻辑，例如登录、分页、Live2D 模型上传、主题启用。
- `repository`：封装数据库查询。
- `model`：定义数据库模型和 JSON DTO。
- `middleware`：JWT 鉴权、CORS、日志、错误恢复。
- `storage`：处理本地上传目录、路径清洗、文件写入、目录删除。

## 3. 兼容性约定

### 3.1 URL 与端口

Go 服务默认监听：

```text
0.0.0.0:8080
```

前端生产访问建议：

```text
http://域名:3718
```

Nginx 继续将 `/api/` 和 `/uploads/` 代理到 Go 后端：

```text
/api/     -> http://127.0.0.1:8080
/uploads/ -> http://127.0.0.1:8080
```

### 3.2 鉴权

管理端接口统一使用：

```http
Authorization: Bearer <jwt_token>
```

以下接口无需登录：

- `/api/auth/login`
- `/api/public/**`
- `/uploads/**`

以下接口必须登录：

- `/api/admin/**`

JWT 载荷建议：

```json
{
  "sub": "admin",
  "iat": 1710000000,
  "exp": 1710086400
}
```

其中 `sub` 存用户名。Go 后端校验 token 后应将用户名写入请求上下文，供修改密码等接口使用。

### 3.3 时间格式

API JSON 时间统一返回 RFC3339 字符串：

```json
"2026-07-01T21:30:00+08:00"
```

如果为了兼容当前前端，也可以返回 ISO 字符串：

```json
"2026-07-01T13:30:00Z"
```

数据库仍使用 `DATETIME`。Go 端需设置 MySQL DSN：

```text
parseTime=true&loc=Local
```

### 3.4 错误格式

当前前端主要读取 `message` 字段，因此错误响应必须至少包含：

```json
{
  "message": "错误原因"
}
```

推荐扩展格式：

```json
{
  "message": "参数错误",
  "code": "BAD_REQUEST",
  "details": {
    "field": "title"
  }
}
```

状态码规范：

| 场景 | HTTP 状态码 |
| --- | --- |
| 成功查询 | 200 |
| 成功创建 | 200 或 201，建议为兼容前端继续用 200 |
| 成功删除 | 200 |
| 参数错误 | 400 |
| 未登录或 token 无效 | 401 |
| 无权限 | 403 |
| 资源不存在 | 404 |
| 上传文件过大 | 413 |
| 服务内部错误 | 500 |

## 4. 数据模型与 JSON 字段

Go 模型建议使用数据库字段和 JSON 字段分离：

```go
type Article struct {
    ID         uint64    `gorm:"primaryKey" json:"id"`
    Title      string    `gorm:"column:title" json:"title"`
    Summary    string    `gorm:"column:summary" json:"summary"`
    Content    string    `gorm:"column:content" json:"content"`
    CoverImage string    `gorm:"column:cover_image" json:"coverImage"`
    Category   string    `gorm:"column:category" json:"category"`
    Tags       string    `gorm:"column:tags" json:"tags"`
    Views      int       `gorm:"column:views" json:"views"`
    Published  bool      `gorm:"column:published" json:"published"`
    CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
    UpdatedAt  time.Time `gorm:"column:updated_at" json:"updatedAt"`
}
```

注意事项：

- 数据库使用蛇形命名，例如 `cover_image`。
- JSON 使用前端现有驼峰命名，例如 `coverImage`。
- `BIT` 类型在 Go/MySQL 中可能扫描为 `[]byte` 或 `bool`，建议迁移为 `TINYINT(1)` 或在 GORM 中明确使用 `bool`。
- 密码字段绝不能在公开接口或管理资料接口中返回。

## 5. 分页格式

Spring Data Page 当前返回结构较复杂。Go 后端建议保留前端已使用的关键字段：

```json
{
  "content": [],
  "totalElements": 100,
  "totalPages": 10,
  "size": 10,
  "number": 0,
  "first": true,
  "last": false,
  "empty": false
}
```

字段说明：

- `content`：当前页数据数组。
- `totalElements`：总记录数。
- `totalPages`：总页数，计算方式为 `(total + size - 1) / size`。
- `size`：每页数量。
- `number`：当前页，从 0 开始，保持 Spring 兼容。
- `first`：是否第一页。
- `last`：是否最后一页。
- `empty`：当前页是否为空。

## 6. 接口规范

### 6.1 认证接口

#### POST `/api/auth/login`

请求：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

成功响应：

```json
{
  "token": "jwt-token"
}
```

失败响应：

```json
{
  "message": "用户名或密码错误"
}
```

实现要求：

- 根据 `username` 查询 `users` 表。
- 使用 BCrypt 校验密码。
- JWT 使用 `JWT_SECRET` 签名，过期时间读取 `JWT_EXPIRATION`，单位建议沿用毫秒。

### 6.2 公开接口

#### GET `/api/public/profile?lang=zh`

返回前台个人资料。`lang=en` 时优先返回英文扩展字段。

响应：

```json
{
  "nickname": "站长",
  "location": "中国",
  "website": "https://example.com",
  "github": "https://github.com",
  "twitter": "",
  "linkedin": "",
  "emailPublic": "hello@example.com",
  "coffeeCount": 1000,
  "starsCount": 1000,
  "bio": "个人简介",
  "tags": "全栈开发,技术爱好者",
  "welcomeText": "Hello, I'm",
  "ctaTitle": "Let's Work Together",
  "ctaDescription": "欢迎联系我"
}
```

#### GET `/api/public/stats`

响应：

```json
{
  "coffeeCount": 1000,
  "projectCount": 2,
  "articleCount": 10,
  "starsCount": 1000
}
```

计算规则：

- `projectCount`：`projects` 总数。
- `articleCount`：当前 Java 版为全部文章数。Go 版建议保持兼容，也统计全部文章。
- `starsCount`：优先使用 `users.stars_count`，为空时汇总 `projects.stars`。

#### GET `/api/public/articles?page=0&size=10&tag=Go`

响应为分页对象：

```json
{
  "content": [
    {
      "id": 1,
      "title": "文章标题",
      "summary": "摘要",
      "content": "正文",
      "coverImage": "/uploads/articles/2026/07/a.png",
      "category": "后端",
      "tags": "Go,Docker",
      "views": 100,
      "published": true,
      "createdAt": "2026-07-01T21:30:00+08:00",
      "updatedAt": "2026-07-01T21:30:00+08:00"
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 10,
  "number": 0,
  "first": true,
  "last": true,
  "empty": false
}
```

查询规则：

- 只返回 `published = true` 的文章。
- 默认按 `created_at DESC`。
- `tag` 传入时，按 `tags LIKE '%tag%'` 过滤，再只返回已发布文章。

#### GET `/api/public/articles/{id}`

响应为单篇文章对象。访问成功后 `views` 自增 1。

未找到或未发布时返回：

```json
{
  "message": "文章不存在"
}
```

状态码为 `404`。

#### GET `/api/public/tags`

响应：

```json
["Go", "Docker", "React"]
```

生成规则：

- 只扫描已发布文章。
- `tags` 以英文逗号分割。
- 去重并保持首次出现顺序。

#### GET `/api/public/projects`

响应：

```json
[
  {
    "id": 1,
    "name": "个人网站",
    "description": "项目描述",
    "coverImage": "/uploads/project.png",
    "techStack": "Go,React,MySQL",
    "githubUrl": "https://github.com/user/repo",
    "demoUrl": "https://demo.example.com",
    "stars": 100,
    "featured": true,
    "displayOrder": 1,
    "createdAt": "2026-07-01T21:30:00+08:00",
    "updatedAt": "2026-07-01T21:30:00+08:00"
  }
]
```

排序：`display_order ASC`。

#### GET `/api/public/projects/featured`

只返回 `featured = true` 的项目，排序同上。

#### GET `/api/public/skills`

响应：

```json
[
  {
    "id": 1,
    "name": "Go",
    "category": "后端",
    "proficiency": 85,
    "icon": "Code",
    "displayOrder": 1
  }
]
```

排序：`display_order ASC`。

#### GET `/api/public/feature-cards`

响应：

```json
[
  {
    "id": 1,
    "title": "全栈开发",
    "titleEn": "Full Stack Dev",
    "description": "描述",
    "descriptionEn": "Description",
    "icon": "Code",
    "gradient": "from-blue-500 to-cyan-500",
    "displayOrder": 1,
    "enabled": true
  }
]
```

查询规则：只返回 `enabled = true`，按 `display_order ASC`。

#### GET `/api/public/theme`

预设主题响应：

```json
{
  "id": 1,
  "name": "Preset: purple-pink",
  "preset": "purple-pink"
}
```

自定义主题响应：

```json
{
  "id": 2,
  "name": "Custom Theme",
  "custom": {
    "primary": "#8B5CF6",
    "secondary": "#EC4899",
    "accent": "#F59E0B",
    "background": "",
    "backgroundStyle": "gradient",
    "backgroundImage": "/uploads/theme-backgrounds/bg.webp",
    "cardBg": "rgba(255,255,255,0.1)",
    "textPrimary": "#1F2937",
    "textSecondary": "#6B7280"
  }
}
```

没有启用主题时返回：

```json
{
  "preset": "purple-pink"
}
```

### 6.3 Live2D 公开接口

#### GET `/api/public/live2d-model`

关闭或无模型时：

```json
{
  "enabled": false
}
```

启用时：

```json
{
  "enabled": true,
  "settings": {
    "enabled": true,
    "position": "bottom-right",
    "size": 280,
    "primaryColor": "rgba(96,165,250,0.92)",
    "transitionType": "slide",
    "transitionDuration": 1500,
    "menuAlign": "right",
    "showSleepButton": true,
    "showAboutButton": false
  },
  "models": [
    {
      "id": 1,
      "name": "模型名称",
      "modelPath": "/uploads/live2d/uuid/model.model3.json",
      "thumbnailPath": "/uploads/live2d/uuid/preview.png",
      "active": true,
      "switchable": true,
      "displayOrder": 0,
      "scale": 1.0,
      "offsetX": 0.0,
      "offsetY": 0.0,
      "volume": 0.0,
      "tipsEnabled": true,
      "welcomeMessages": "Welcome back!",
      "tipMessages": "Take a short break.\nRemember to save your ideas.",
      "tipDuration": 3500,
      "tipInterval": 9000,
      "tipOffsetX": 0,
      "tipOffsetY": 0,
      "typingEnabled": false,
      "typingParam": "PARAM_MOUTH_OPEN_Y",
      "typingSpeed": 120,
      "typingMinValue": 0.0,
      "typingMaxValue": 1.0,
      "createdAt": "2026-07-01T21:30:00+08:00"
    }
  ]
}
```

查询规则：

- 先读取 `live2d_settings` 第一条，无数据则创建默认配置。
- 如果 `enabled = false`，直接返回 `{ "enabled": false }`。
- 优先返回 `switchable = true` 的模型，按 `display_order ASC, created_at DESC`。
- 如果没有可切换模型，则返回 `active = true` 的模型。
- 如果仍没有模型，则返回 `{ "enabled": false }`。

### 6.4 管理端文章接口

以下接口均需要 `Authorization: Bearer <token>`。

#### GET `/api/admin/articles?page=0&size=10`

返回全部文章分页，包括未发布文章，按 `created_at DESC`。

响应格式同公开文章分页。

#### POST `/api/admin/articles`

请求：

```json
{
  "title": "标题",
  "summary": "摘要",
  "content": "正文",
  "coverImage": "/uploads/articles/2026/07/a.png",
  "category": "后端",
  "tags": "Go,Docker",
  "published": true
}
```

响应：创建后的文章对象。

实现要求：

- `title` 必填。
- `views` 默认 0。
- 创建时写入 `created_at` 和 `updated_at`。

#### PUT `/api/admin/articles/{id}`

请求字段同创建接口。响应更新后的文章对象。

只更新以下字段：

- `title`
- `summary`
- `content`
- `coverImage`
- `category`
- `tags`
- `published`

#### DELETE `/api/admin/articles/{id}`

成功响应体可以为空，状态码 `200`。

### 6.5 管理端项目接口

#### GET `/api/admin/projects`

返回全部项目数组。

#### POST `/api/admin/projects`

请求：

```json
{
  "name": "项目名",
  "description": "描述",
  "coverImage": "/uploads/project.png",
  "techStack": "Go,React",
  "githubUrl": "https://github.com/user/repo",
  "demoUrl": "https://demo.example.com",
  "featured": true,
  "displayOrder": 1
}
```

响应：创建后的项目对象。

#### PUT `/api/admin/projects/{id}`

更新项目字段，响应更新后的项目对象。

#### DELETE `/api/admin/projects/{id}`

成功状态码 `200`。

### 6.6 管理端技能接口

#### GET `/api/admin/skills`

返回全部技能数组。

#### POST `/api/admin/skills`

请求：

```json
{
  "name": "Go",
  "category": "后端",
  "proficiency": 85,
  "icon": "Code",
  "displayOrder": 1
}
```

响应：创建后的技能对象。

#### PUT `/api/admin/skills/{id}`

更新技能字段，响应更新后的技能对象。

#### DELETE `/api/admin/skills/{id}`

成功状态码 `200`。

### 6.7 管理端能力卡片接口

#### GET `/api/admin/feature-cards`

返回全部能力卡片，按 `display_order ASC`。

#### POST `/api/admin/feature-cards`

请求：

```json
{
  "title": "全栈开发",
  "titleEn": "Full Stack Dev",
  "description": "中文描述",
  "descriptionEn": "English description",
  "icon": "Code",
  "gradient": "from-blue-500 to-cyan-500",
  "displayOrder": 1,
  "enabled": true
}
```

响应：创建后的卡片对象。

#### PUT `/api/admin/feature-cards/{id}`

更新卡片字段，响应更新后的卡片对象。

#### DELETE `/api/admin/feature-cards/{id}`

成功状态码 `200`。

### 6.8 管理端资料接口

#### GET `/api/admin/profile`

返回第一条用户资料。为安全起见，Go 后端不应返回 `password`。

推荐响应：

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "ADMIN",
  "avatar": "",
  "nickname": "站长",
  "bio": "中文简介",
  "location": "中国",
  "website": "",
  "github": "",
  "twitter": "",
  "linkedin": "",
  "emailPublic": "",
  "tags": "全栈开发,技术爱好者",
  "welcomeText": "Hello, I'm",
  "ctaTitle": "Let's Work Together",
  "ctaDescription": "欢迎联系我",
  "coffeeCount": 1000,
  "starsCount": 1000,
  "bioEn": "English bio",
  "tagsEn": "Full Stack Dev",
  "welcomeTextEn": "Hello, I'm",
  "ctaTitleEn": "Let's Work Together",
  "ctaDescriptionEn": "Contact me"
}
```

#### PUT `/api/admin/profile`

请求字段同上，响应更新后的资料对象。

只允许更新展示资料字段，不允许通过该接口更新：

- `username`
- `password`
- `role`

### 6.9 管理端账号接口

#### PUT `/api/admin/account/password`

请求：

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

成功响应：

```json
{
  "message": "密码修改成功，请重新登录"
}
```

规则：

- 必须从 JWT 上下文中读取当前用户名。
- `currentPassword` 必填。
- `newPassword` 长度不少于 8。
- 新密码不能与旧密码相同。
- 修改成功后前端会让用户重新登录，服务端无需维护 token 黑名单。

### 6.10 管理端主题接口

#### POST `/api/admin/theme`

预设主题请求：

```json
{
  "preset": "purple-pink"
}
```

自定义主题请求：

```json
{
  "custom": {
    "primary": "#8B5CF6",
    "secondary": "#EC4899",
    "accent": "#F59E0B",
    "background": "",
    "backgroundStyle": "gradient",
    "backgroundImage": "/uploads/theme-backgrounds/bg.webp",
    "cardBg": "rgba(255,255,255,0.1)",
    "textPrimary": "#1F2937",
    "textSecondary": "#6B7280"
  }
}
```

响应：保存后的主题对象，格式同 `/api/public/theme`。

实现规则：

- 保存新主题前，将所有旧主题 `is_active` 置为 `false`。
- 新主题 `is_active = true`。
- 如果传入 `preset`，写入 `preset_key`，名称为 `Preset: <preset>`。
- 如果传入 `custom`，名称为 `Custom Theme`。

#### POST `/api/admin/theme/background-image`

请求类型：`multipart/form-data`

字段：

| 字段 | 类型 | 必填 |
| --- | --- | --- |
| file | File | 是 |

成功响应：

```json
{
  "url": "/uploads/theme-backgrounds/uuid.webp"
}
```

规则：

- 只允许图片类型。
- 后缀允许 `.jpg`、`.jpeg`、`.png`、`.gif`、`.webp`、`.avif`、`.svg`。
- 保存目录：`{APP_UPLOAD_DIR}/theme-backgrounds`。

#### GET `/api/admin/themes`

返回全部主题数据库对象。

### 6.11 文章图片上传接口

#### GET `/api/admin/article-images`

响应：

```json
[
  {
    "name": "uuid.png",
    "url": "/uploads/articles/2026/07/uuid.png",
    "size": 10240
  }
]
```

规则：

- 扫描 `{APP_UPLOAD_DIR}/articles`。
- 递归返回所有允许的图片。
- 按最后修改时间倒序。

#### POST `/api/admin/article-images`

请求类型：`multipart/form-data`

字段：

| 字段 | 类型 | 必填 |
| --- | --- | --- |
| file | File | 是 |

成功响应：

```json
{
  "name": "uuid.png",
  "url": "/uploads/articles/2026/07/uuid.png",
  "size": 10240
}
```

规则：

- 最大 10MB。
- 后缀允许 `jpg`、`jpeg`、`png`、`gif`、`webp`。
- Content-Type 允许 `image/jpeg`、`image/png`、`image/gif`、`image/webp`。
- 保存路径：`{APP_UPLOAD_DIR}/articles/{yyyy}/{MM}/{uuid}.{ext}`。
- 必须清洗路径，禁止 `../`、绝对路径、Windows 盘符逃逸。

### 6.12 管理端 Live2D 接口

#### GET `/api/admin/live2d-models`

响应：

```json
{
  "settings": {
    "enabled": true,
    "position": "bottom-right",
    "size": 280,
    "primaryColor": "rgba(96,165,250,0.92)",
    "transitionType": "slide",
    "transitionDuration": 1500,
    "menuAlign": "right",
    "showSleepButton": true,
    "showAboutButton": false
  },
  "models": []
}
```

模型对象格式同 `/api/public/live2d-model` 中的 `models`。

#### PUT `/api/admin/live2d-settings`

请求：

```json
{
  "enabled": true,
  "position": "bottom-right",
  "size": 280,
  "primaryColor": "rgba(96,165,250,0.92)",
  "transitionType": "slide",
  "transitionDuration": 1500,
  "menuAlign": "right",
  "showSleepButton": true,
  "showAboutButton": false
}
```

响应：保存后的 settings 对象。

#### POST `/api/admin/live2d-models`

请求类型：`multipart/form-data`

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 模型显示名称 |
| files | File[] | 是 | 完整模型目录内的全部文件 |
| paths | string[] | 是 | 与 files 一一对应的相对路径 |
| entryPath | string | 否 | 指定入口 `model.json` 或 `.model3.json` |

成功响应：创建后的模型对象。

实现规则：

- `files` 数量必须大于 0。
- `files` 和 `paths` 数量必须一致。
- 服务端生成 UUID 目录：`{APP_UPLOAD_DIR}/live2d/{uuid}`。
- 每个 `paths` 必须转换为安全相对路径：
  - 替换 `\` 为 `/`。
  - 移除开头 `/`。
  - 移除 Windows 盘符。
  - 解析后的目标路径必须仍在模型目录内。
- 如果未传 `entryPath`，自动选择第一个 `.model3.json`，否则选择 `model.json`。
- 入口文件必须存在。
- `modelPath` 返回 `/uploads/live2d/{uuid}/{entryPath}`。
- 第一条模型自动 `active = true`。
- `displayOrder` 默认等于当前模型数量。

错误响应示例：

```json
{
  "message": "No model.json or .model3.json file was found."
}
```

#### PUT `/api/admin/live2d-models/{id}`

请求：

```json
{
  "name": "模型名称",
  "switchable": true,
  "displayOrder": 0,
  "scale": 1.0,
  "offsetX": 0.0,
  "offsetY": 0.0,
  "volume": 0.0,
  "tipsEnabled": true,
  "welcomeMessages": "Welcome back!",
  "tipMessages": "Take a short break.\nRemember to save your ideas.",
  "tipDuration": 3500,
  "tipInterval": 9000,
  "tipOffsetX": 0,
  "tipOffsetY": 0,
  "typingEnabled": false,
  "typingParam": "PARAM_MOUTH_OPEN_Y",
  "typingSpeed": 120,
  "typingMinValue": 0.0,
  "typingMaxValue": 1.0
}
```

响应：更新后的模型对象。

#### PUT `/api/admin/live2d-models/{id}/activate`

响应：被激活的模型对象。

实现规则：

- 将所有模型 `active = false`。
- 将指定模型 `active = true`。
- 如果模型不存在返回 404。

#### DELETE `/api/admin/live2d-models/{id}`

成功状态码 `200`。

实现规则：

- 删除数据库记录。
- 删除 `{APP_UPLOAD_DIR}/live2d/{directory}` 目录。
- 目录删除失败时记录日志，接口仍可返回成功，但日志必须可追踪。

## 7. 数据库适配规范

### 7.1 MySQL 连接配置

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | Go 服务端口 |
| `MYSQL_HOST` | `127.0.0.1` | MySQL 地址 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_DATABASE` | `personal_website` | 数据库名 |
| `MYSQL_USERNAME` | `root` | 用户名 |
| `MYSQL_PASSWORD` | 空 | 密码 |
| `MYSQL_CHARSET` | `utf8mb4` | 字符集 |
| `JWT_SECRET` | 必填 | JWT 密钥，至少 32 字符 |
| `JWT_EXPIRATION` | `86400000` | token 过期时间，毫秒 |
| `APP_UPLOAD_DIR` | `uploads` | 上传文件根目录 |
| `CORS_ALLOWED_ORIGINS` | `*` | 允许跨域来源 |

推荐 DSN：

```text
${MYSQL_USERNAME}:${MYSQL_PASSWORD}@tcp(${MYSQL_HOST}:${MYSQL_PORT})/${MYSQL_DATABASE}?charset=utf8mb4&parseTime=true&loc=Local
```

如果兼容旧的 Spring 环境变量，也可以额外支持：

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
```

Go 端可以解析 JDBC URL，或在迁移期同时提供两套配置。

### 7.2 表结构兼容

建议保留以下表：

- `users`
- `articles`
- `projects`
- `skills`
- `feature_cards`
- `themes`
- `live2d_models`
- `live2d_settings`

当前 `init.sql` 中 `themes` 表与 Java 实体存在字段不完全一致的问题。Go 迁移时建议统一为 Java 实体实际使用字段：

```sql
CREATE TABLE IF NOT EXISTS themes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  preset_key VARCHAR(255),
  primary_color VARCHAR(50),
  secondary_color VARCHAR(50),
  accent_color VARCHAR(50),
  background VARCHAR(500),
  background_style VARCHAR(50),
  background_image VARCHAR(500),
  card_bg VARCHAR(100),
  text_primary VARCHAR(50),
  text_secondary VARCHAR(50),
  is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

如果旧库已经存在 `active`、`background_color` 等旧字段，建议执行迁移：

```sql
ALTER TABLE themes ADD COLUMN preset_key VARCHAR(255) NULL;
ALTER TABLE themes ADD COLUMN accent_color VARCHAR(50) NULL;
ALTER TABLE themes ADD COLUMN background VARCHAR(500) NULL;
ALTER TABLE themes ADD COLUMN background_style VARCHAR(50) NULL;
ALTER TABLE themes ADD COLUMN background_image VARCHAR(500) NULL;
ALTER TABLE themes ADD COLUMN card_bg VARCHAR(100) NULL;
ALTER TABLE themes ADD COLUMN text_primary VARCHAR(50) NULL;
ALTER TABLE themes ADD COLUMN text_secondary VARCHAR(50) NULL;
ALTER TABLE themes ADD COLUMN is_active TINYINT(1) DEFAULT 1;
```

### 7.3 自动迁移策略

开发环境可以启用 GORM `AutoMigrate`：

```go
db.AutoMigrate(
    &model.User{},
    &model.Article{},
    &model.Project{},
    &model.Skill{},
    &model.FeatureCard{},
    &model.Theme{},
    &model.Live2DModel{},
    &model.Live2DSettings{},
)
```

生产环境建议：

- 不依赖自动迁移做破坏性变更。
- 使用 `migrations/*.sql` 版本化迁移。
- 发布前先备份数据库。
- 新增字段优先允许为空或提供默认值。

### 7.4 初始化数据

Go 后端启动时可以执行轻量初始化：

- 如果 `users` 表为空，创建默认管理员。
- 如果 `live2d_settings` 表为空，创建默认设置。
- 不建议每次启动清空业务表。

默认管理员建议通过环境变量配置：

| 变量 | 默认值 |
| --- | --- |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` |
| `ADMIN_EMAIL` | `admin@example.com` |

生产环境首次启动后必须立即修改密码。

## 8. Live2D 适配规范

### 8.1 文件目录

上传根目录：

```text
{APP_UPLOAD_DIR}/live2d/{model_uuid}/
```

URL 根路径：

```text
/uploads/live2d/{model_uuid}/
```

模型入口：

```text
/uploads/live2d/{model_uuid}/xxx.model3.json
/uploads/live2d/{model_uuid}/model.json
```

### 8.2 前端 widget 适配

前端 `Live2DWidget.jsx` 会读取：

- `data.enabled`
- `data.settings`
- `data.models`
- 每个模型的 `modelPath`
- 每个模型的位姿、音量、tips、typing 字段

因此 Go 后端必须保持字段名完全一致。尤其注意：

- `modelPath` 不能返回本地文件路径，必须是浏览器可访问 URL。
- `thumbnailPath` 可以为空字符串。
- `welcomeMessages` 和 `tipMessages` 用换行分隔多条文案。
- `typingParam` 默认 `PARAM_MOUTH_OPEN_Y`。

### 8.3 缩略图选择规则

Go 后端扫描模型目录时，选择第一张图片作为 `thumbnailPath`：

优先级：

1. 文件路径包含 `preview`、`thumb`、`cover`、`icon`。
2. 非 `texture` 目录或文件。
3. 其他图片。

允许后缀：

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`

### 8.4 安全要求

- 上传模型时禁止路径穿越。
- 删除模型时只能删除 `{APP_UPLOAD_DIR}/live2d/{directory}` 下的目录。
- 不执行上传文件中的任何脚本。
- 不解析远程 URL 模型包，除非未来单独增加可信下载逻辑。
- 建议限制单次 Live2D 上传总大小，例如 200MB。

## 9. 文件上传与静态资源适配

Go 后端需要直接提供：

```text
/uploads/*
```

映射到：

```text
APP_UPLOAD_DIR
```

Gin 示例：

```go
r.Static("/uploads", cfg.UploadDir)
```

部署到 Nginx 时有两种方式：

方式一：Nginx 代理给 Go：

```nginx
location ^~ /uploads/ {
    proxy_pass http://127.0.0.1:8080;
}
```

方式二：Nginx 直接读取磁盘，性能更好：

```nginx
location ^~ /uploads/ {
    alias /opt/personal-website/uploads/;
    access_log off;
    expires 30d;
}
```

如果使用方式二，必须保证 Go 服务写入目录和 Nginx 读取目录是同一个目录。

## 10. 普通部署方案

### 10.1 构建前端

```bash
cd frontend
npm ci
npm run build
```

构建产物：

```text
frontend/dist
```

### 10.2 构建 Go 后端

```bash
cd go_back
go mod tidy
go build -ldflags="-s -w" -o personal-website-api ./cmd/server
```

Linux 交叉编译示例：

```bash
set GOOS=linux
set GOARCH=amd64
go build -ldflags="-s -w" -o personal-website-api ./cmd/server
```

### 10.3 服务器目录建议

```text
/opt/personal-website/
  api/personal-website-api
  frontend/dist/
  uploads/
  logs/
  .env
```

`.env` 示例：

```env
SERVER_PORT=8080
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=root
MYSQL_PASSWORD=your-password
JWT_SECRET=please-change-this-secret-key-at-least-32-chars
JWT_EXPIRATION=86400000
APP_UPLOAD_DIR=/opt/personal-website/uploads
GIN_MODE=release
```

### 10.4 systemd 服务

`/etc/systemd/system/personal-website-api.service`：

```ini
[Unit]
Description=Personal Website Go API
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/personal-website/api
EnvironmentFile=/opt/personal-website/.env
ExecStart=/opt/personal-website/api/personal-website-api
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable personal-website-api
sudo systemctl start personal-website-api
sudo systemctl status personal-website-api
```

### 10.5 Nginx 配置

```nginx
server {
    listen 3718;
    server_name your-domain.com;
    client_max_body_size 200m;

    root /opt/personal-website/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location ^~ /uploads/ {
        alias /opt/personal-website/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

部署检查：

```bash
curl http://127.0.0.1:8080/api/public/profile
curl http://127.0.0.1:3718/api/public/profile
```

## 11. Docker 部署方案

### 11.1 Go 后端 Dockerfile

建议在 `go_back/Dockerfile`：

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/personal-website-api ./cmd/server

FROM alpine:3.20

RUN adduser -D -H appuser && mkdir -p /app/uploads
WORKDIR /app
COPY --from=builder /out/personal-website-api /app/personal-website-api
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/public/profile >/dev/null || exit 1

CMD ["/app/personal-website-api"]
```

如果 Alpine 镜像中没有 `wget`，可安装：

```dockerfile
RUN apk add --no-cache wget
```

### 11.2 前后端分离 Docker Compose

推荐使用三个服务：

- `mysql`
- `api`
- `web`

示例：

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: personal-website-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: personal_website
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci

  api:
    build:
      context: ./go_back
      dockerfile: Dockerfile
    container_name: personal-website-api
    restart: unless-stopped
    depends_on:
      - mysql
    environment:
      SERVER_PORT: 8080
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_DATABASE: personal_website
      MYSQL_USERNAME: root
      MYSQL_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: 86400000
      APP_UPLOAD_DIR: /app/uploads
      GIN_MODE: release
    volumes:
      - ./uploads:/app/uploads
    expose:
      - "8080"

  web:
    image: nginx:1.27-alpine
    container_name: personal-website-web
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "3718:3718"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./uploads:/app/uploads:ro
      - ./docker/nginx-go.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  mysql_data:
```

### 11.3 Docker Nginx 配置

`docker/nginx-go.conf`：

```nginx
server {
    listen 3718;
    server_name localhost;
    client_max_body_size 200m;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location ^~ /uploads/ {
        alias /app/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

### 11.4 Docker 启动流程

```bash
cd personal-website
npm --prefix frontend ci
npm --prefix frontend run build
docker compose up -d --build
docker compose logs -f api
```

健康检查：

```bash
curl http://127.0.0.1:3718/api/public/profile
curl http://127.0.0.1:3718/api/public/live2d-model
```

### 11.5 兼容宝塔已有 MySQL

如果 MySQL 已经由宝塔安装在宿主机，可以不启动 Compose 的 `mysql` 服务。Linux Docker 中访问宿主机 MySQL 推荐：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
environment:
  MYSQL_HOST: host.docker.internal
```

不要依赖容器内的 `127.0.0.1` 连接宿主机 MySQL，除非使用 `network_mode: host`。

## 12. 迁移实施步骤

### 12.1 第一阶段：接口兼容实现

1. 建立 Go 项目目录和基础依赖。
2. 实现配置加载、数据库连接、统一错误响应。
3. 实现 `users` 登录和 JWT 中间件。
4. 实现公开接口，先保证首页、博客、项目页可用。
5. 实现管理端 CRUD。
6. 实现文章图片、主题背景、Live2D 上传。
7. 增加 `/uploads/**` 静态文件服务。

### 12.2 第二阶段：数据兼容验证

1. 备份当前 MySQL：

```bash
mysqldump -u root -p personal_website > personal_website_backup.sql
```

2. 在测试库导入备份。
3. 用 Go 服务连接测试库。
4. 验证公开页面接口。
5. 验证管理后台登录、编辑、上传、删除。
6. 验证 Live2D 模型加载。

### 12.3 第三阶段：切换生产

1. 停止 Java 后端。
2. 启动 Go 后端，监听同样的 `8080`。
3. Nginx 配置保持 `/api/` 和 `/uploads/` 代理不变。
4. 访问前端并验证核心页面。
5. 保留 Java 包和旧容器至少一个回滚周期。

回滚方式：

- 停止 Go 服务。
- 恢复 Java 服务。
- 如果 Go 迁移期间执行过数据库结构变更，先确认变更对 Java 是否兼容。

## 13. 验收清单

基础接口：

- `POST /api/auth/login` 能返回 token。
- 未带 token 访问 `/api/admin/articles` 返回 401。
- 带 token 访问 `/api/admin/articles` 返回分页数据。
- `/api/public/profile` 能返回前台资料。
- `/api/public/articles` 返回 Spring 兼容分页结构。

文件接口：

- 文章图片上传后 URL 可访问。
- 主题背景上传后 URL 可访问。
- `/uploads/**` 在普通部署和 Docker 部署中都可访问。

Live2D：

- 后台可上传完整模型目录。
- 后台可选择入口 `.model3.json` 或 `model.json`。
- 前台 `/api/public/live2d-model` 返回 `enabled/settings/models`。
- 浏览器能加载 `modelPath`。
- 多模型切换、休眠按钮、tips、typing 配置字段不报错。

部署：

- Go 二进制可通过 systemd 常驻。
- Docker Compose 可一键启动。
- 容器重启后上传文件不丢失。
- MySQL 数据卷不丢失。

安全：

- 管理端接口必须鉴权。
- 上传路径不能逃逸 `APP_UPLOAD_DIR`。
- 密码不在资料接口返回。
- `JWT_SECRET` 生产环境不使用默认值。

## 14. 后续优化建议

- 为 Go 后端增加 OpenAPI 文档，接口契约可自动生成。
- 为仓库增加一组 API 集成测试，覆盖公开接口、管理端鉴权、上传和 Live2D。
- 如果上传文件规模变大，可把 `storage` 层抽象成本地磁盘和对象存储两种实现。
- 如果访问量上升，可对公开接口增加短 TTL 缓存，例如 profile、skills、projects、theme。
- 将 `tags` 从逗号字符串升级为独立标签表，但这会影响当前前端和数据库结构，建议放到后续版本。
