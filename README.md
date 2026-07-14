# 个人网站

这是一个前后端分离的个人网站项目，当前分支已经完成 Go 后端重构。项目由 React/Vite 前端、Go/Gin API、MySQL 数据库和本地集成的 Live2D 组件组成，支持普通部署和 Docker 部署。

## 技术栈

- 前端：React 18、Vite、TailwindCSS、Framer Motion、React Router
- 后端：Go、Gin、GORM、JWT、MySQL
- Live2D：`l2d-widget` 本地依赖，支持模型上传、启用、切换和显示参数配置
- 博客桌面版：`desktop` 目录，使用 Tauri 2、React 和 TypeScript，读取公开 API 并与网页端同步内容
- 桌面管理端：`desktop-admin` 目录，使用同一套 Go 管理 API
- 部署：Nginx、Docker、Docker Compose、Supervisor

## 主要功能

- 公开页面：个人简介、统计数据、技能、项目、Markdown/静态前端文章、主题、Live2D 展示
- 管理后台：文章、静态 HTML/CSS/JS 前端包、项目、技能、功能卡片、个人信息、主题、Live2D 模型、账号密码管理
- 文件上传：文章图片、主题背景图、Live2D 模型文件
- 数据初始化：首次启动时可自动创建管理员账号

## 目录结构

```text
personal-website/
├── frontend/              # React/Vite 前端
├── go_back/               # Go 后端
│   ├── cmd/server/         # 服务入口
│   └── internal/           # 配置、数据库、模型、仓储、接口、中间件
├── l2d-widget/             # Live2D 组件源码，本项目通过本地 file 依赖引用
├── desktop/               # 面向读者的公开博客桌面版
├── desktop-admin/         # 后台管理桌面端
├── docker/                 # Docker 运行时配置
│   ├── nginx.conf
│   └── supervisord.conf
├── docs/                   # 部署文档和截图
├── uploads/                # 上传文件目录，生产环境需要持久化
├── Dockerfile              # Go 后端 + 前端一体镜像
├── docker-compose.yml      # Docker Compose 配置
├── .env.example            # 环境变量模板
└── init.sql                # 可选数据库初始化脚本
```

## 环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

常用配置：

```env
SERVER_PORT=8080
SERVER_HOST=127.0.0.1
GIN_MODE=release
APP_UPLOAD_DIR=/app/uploads
AUTO_MIGRATE=true
CORS_ALLOWED_ORIGINS=

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=root
MYSQL_PASSWORD=replace_with_mysql_password
MYSQL_TIMEOUT=10s
MYSQL_READ_TIMEOUT=30s
MYSQL_WRITE_TIMEOUT=30s

JWT_SECRET=replace_with_a_random_secret_at_least_32_chars
JWT_EXPIRATION=86400000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_initial_admin_password
ADMIN_EMAIL=admin@example.com
ADMIN_RESET_PASSWORD=false
```

说明：

- `AUTO_MIGRATE=true` 时，Go 后端启动后会用 GORM 自动同步表结构。
- `SERVER_HOST=127.0.0.1` 适合 Docker 一体部署，避免 host 网络下直接暴露 Go API 的 `8080` 端口。
- `CORS_ALLOWED_ORIGINS` 为空表示只走同源访问；前后端分离到不同域名时再填写明确域名，多个域名用英文逗号分隔。
- `ADMIN_USERNAME` 不存在时会自动创建管理员。
- 如果管理员已存在但忘记密码，可以临时设置 `ADMIN_RESET_PASSWORD=true`，重启后会把该账号密码重置为 `ADMIN_PASSWORD`。重置成功后应改回 `false`。
- `JWT_SECRET` 只影响登录后的 token 签发和校验，不会影响数据库迁移或密码匹配。

## 本地开发

前置要求：

- Go 1.22+
- Node.js 18+
- MySQL 8.x

启动后端：

```bash
cd go_back
go mod download
go run ./cmd/server
```

启动前端：

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

访问地址：

- 前端：http://localhost:3000
- 管理后台：http://localhost:3000/admin
- 后端 API：http://localhost:8080

Windows 可以直接运行：

```bat
start.bat
```

Linux/macOS 可以运行：

```bash
chmod +x start.sh
./start.sh
```

## Docker 部署

Docker 镜像会依次构建：

1. `l2d-widget`
2. `frontend`
3. `go_back`
4. 运行时镜像中的 Nginx + Go API

首次部署：

```bash
cp .env.example .env
vim .env
docker compose build --no-cache
docker compose up -d
```

更新部署：

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

查看状态和日志：

```bash
docker compose ps
docker compose logs -f
docker exec personal-website-go tail -n 100 /var/log/supervisor/api.log
```

默认访问：

- 网站：http://服务器IP:3718
- API：http://服务器IP:3718/api

当前 Compose 使用 `network_mode: host`，适合连接宝塔面板本机 MySQL。此时 `.env` 中的 `MYSQL_HOST` 使用：

```env
MYSQL_HOST=127.0.0.1
```

如果旧 `.env` 里写的是 `MYSQL_HOST=host.docker.internal`，请改回 `127.0.0.1`。当前 Compose 已兼容这个旧写法，但服务器部署时仍建议直接使用 `127.0.0.1`，更清晰也更不容易受 Docker 网络解析影响。

不要使用 `docker compose down -v`，否则可能删除挂载卷数据。上传文件通过以下挂载持久化：

```yaml
volumes:
  - ./uploads:/app/uploads
  - ./logs:/var/log/supervisor
```

## 宝塔面板部署要点

推荐两种方式：

- Docker 一体部署：Docker 容器内运行前端 Nginx 和 Go API，宝塔只负责放行端口或做外层反向代理。
- 前后端分离部署：宝塔网站目录放 `frontend/dist`，Go 后端用进程守护运行，宝塔 Nginx 把 `/api/` 和 `/uploads/` 反向代理到 Go 后端。

Docker 方式更简单：

1. 在宝塔创建 MySQL 数据库，记录数据库名、用户名、密码。
2. 服务器进入项目目录，切换到 Go 后端分支。
3. 根据 `.env.example` 创建 `.env`。
4. 设置 `MYSQL_HOST=127.0.0.1`。
5. 执行 `docker compose build --no-cache && docker compose up -d`。
6. 放行 `3718` 端口，访问 `http://服务器IP:3718`。

如果使用域名访问，在宝塔网站的 Nginx 配置中反向代理到：

```nginx
location / {
    proxy_pass http://127.0.0.1:3718;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Live2D 模型通常较大，外层 Nginx 也需要增加：

```nginx
client_max_body_size 200m;
```

更完整的部署步骤见：

- `docs/baota-go-vue-deploy.md`
- `docs/docker-go-vue-deploy.md`
- `docs/baota-docker-deploy.md`
- `docs/static-frontend-article-guide.md`

## 数据库

主要表：

- `users`
- `articles`
- `projects`
- `skills`
- `feature_cards`
- `themes`
- `live2d_models`
- `live2d_settings`

管理员用户名、邮箱和 BCrypt 密码哈希保存在 `users` 表中。密码不会明文保存。

## API 约定

接口返回 JSON。为了兼容原前端，成功响应通常直接返回业务数据，不额外包一层 `success/data`。

登录成功：

```json
{
  "token": "jwt-token"
}
```

错误响应：

```json
{
  "message": "错误信息"
}
```

分页响应：

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

认证接口：

- `POST /api/auth/login`

公开接口：

- `GET /api/public/profile`
- `GET /api/public/stats`
- `GET /api/public/articles`
- `GET /api/public/articles/:id`
- `GET /api/public/projects`
- `GET /api/public/projects/featured`
- `GET /api/public/skills`
- `GET /api/public/feature-cards`
- `GET /api/public/theme`
- `GET /api/public/live2d-model`

后台接口需要 `Authorization: Bearer <token>`：

- `/api/admin/articles`
- `/api/admin/projects`
- `/api/admin/skills`
- `/api/admin/feature-cards`
- `/api/admin/profile`
- `/api/admin/theme`
- `/api/admin/live2d-models`
- `/api/admin/live2d-settings`
- `/api/admin/account/password`

## Live2D 上传要求

上传 Live2D 时应上传完整模型文件夹，至少包含入口文件：

```text
model.json
或
*.model3.json
```

常见结构：

```text
model/
  model.model3.json
  model.moc3
  model.physics3.json
  textures/
    texture_00.png
```

入口 JSON 引用到的贴图、动作、物理文件必须一起上传，并保持相对路径不变。

## 常用排查

数据库连接超时：

- Docker 连接宝塔本机 MySQL 时，确认 `network_mode: host` 已启用。
- `.env` 中使用 `MYSQL_HOST=127.0.0.1`。
- 宝塔安全组和服务器防火墙不要拦截本机 3306。

首次无法登录：

- 确认日志中没有数据库迁移错误。
- 确认 `users` 表存在管理员账号。
- 忘记密码时临时设置 `ADMIN_RESET_PASSWORD=true` 后重启。

主题或 Live2D 日志出现 `record not found`：

- 这通常表示数据库里还没有对应配置。
- 后台保存一次主题或 Live2D 设置后即可生成记录。

## 许可证

MIT License
