# 数据备份与恢复说明

本文档用于说明这个个人博客网站在正式服务器上的数据备份和迁移恢复流程。

这个项目的数据不只存在 MySQL 数据库里。完整备份时建议保存：

- MySQL 数据库：`personal_website`
- 上传文件目录：`uploads/`
- 生产环境配置文件：`.env`
- 可选部署文件：`docker-compose.yml`、`Dockerfile`、`docker/`

如果项目源码已经托管在 GitHub、Gitee 或其他 Git 仓库中，通常只需要额外备份：

- 数据库
- `uploads/`
- `.env`

## 1. 必须备份哪些内容

### 1.1 MySQL 数据库

下面这些网站内容都保存在 MySQL 中：

- 博客文章
- 项目列表
- 技能列表
- 个人资料
- 主题配置
- Live2D 模型记录和配置
- 管理员用户数据

### 1.2 上传文件目录

项目的 `docker-compose.yml` 中有如下挂载配置：

```yaml
volumes:
  - ./uploads:/app/uploads
```

后端容器内使用 `/app/uploads` 保存上传文件，对应到服务器项目根目录下的 `uploads/`。

如果只恢复数据库但没有恢复 `uploads/`，数据库中虽然还有类似 `/uploads/live2d/...` 的路径，但实际文件不存在，Live2D 模型或其他上传资源就会加载失败。

### 1.3 `.env` 配置文件

`.env` 保存生产环境配置，例如：

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `JAVA_OPTS`

新服务器上可以重新创建 `.env`，但建议一起备份，避免迁移时填错配置。

## 2. 在旧服务器上创建备份

以下命令建议在项目根目录执行。

假设项目目录是：

```bash
cd /www/wwwroot/personal-website
```

创建备份目录：

```bash
mkdir -p backups
```

创建备份时间变量：

```bash
BACKUP_TIME=$(date +"%Y%m%d_%H%M%S")
```

### 2.1 导出 MySQL 数据库

使用宝塔 MySQL 中的数据库密码，或者 `.env` 中配置的数据库密码。

```bash
mysqldump -u root -p --default-character-set=utf8mb4 personal_website > backups/personal_website_${BACKUP_TIME}.sql
```

如果你使用的是单独的数据库用户，把 `root` 替换成你的数据库用户名：

```bash
mysqldump -u your_db_user -p --default-character-set=utf8mb4 personal_website > backups/personal_website_${BACKUP_TIME}.sql
```

检查 SQL 文件是否生成成功：

```bash
ls -lh backups/personal_website_${BACKUP_TIME}.sql
```

### 2.2 备份上传文件

```bash
tar -czf backups/uploads_${BACKUP_TIME}.tar.gz uploads
```

检查压缩包是否生成成功：

```bash
ls -lh backups/uploads_${BACKUP_TIME}.tar.gz
```

### 2.3 备份环境配置和部署文件

```bash
tar -czf backups/config_${BACKUP_TIME}.tar.gz .env docker-compose.yml Dockerfile docker
```

如果服务器上还没有 `.env`，可以先从 `.env.example` 创建：

```bash
cp .env.example .env
```

### 2.4 打包成一个完整备份文件

下面这个压缩包会包含数据库、上传文件和生产配置：

```bash
tar -czf backups/personal_website_full_${BACKUP_TIME}.tar.gz \
  backups/personal_website_${BACKUP_TIME}.sql \
  backups/uploads_${BACKUP_TIME}.tar.gz \
  backups/config_${BACKUP_TIME}.tar.gz
```

检查最终备份文件：

```bash
ls -lh backups/personal_website_full_${BACKUP_TIME}.tar.gz
```

建议把这个完整备份包下载到本地电脑，或者上传到其他安全存储位置。不要只放在同一台服务器上。

## 3. 在新服务器上恢复数据

### 3.1 准备项目代码

先拉取或上传项目源码：

```bash
git clone your_repo_url personal-website
cd personal-website
```

如果你没有使用 Git，也可以直接手动上传整个项目目录。

把完整备份包放到项目根目录，然后解压：

```bash
tar -xzf personal_website_full_YYYYMMDD_HHMMSS.tar.gz
```

解压配置文件：

```bash
tar -xzf backups/config_YYYYMMDD_HHMMSS.tar.gz
```

查看 `.env`：

```bash
cat .env
```

如果新服务器的数据库密码或用户名不一样，需要修改 `.env` 中的配置：

```env
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=your_new_mysql_password
```

### 3.2 创建数据库

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS personal_website DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

如果你想使用单独的数据库用户，可以进入 MySQL：

```bash
mysql -u root -p
```

然后执行：

```sql
CREATE USER IF NOT EXISTS 'personal_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON personal_website.* TO 'personal_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

再修改 `.env`：

```env
SPRING_DATASOURCE_USERNAME=personal_user
SPRING_DATASOURCE_PASSWORD=your_password
```

### 3.3 导入数据库

```bash
mysql -u root -p personal_website < backups/personal_website_YYYYMMDD_HHMMSS.sql
```

如果使用的是单独数据库用户：

```bash
mysql -u personal_user -p personal_website < backups/personal_website_YYYYMMDD_HHMMSS.sql
```

检查数据库表和管理员用户是否存在：

```bash
mysql -u root -p personal_website -e "SHOW TABLES;"
mysql -u root -p personal_website -e "SELECT id, username, role FROM users;"
```

### 3.4 恢复上传文件

在项目根目录执行：

```bash
tar -xzf backups/uploads_YYYYMMDD_HHMMSS.tar.gz
```

确认目录存在：

```bash
ls -lah uploads
```

如果 Docker 容器无法读取上传文件，可以修复权限：

```bash
chmod -R 755 uploads
```

## 4. 启动项目

重新构建并启动容器：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f web
```

检查公开接口是否正常：

```bash
curl http://127.0.0.1:3718/api/public/profile
```

打开后台登录页：

```text
http://your-domain/admin/login
```

## 5. 恢复完成后的检查清单

迁移完成后建议逐项检查：

- 首页可以正常打开。
- 管理后台可以登录。
- 博客文章存在。
- 项目列表存在。
- 技能列表存在。
- 个人资料正确。
- 主题配置正确。
- Live2D 模型配置存在。
- Live2D 文件或其他上传资源可以正常加载。

## 6. 手动备份脚本

可以在服务器项目根目录创建一个 `backup.sh`：

```bash
#!/usr/bin/env bash
set -e

PROJECT_DIR="/www/wwwroot/personal-website"
DB_NAME="personal_website"
DB_USER="root"
BACKUP_DIR="$PROJECT_DIR/backups"
BACKUP_TIME=$(date +"%Y%m%d_%H%M%S")

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

mysqldump -u "$DB_USER" -p --default-character-set=utf8mb4 "$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_${BACKUP_TIME}.sql"
tar -czf "$BACKUP_DIR/uploads_${BACKUP_TIME}.tar.gz" uploads
tar -czf "$BACKUP_DIR/config_${BACKUP_TIME}.tar.gz" .env docker-compose.yml Dockerfile docker

tar -czf "$BACKUP_DIR/personal_website_full_${BACKUP_TIME}.tar.gz" \
  "$BACKUP_DIR/${DB_NAME}_${BACKUP_TIME}.sql" \
  "$BACKUP_DIR/uploads_${BACKUP_TIME}.tar.gz" \
  "$BACKUP_DIR/config_${BACKUP_TIME}.tar.gz"

find "$BACKUP_DIR" -type f -name "*.sql" -mtime +14 -delete
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +14 -delete

echo "Backup created: $BACKUP_DIR/personal_website_full_${BACKUP_TIME}.tar.gz"
```

给脚本添加执行权限：

```bash
chmod +x backup.sh
```

手动执行备份：

```bash
./backup.sh
```

这个脚本会在执行时询问 MySQL 密码，适合手动备份。如果要做自动定时备份，建议使用 MySQL 配置文件，不要把数据库密码直接写进脚本。

## 7. 使用 Cron 自动定时备份

创建 MySQL 客户端配置文件：

```bash
nano ~/.my.cnf
```

写入：

```ini
[client]
user=root
password=your_mysql_password
default-character-set=utf8mb4
```

保护这个文件：

```bash
chmod 600 ~/.my.cnf
```

然后把 `backup.sh` 中的 `mysqldump` 命令改成：

```bash
mysqldump "$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_${BACKUP_TIME}.sql"
```

编辑定时任务：

```bash
crontab -e
```

例如每天凌晨 03:30 自动备份：

```cron
30 3 * * * /www/wwwroot/personal-website/backup.sh >> /www/wwwroot/personal-website/backups/backup.log 2>&1
```

## 8. 重要注意事项

- 恢复正式数据时不要执行 `init.sql`，它只适合首次初始化或故意重置数据。
- 不要把备份文件放在公网可以直接访问的位置。
- 不要把 `.env`、数据库 SQL 备份、完整备份包提交到 Git。
- 至少保存一份备份到服务器之外，例如本地电脑、网盘、对象存储或另一台机器。
- 真正依赖备份策略之前，建议至少做一次恢复测试。

## 9. 最简结论

这个博客网站完整迁移时，最少需要保存：

```text
personal_website 数据库
uploads/ 目录
.env 文件
```

只保存数据库不够，因为数据库里可能只保存了上传资源路径，实际文件在 `uploads/` 目录中。
