# 宝塔面板部署 MySQL + Redis 缓存限流指南

本文说明如何在宝塔面板中为当前 Go + React 个人网站启用 Redis，用于提升大量访问时的速度和稳定性。

Redis 在本项目中的作用：

- 缓存公开接口，减少 MySQL 查询压力。
- 限制异常访问频率，降低脚本刷接口的影响。
- 保存后台登录失败次数，降低暴力破解风险。
- 后台新增、修改、删除内容后自动清理公开接口缓存。

Redis 不是主数据库，MySQL 仍然保存正式数据。Redis 挂了以后，程序会尽量降级到内存限流或直接访问 MySQL。

## 1. 在宝塔中创建 MySQL 数据库

进入宝塔面板：

```text
数据库 -> MySQL -> 添加数据库
```

推荐填写：

```text
数据库名：personal_website
用户名：personal_website
密码：使用宝塔生成的强密码
字符集：utf8mb4
访问权限：本地服务器
```

创建后记下：

```text
MYSQL_DATABASE=personal_website
MYSQL_USERNAME=personal_website
MYSQL_PASSWORD=刚才生成的数据库密码
```

如果你使用宝塔默认 root 账号，也可以填写 root，但生产环境更推荐独立数据库用户。

## 2. 安装 Redis

进入宝塔面板：

```text
软件商店 -> 搜索 Redis -> 安装
```

安装完成后进入：

```text
软件商店 -> Redis -> 设置
```

建议检查：

```text
服务状态：运行中
监听地址：127.0.0.1
端口：6379
密码：设置一个强密码
持久化：可以开启 AOF
```

如果 Redis 只给本机网站使用，不要开放 `6379` 到公网。

服务器安全组和宝塔安全里只需要开放：

```text
80
443
宝塔面板端口
```

不需要开放：

```text
3306
6379
8080
```

## 3. 准备项目目录

假设项目放在：

```bash
/www/wwwroot/bb/personal-website
```

进入目录：

```bash
cd /www/wwwroot/bb/personal-website
```

如果是第一次部署：

```bash
git clone 你的仓库地址 personal-website
cd personal-website
git checkout back_go
```

如果已经部署过：

```bash
git checkout back_go
git pull
```

## 4. 创建或修改 `.env`

如果没有 `.env`：

```bash
cp .env.example .env
```

编辑：

```bash
vim .env
```

推荐配置：

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
MYSQL_USERNAME=personal_website
MYSQL_PASSWORD=你的宝塔数据库密码

JWT_SECRET=请改成至少32位随机字符串
JWT_EXPIRATION=86400000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成后台初始强密码
ADMIN_EMAIL=admin@example.com
ADMIN_RESET_PASSWORD=false

REDIS_ENABLED=true
REDIS_ADDR=127.0.0.1:6379
REDIS_PASSWORD=你的Redis密码
REDIS_DB=0

CACHE_ENABLED=true
CACHE_TTL_SECONDS=60
RATE_LIMIT_ENABLED=true
PUBLIC_RATE_LIMIT_PER_MINUTE=180
MUSIC_RATE_LIMIT_PER_MINUTE=90
MUSIC_STREAM_RATE_LIMIT_PER_MINUTE=240
LOGIN_LIMIT_MAX_FAILS=5
LOGIN_LIMIT_WINDOW_SECONDS=600
MEDIA_SIGN_SECRET=
MEDIA_URL_TTL_SECONDS=600
```

如果 Redis 没有设置密码：

```env
REDIS_PASSWORD=
```

但生产环境建议设置 Redis 密码。

## 5. 关键环境变量说明

| 变量 | 作用 | 推荐值 |
|---|---|---|
| `REDIS_ENABLED` | 是否启用 Redis | `true` |
| `REDIS_ADDR` | Redis 地址 | `127.0.0.1:6379` |
| `REDIS_PASSWORD` | Redis 密码 | 宝塔 Redis 密码 |
| `CACHE_ENABLED` | 是否启用公开接口缓存 | `true` |
| `CACHE_TTL_SECONDS` | 缓存时间 | `60` |
| `RATE_LIMIT_ENABLED` | 是否启用限流 | `true` |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | 普通公开接口每 IP 每分钟次数 | `180` |
| `MUSIC_RATE_LIMIT_PER_MINUTE` | 音乐列表接口每 IP 每分钟次数 | `90` |
| `MUSIC_STREAM_RATE_LIMIT_PER_MINUTE` | 音乐真实播放流每 IP 每分钟请求次数 | `240` |
| `LOGIN_LIMIT_MAX_FAILS` | 登录最多失败次数 | `5` |
| `LOGIN_LIMIT_WINDOW_SECONDS` | 登录失败锁定窗口 | `600` |
| `MEDIA_SIGN_SECRET` | 音乐播放链接签名密钥，留空时复用 `JWT_SECRET` | 留空或随机长字符串 |
| `MEDIA_URL_TTL_SECONDS` | 音乐签名播放链接有效期 | `600` |

如果访问量更大，可以先调高：

```env
PUBLIC_RATE_LIMIT_PER_MINUTE=300
MUSIC_RATE_LIMIT_PER_MINUTE=180
MUSIC_STREAM_RATE_LIMIT_PER_MINUTE=360
```

不要一开始调得过低，否则正常用户刷新页面也可能被限流。

## 6. Docker 重新部署

在项目目录执行：

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
docker image prune -f
docker builder prune -f
```

查看日志：

```bash
docker compose logs -f web
```

如果 Redis 正常，会看到类似：

```text
redis connected: 127.0.0.1:6379 db=0
```

如果 Redis 配错，会看到类似：

```text
redis disabled: cannot connect to 127.0.0.1:6379
```

这时网站仍会尽量启动，但缓存不会生效，需要检查 Redis 地址、端口和密码。

## 7. 验证 MySQL 和 Redis

检查普通健康接口：

```bash
curl http://127.0.0.1:3718/api/health
```

检查完整健康接口：

```bash
curl http://127.0.0.1:3718/api/health/full
```

正常返回中应包含：

```json
{
  "status": "up",
  "checks": {
    "http": "up",
    "database": "up",
    "uploads": "up",
    "redis": "up"
  }
}
```

检查缓存是否命中：

```bash
curl -I http://127.0.0.1:3718/api/public/profile
curl -I http://127.0.0.1:3718/api/public/profile
```

第二次请求理论上会更快。缓存主要用于降低数据库压力，是否显示 `X-Cache` 取决于响应头写入时机和代理行为，不作为唯一判断标准。

## 8. 宝塔反向代理

如果你使用 Docker 部署，网站容器默认对宿主机暴露：

```text
3718
```

宝塔网站反向代理填写：

```text
http://127.0.0.1:3718
```

Nginx 不需要直接代理 Redis。Redis 只给 Go 后端访问。

## 9. 常见问题

### 9.1 Redis 连接失败

检查：

```bash
redis-cli -h 127.0.0.1 -p 6379 -a 你的Redis密码 ping
```

正常返回：

```text
PONG
```

如果没有密码：

```bash
redis-cli -h 127.0.0.1 -p 6379 ping
```

### 9.2 Docker 里连接不上 Redis

当前项目 `docker-compose.yml` 使用 `network_mode: host`，所以容器访问宿主机 Redis 时使用：

```env
REDIS_ADDR=127.0.0.1:6379
```

如果你以后改成普通 Docker bridge 网络，则需要把 Redis 放进同一个 compose 网络，并使用：

```env
REDIS_ADDR=redis:6379
```

### 9.3 音乐直链打不开

这是正常的。当前版本会拦截：

```text
/uploads/music/...
```

前台播放器会使用后端返回的签名地址：

```text
/api/public/music/:id/stream?scope=public&expires=...&sign=...
```

这样每次真实播放音乐都会经过 Go 后端、Redis 限流和签名校验，不能再长期复制固定 mp3 地址批量下载。

### 9.4 后台修改后前台没有马上变化

本次实现已经在后台增删改成功后自动清理公开缓存。若仍看到旧内容，通常是浏览器缓存、Nginx 静态资源缓存或 CDN 缓存，需要刷新浏览器或清 CDN。

### 9.5 被限流了

如果返回：

```json
{"message":"too many requests, please try again later"}
```

说明同一 IP 请求太频繁。可以临时调高：

```env
PUBLIC_RATE_LIMIT_PER_MINUTE=300
MUSIC_RATE_LIMIT_PER_MINUTE=180
MUSIC_STREAM_RATE_LIMIT_PER_MINUTE=360
```

然后重启：

```bash
docker compose up -d
```

### 9.6 新数据库首次后台登录

新库首次启动时，Go 后端会根据 `.env` 创建管理员：

```text
用户名：ADMIN_USERNAME
密码：ADMIN_PASSWORD
```

登录后建议立刻到后台修改密码，并保持：

```env
ADMIN_RESET_PASSWORD=false
```

只有忘记密码时，才临时设置：

```env
ADMIN_RESET_PASSWORD=true
```

重启后重置成功，再改回 `false`。
