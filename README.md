# 个人网站

一个现代化个人主页与内容管理系统，使用 **React + Spring Boot + Java 21 + MySQL** 构建。

本项目已经整合两个项目能力：

- `personal-website`：个人主页、博客、项目展示、技能展示、主题与后台管理。
- `l2d-widget`：Live2D 网页形象挂件，用于在前台展示可交互 Live2D 角色，并支持后台上传、切换和高级配置。

## 技术栈

### 前端

- React 18
- Vite
- TailwindCSS
- Framer Motion
- React Router
- l2d-widget

### 后端

- Java 21
- Spring Boot 3.2
- Spring Security
- JWT Authentication
- Spring Data JPA
- MySQL 8.x

### 部署

- Docker
- Docker Compose
- Nginx
- Supervisor

## 功能特性

### 用户端

- 首页展示：个人简介、技能、精选项目、最新文章
- 博客文章：支持 Markdown
- 项目展示
- 响应式布局
- 主题色动态应用
- Live2D 形象展示
- Live2D 多模型菜单切换
- Live2D 气泡提示、打字动画、嘴型同步

### 管理后台

- 数据概览
- 文章管理
- 项目管理
- 技能管理
- 主题管理
- 个人信息管理
- Live2D 管理

## Live2D 整合说明

项目内置并整合了 `l2d-widget`，目录位于：

```text
l2d-widget/
```

前端通过本地依赖引用：

```json
"l2d-widget": "file:../l2d-widget"
```

Docker 构建时会先构建 `l2d-widget`，再构建前端项目。因此服务器部署时必须保留根目录下的 `l2d-widget/` 文件夹。

### Live2D 后台能力

后台入口：

```text
/admin/live2d
```

支持：

- 上传完整 Live2D 模型文件夹
- 自动识别 `model.json` 或 `.model3.json`
- 从上传文件中自动查找缩略图
- 设置默认模型
- 设置模型是否加入前台多模型切换
- 设置模型排序
- 调整模型缩放、X/Y 偏移、音量
- 设置欢迎语和循环气泡文字
- 设置气泡显示时长、循环间隔、气泡偏移
- 启用打字动画
- 设置嘴型同步参数，例如 `PARAM_MOUTH_OPEN_Y`
- 设置嘴型最小值、最大值、打字速度
- 全局启用/关闭 Live2D
- 设置前台位置：左下角 / 右下角
- 设置画布尺寸
- 设置主题颜色
- 设置入场/退场动画：滑入 / 淡入
- 控制菜单方向
- 控制休眠按钮和关于按钮是否显示

### 上传模型要求

请上传完整 Live2D 模型文件夹，不要只上传单个文件。

支持入口文件：

```text
model.json
.model3.json
```

常见 Cubism 3 模型结构：

```text
xiaoyue/
  xiaoyue.model3.json
  xiaoyue.moc3
  xiaoyue.physics3.json
  xiaoyue.cdi3.json
  xiaoyue.8192/
    texture_00.png
```

入口 JSON 中引用到的贴图、动作、物理文件等必须一起上传，并保持相对路径不变。

### 上传文件保存位置

上传后的 Live2D 文件保存在服务器项目目录：

```text
uploads/live2d/
```

Docker 容器内对应路径：

```text
/app/uploads/live2d/
```

`docker-compose.yml` 中已挂载：

```yaml
volumes:
  - ./uploads:/app/uploads
```

因此容器重建不会删除已上传模型。

### 上传大小限制

Live2D 模型贴图通常较大，本项目已在 Docker 内 Nginx 配置：

```nginx
client_max_body_size 200m;
```

如果服务器外层还有宝塔 Nginx 或其他反向代理，也需要在外层站点配置的 `server {}` 中加入：

```nginx
client_max_body_size 200m;
```

否则大模型可能在到达 Docker 容器前就被拦截。

## 快速开始

### 前置要求

- Java 21+
- Node.js 18+
- Maven 3.8+
- MySQL 8.0+

### Windows 一键启动

```bash
start.bat
```

### Linux / macOS 一键启动

```bash
chmod +x start.sh
./start.sh
```

### 手动启动

启动后端：

```bash
cd backend
mvn spring-boot:run
```

启动前端：

```bash
cd frontend
npm install
npm run dev
```

如需本地开发 `l2d-widget`：

```bash
cd l2d-widget
npm install --legacy-peer-deps
npm run build
```

## 访问地址

- 前端展示页：http://localhost:3000
- 管理后台：http://localhost:3000/admin
- 后端 API：http://localhost:8080

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

## 项目结构

```text
personal-website/
├── backend/                # Spring Boot 后端
├── frontend/               # React 前端
├── l2d-widget/             # 已整合的 Live2D widget 项目
├── docs/                   # 文档与截图
│   └── screenshots/        # 页面截图预览
├── docker/                 # Docker 配置
│   ├── nginx.conf          # Nginx 配置
│   └── supervisord.conf    # Supervisor 配置
├── uploads/                # 上传文件目录，部署后自动生成
│   └── live2d/             # Live2D 模型文件
├── Dockerfile              # Docker 镜像构建文件
├── docker-compose.yml      # Docker Compose 配置
├── init.sql                # MySQL 初始化脚本
├── start.bat               # Windows 启动脚本
├── start-full.bat          # Windows 完整启动脚本
├── start.sh                # Linux/macOS 启动脚本
└── README.md
```

## 数据库

使用 MySQL 作为持久化数据库。

主要业务表包括：

- `users`
- `articles`
- `projects`
- `skills`
- `themes`
- `live2d_models`
- `live2d_settings`

后端默认使用 JPA 自动更新表结构：

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update
```

## Docker 部署

### 首次部署

```bash
docker compose up -d --build
```

### 更新部署

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

硬盘空间有限时，可以在更新后清理旧镜像和构建缓存：

```bash
docker image prune -f
docker builder prune -f
```

不要使用：

```bash
docker compose down -v
```

避免误删持久化数据。

### 查看日志

```bash
docker compose logs -f
```

### 数据持久化

Docker 部署时：

- `./logs` 保存日志
- `./uploads` 保存上传文件
- MySQL 数据保存在外部 MySQL 服务中

## 环境变量

常用环境变量：

```env
SPRING_DATASOURCE_URL=jdbc:mysql://127.0.0.1:3306/personal_website?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=your_password
JWT_SECRET=please-change-this-secret-key-at-least-32-chars
JWT_EXPIRATION=86400000
APP_UPLOAD_DIR=/app/uploads
```

本地开发默认上传目录为：

```text
uploads/
```

生产 Docker 默认上传目录为：

```text
/app/uploads
```

## 截图预览

截图位于：

```text
docs/screenshots/
```

包括首页、博客、项目页、后台登录、文章管理、项目管理、技能管理、主题管理和个人信息管理等页面。

## 许可证

MIT License
