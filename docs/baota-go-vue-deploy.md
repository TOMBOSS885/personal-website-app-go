# 宝塔面板部署 Go 后端 + Vue 前端指南

本文档说明如何在宝塔面板中以“前后端分离”的方式部署当前项目：

```text
Vue 前端：宝塔 HTML 项目 / Nginx
Go 后端：宝塔 Go 项目、Supervisor 或 systemd 常驻
MySQL：宝塔 MySQL
Nginx：/api 反向代理到 Go，/uploads 访问上传目录
```

推荐最终访问方式：

```text
https://你的域名/
https://你的域名/api/public/profile
```

Go 后端不需要直接暴露公网端口，建议只监听服务器本机，由 Nginx 代理访问。

## 1. 服务器准备

在宝塔中确认已安装：

- Nginx
- MySQL 8.0 或 5.7+
- Go 项目管理器，或 Supervisor 管理器

数据库建议：

```text
数据库名：personal_website
用户名：你的数据库用户
密码：你的数据库密码
字符集：utf8mb4
```

如果已经有 Java 版数据库，可以直接复用原数据库。Go 后端的表结构与当前项目保持兼容。

## 2. 本地构建前端

先构建 Live2D 本地包：

```bash
cd l2d-widget
npm install
npm run build
```

再构建前端：

```bash
cd ../frontend
npm install
npm run build
```

构建完成后，前端产物在：

```text
frontend/dist
```

目录结构应类似：

```text
frontend/dist/index.html
frontend/dist/assets/
```

部署时上传的是 `dist` 里面的内容，不是整个 `dist` 文件夹。

## 3. 本地构建 Go 后端

如果在 Linux 服务器本机上构建：

```bash
cd go_back
go mod tidy
go build -ldflags="-s -w" -o personal-website-api ./cmd/server
```

如果在 Windows 本地构建 Linux 服务器可运行版本：

```powershell
cd go_back
$env:GOOS="linux"
$env:GOARCH="amd64"
$env:CGO_ENABLED="0"
go build -ldflags="-s -w" -o personal-website-api ./cmd/server
```

最终上传：

```text
go_back/personal-website-api
```

## 4. 推荐服务器目录

建议在服务器中使用如下目录：

```text
/www/wwwroot/personal-website/
  web/
    index.html
    assets/
  api/
    personal-website-api
  uploads/
  logs/
```

创建目录：

```bash
mkdir -p /www/wwwroot/personal-website/web
mkdir -p /www/wwwroot/personal-website/api
mkdir -p /www/wwwroot/personal-website/uploads
mkdir -p /www/wwwroot/personal-website/logs
```

## 5. 宝塔创建 Vue 前端 HTML 项目

进入宝塔：

```text
网站 -> HTML项目 -> 添加项目
```

填写：

```text
项目名称：personal-website-web
域名：你的域名.com
根目录：/www/wwwroot/personal-website/web
```

然后将本地：

```text
frontend/dist/index.html
frontend/dist/assets/
```

上传到：

```text
/www/wwwroot/personal-website/web/
```

最终必须是：

```text
/www/wwwroot/personal-website/web/index.html
/www/wwwroot/personal-website/web/assets/
```

不要放成：

```text
/www/wwwroot/personal-website/web/dist/index.html
```

## 6. 上传 Go 后端

把构建好的后端文件上传到：

```text
/www/wwwroot/personal-website/api/personal-website-api
```

然后在宝塔终端执行：

```bash
chmod +x /www/wwwroot/personal-website/api/personal-website-api
```

## 7. Go 后端环境变量

Go 后端支持以下环境变量：

```env
SERVER_PORT=8080
GIN_MODE=release
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=你的数据库用户
MYSQL_PASSWORD=你的数据库密码
JWT_SECRET=至少32位的随机密钥
JWT_EXPIRATION=86400000
APP_UPLOAD_DIR=/www/wwwroot/personal-website/uploads
AUTO_MIGRATE=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_strong_password
ADMIN_EMAIL=admin@example.com
```

说明：

- `SERVER_PORT`：Go 后端监听端口。
- `MYSQL_HOST`：如果 MySQL 在同一台服务器，通常是 `127.0.0.1`。
- `JWT_SECRET`：生产环境必须改成随机长字符串，至少 32 位。
- `APP_UPLOAD_DIR`：文章图片、主题背景图、Live2D 模型的保存目录。
- `AUTO_MIGRATE=true`：启动时自动补齐表结构。
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`ADMIN_EMAIL`：仅在 `users` 表为空时创建默认管理员。

新库首次部署后，默认管理员为：

```text
用户名：admin
密码：你在 ADMIN_PASSWORD 中设置的强密码
```

第一次登录后台后，请立即修改密码。

## 8. 宝塔运行 Go 后端

### 8.1 使用宝塔 Go 项目管理器

进入：

```text
网站 -> Go项目 -> 添加项目
```

填写：

```text
项目名称：personal-website-api
执行文件：/www/wwwroot/personal-website/api/personal-website-api
运行目录：/www/wwwroot/personal-website/api
端口：8080
启动用户：www 或 root
```

在环境变量中填写：

```env
SERVER_PORT=8080
GIN_MODE=release
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=你的数据库用户
MYSQL_PASSWORD=你的数据库密码
JWT_SECRET=你的32位以上随机密钥
JWT_EXPIRATION=86400000
APP_UPLOAD_DIR=/www/wwwroot/personal-website/uploads
AUTO_MIGRATE=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_strong_password
ADMIN_EMAIL=admin@example.com
```

保存并启动项目。

### 8.2 使用 Supervisor 管理

如果不用 Go 项目管理器，可以用 Supervisor。

新建脚本：

```bash
/www/wwwroot/personal-website/api/start.sh
```

内容：

```bash
#!/bin/bash
export SERVER_PORT=8080
export GIN_MODE=release
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
export MYSQL_DATABASE=personal_website
export MYSQL_USERNAME=你的数据库用户
export MYSQL_PASSWORD=你的数据库密码
export JWT_SECRET=你的32位以上随机密钥
export JWT_EXPIRATION=86400000
export APP_UPLOAD_DIR=/www/wwwroot/personal-website/uploads
export AUTO_MIGRATE=true
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=replace_with_strong_password
export ADMIN_EMAIL=admin@example.com

cd /www/wwwroot/personal-website/api
exec ./personal-website-api
```

授权：

```bash
chmod +x /www/wwwroot/personal-website/api/start.sh
```

宝塔 Supervisor 中：

```text
名称：personal-website-api
运行目录：/www/wwwroot/personal-website/api
启动命令：/www/wwwroot/personal-website/api/start.sh
```

保存并启动。

## 9. 配置 Nginx 反向代理

进入宝塔：

```text
网站 -> HTML项目 -> 找到前端站点 -> 设置 -> 配置文件
```

核心配置参考：

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;

    root /www/wwwroot/personal-website/web;
    index index.html;

    client_max_body_size 200m;

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
        alias /www/wwwroot/personal-website/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

保存后，在宝塔中重载 Nginx。

配置说明：

- `try_files $uri $uri/ /index.html;` 用于支持 Vue history 路由。
- `/api/` 会代理到 Go 后端 `127.0.0.1:8080`。
- `/uploads/` 会直接读取上传目录，用于文章图片、主题背景、Live2D 模型。

## 10. 开放端口

宝塔安全和云服务器安全组建议只开放：

```text
80
443
宝塔面板端口
```

Go 后端的 `8080` 不建议开放公网，只给本机 Nginx 访问。

## 11. 申请 SSL

进入前端站点：

```text
设置 -> SSL -> Let's Encrypt
```

申请证书后开启：

```text
强制 HTTPS
```

前端代码应使用相对路径：

```text
/api/xxx
```

不要写死：

```text
http://服务器IP:8080/api/xxx
```

这样 HTTPS 下不会出现跨域或 Mixed Content 问题。

## 12. 部署后测试

先测试 Go 后端：

```bash
curl http://127.0.0.1:8080/api/public/profile
```

再测试 Nginx 代理：

```bash
curl http://127.0.0.1/api/public/profile
```

浏览器访问：

```text
https://你的域名/
https://你的域名/api/public/profile
https://你的域名/admin/login
```

如果是新数据库，默认登录：

```text
用户名：admin
密码：你在 ADMIN_PASSWORD 中设置的强密码
```

登录后马上修改密码。

## 13. 常见问题

### 13.1 首页能打开，刷新 `/admin/login` 404

原因：Nginx 没有配置 Vue history 路由。

检查：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 13.2 页面打开了，但数据加载失败

可能原因：

- Go 后端没有启动。
- `/api/` 反向代理没有配置。
- 数据库连接失败。

检查：

```bash
curl http://127.0.0.1:8080/api/public/profile
curl http://127.0.0.1/api/public/profile
```

### 13.3 后台登录失败

检查：

- `users` 表是否有管理员。
- `MYSQL_*` 配置是否连接到了正确数据库。
- 如果新库为空，确认 `AUTO_MIGRATE=true`。
- 默认管理员只会在 `users` 表为空时创建。

### 13.4 后台接口返回 401

可能原因：

- token 过期，重新登录。
- 修改了 `JWT_SECRET`，旧 token 全部失效。
- 请求没有带 `Authorization: Bearer <token>`。

### 13.5 图片或 Live2D 不显示

检查 Nginx：

```nginx
location ^~ /uploads/ {
    alias /www/wwwroot/personal-website/uploads/;
}
```

检查目录：

```bash
ls -la /www/wwwroot/personal-website/uploads
```

### 13.6 数据库连不上

检查：

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USERNAME
MYSQL_PASSWORD
```

如果 MySQL 是宝塔本机安装，通常：

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

## 14. 推荐部署结论

当前项目最稳的宝塔部署方式是：

```text
Vue dist -> 宝塔 HTML 项目
Go 后端 -> 宝塔 Go 项目或 Supervisor，监听 127.0.0.1:8080
Nginx -> /api 代理到 Go，/uploads 指向上传目录
MySQL -> 宝塔 MySQL
```

用户访问只需要：

```text
https://你的域名/
```

不需要暴露 Go 后端端口。
