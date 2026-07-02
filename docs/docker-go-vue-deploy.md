# Docker 部署 Go 后端 + Vue 前端指南

本文档说明如何从 Git 仓库开始，用 Docker Compose 部署当前项目。当前 Docker 方案会构建一个完整镜像：

```text
Nginx：提供 Vue 前端静态文件，监听容器内 3718
Go API：监听容器内 8080
uploads：挂载到宿主机 ./uploads
MySQL：默认使用宿主机或宝塔已有 MySQL
```

访问链路：

```text
浏览器 -> 服务器:3718 -> 容器 Nginx
容器 Nginx /api -> 容器内 Go API 127.0.0.1:8080
容器 Nginx /uploads -> 容器内 /app/uploads
```

## 1. 服务器准备

服务器需要安装：

- Git
- Docker
- Docker Compose
- MySQL，推荐使用宝塔已有 MySQL 或服务器宿主机 MySQL

检查：

```bash
git --version
docker --version
docker compose version
```

如果使用宝塔面板，确保安全组和宝塔防火墙放行：

```text
3718
```

如果后续用 Nginx/域名反代到 `3718`，则公网只需要放行：

```text
80
443
宝塔面板端口
```

## 2. 准备数据库

在宝塔 MySQL 中创建数据库：

```text
数据库名：personal_website
用户名：你的数据库用户
密码：你的数据库密码
字符集：utf8mb4
```

如果是从旧 Java 后端迁移，可以直接复用原数据库。

如果是全新数据库，Go 后端启动后会在 `users` 表为空时创建默认管理员：

```text
用户名：admin
密码：admin123
```

首次登录后请立即修改密码。

## 3. 从 Git 拉取代码

进入部署目录：

```bash
cd /www/wwwroot
```

克隆仓库：

```bash
git clone 你的仓库地址 personal-website
cd personal-website
```

如果你要部署当前 Go 分支：

```bash
git branch
git checkout back_go
```

如果远程分支名不同，先查看远程分支：

```bash
git branch -a
```

然后切换：

```bash
git checkout 你的Go后端分支名
```

## 4. 创建 `.env`

在项目根目录创建：

```bash
cp .env.example .env
```

如果 `.env.example` 还是旧 Java 配置，可以直接编辑 `.env` 为下面内容：

```env
WEB_PORT=3718

MYSQL_HOST=host.docker.internal
MYSQL_PORT=3306
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=你的数据库用户
MYSQL_PASSWORD=你的数据库密码

JWT_SECRET=请改成至少32位的随机字符串
JWT_EXPIRATION=86400000

AUTO_MIGRATE=true
CORS_ALLOWED_ORIGINS=*

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
ADMIN_RESET_PASSWORD=false
```

说明：

- `WEB_PORT=3718`：宿主机访问端口。
- `MYSQL_HOST=host.docker.internal`：容器访问宿主机 MySQL。
- `MYSQL_PASSWORD`：必须填写。
- `JWT_SECRET`：必须修改，至少 32 位。
- `AUTO_MIGRATE=true`：启动时自动补齐表结构。
- `ADMIN_*`：仅在 `users` 表为空时用于创建默认管理员。
- `ADMIN_RESET_PASSWORD=true`：当 `ADMIN_USERNAME` 已存在时，启动时强制把该用户密码重置为 `ADMIN_PASSWORD`。只建议临时使用一次。

生成随机 `JWT_SECRET`：

```bash
openssl rand -base64 48
```

## 5. 确认 MySQL 允许容器连接

当前 `docker-compose.yml` 默认使用：

```text
MYSQL_HOST=host.docker.internal
```

Linux Docker 会通过：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

把 `host.docker.internal` 指向宿主机。

如果 MySQL 是宝塔安装在宿主机，通常可用。如果连接失败，检查：

1. MySQL 是否监听 `127.0.0.1` 或宿主机网关。
2. 数据库用户是否允许从容器网段访问。
3. 宝塔安全策略是否限制了 MySQL 连接。

如果宿主机 MySQL 只允许本机 `localhost`，可以把 Compose 改成 host 网络模式，或者给 MySQL 用户授权容器网段访问。

MySQL 授权示例：

```sql
CREATE USER 'personal_user'@'%' IDENTIFIED BY '你的数据库密码';
GRANT ALL PRIVILEGES ON personal_website.* TO 'personal_user'@'%';
FLUSH PRIVILEGES;
```

生产环境更推荐限制来源网段，而不是永久使用 `%`。

## 6. 构建并启动

在项目根目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f web
```

查看容器状态：

```bash
docker compose ps
```

正常应看到：

```text
personal-website-go   Up
```

## 7. 访问测试

测试前端：

```text
http://服务器IP:3718/
```

测试 API：

```bash
curl http://127.0.0.1:3718/api/public/profile
```

测试上传目录代理：

```bash
curl -I http://127.0.0.1:3718/uploads/
```

后台登录：

```text
http://服务器IP:3718/admin/login
```

如果是新数据库：

```text
用户名：admin
密码：admin123
```

登录后立即修改密码。

## 8. 使用域名访问

如果希望用域名访问，不建议用户直接记 `:3718`。推荐在宝塔 Nginx 中新建一个站点，将域名反代到 Docker 服务：

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3718;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

保存后重载 Nginx。

然后申请 SSL：

```text
宝塔 -> 网站 -> SSL -> Let's Encrypt -> 申请证书 -> 强制 HTTPS
```

最终访问：

```text
https://你的域名/
```

## 9. 更新部署

以后更新代码：

```bash
cd /www/wwwroot/personal-website
git pull
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f web
```

如果只改了 `.env`，不一定需要重新 build：

```bash
docker compose up -d
```

## 10. 停止、重启、删除

停止：

```bash
docker compose stop
```

启动：

```bash
docker compose start
```

重启：

```bash
docker compose restart
```

删除容器但保留上传文件：

```bash
docker compose down
```

注意：上传文件在宿主机：

```text
./uploads
```

日志在：

```text
./logs
```

只要不删除这些目录，上传文件和日志不会丢。

## 11. 目录和数据持久化

当前 Compose 挂载：

```yaml
volumes:
  - ./uploads:/app/uploads
  - ./logs:/var/log/supervisor
```

含义：

- 容器内 `/app/uploads` 对应宿主机 `./uploads`。
- 容器内日志目录对应宿主机 `./logs`。

文章图片、主题背景图、Live2D 模型都保存在：

```text
/www/wwwroot/personal-website/uploads
```

## 12. 常见问题

### 12.1 `Set MYSQL_PASSWORD in .env`

说明 `.env` 里没有设置：

```env
MYSQL_PASSWORD=你的数据库密码
```

补上后执行：

```bash
docker compose up -d
```

### 12.2 `Set JWT_SECRET in .env`

说明 `.env` 里没有设置：

```env
JWT_SECRET=至少32位的随机字符串
```

补上后执行：

```bash
docker compose up -d
```

### 12.3 数据库连接失败

查看日志：

```bash
docker compose logs -f web
```

常见原因：

- `MYSQL_HOST` 不对。
- `MYSQL_USERNAME` 或 `MYSQL_PASSWORD` 错。
- MySQL 用户不允许容器访问。
- 宝塔 MySQL 未启动。

如果使用宿主机 MySQL，优先尝试：

```env
MYSQL_HOST=host.docker.internal
```

### 12.4 页面能打开，接口失败

测试：

```bash
curl http://127.0.0.1:3718/api/public/profile
```

如果失败，看容器日志：

```bash
docker compose logs -f web
```

### 12.5 后台登录失败

检查：

- 数据库 `users` 表是否为空。
- `AUTO_MIGRATE=true` 是否开启。
- 默认管理员会在 `ADMIN_USERNAME` 不存在时创建。
- 如果已有旧用户，使用旧用户登录。

如果数据库里已经有 `admin` 用户，但密码不是 `admin123`，可以临时重置一次：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_RESET_PASSWORD=true
```

然后执行：

```bash
docker compose up -d
docker compose logs -f web
```

看到类似日志后：

```text
reset password for admin user "admin" because ADMIN_RESET_PASSWORD=true
```

登录成功后，立刻把 `.env` 改回：

```env
ADMIN_RESET_PASSWORD=false
```

再重启：

```bash
docker compose up -d
```

### 12.6 上传图片或 Live2D 不显示

检查宿主机目录是否存在：

```bash
ls -la uploads
```

检查容器内目录：

```bash
docker exec -it personal-website-go sh
ls -la /app/uploads
```

检查 Nginx 是否能访问：

```bash
curl -I http://127.0.0.1:3718/uploads/
```

### 12.7 Docker 构建前端失败

Dockerfile 会先构建 `l2d-widget`，再构建 `frontend`。如果失败，通常是 npm 网络问题。

可以尝试在服务器配置 npm 镜像，或临时使用代理。也可以先在本地构建镜像再推送到服务器。

## 13. 可选：使用 Docker 内置 MySQL

当前配置默认使用宝塔/宿主机 MySQL。如果想让 Docker Compose 同时启动 MySQL，可增加一个 `mysql` 服务，并把 `MYSQL_HOST` 改为 `mysql`。

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
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci

  web:
    environment:
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_DATABASE: personal_website
      MYSQL_USERNAME: root
      MYSQL_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    depends_on:
      - mysql

volumes:
  mysql_data:
```

这种方式数据库也在 Docker 中，适合全容器化部署；但如果你已经用宝塔管理 MySQL，继续用宝塔 MySQL 会更直观。

## 14. 推荐部署结论

如果你已经有宝塔 MySQL：

```text
代码：git clone / git pull
前端 + Go 后端：docker compose up -d --build
数据库：宝塔 MySQL
公网访问：服务器IP:3718 或 宝塔 Nginx 域名反代到 127.0.0.1:3718
上传文件：宿主机 ./uploads
日志：宿主机 ./logs
```

最短启动命令：

```bash
cd /www/wwwroot/personal-website
cp .env.example .env
vim .env
docker compose up -d --build
```
