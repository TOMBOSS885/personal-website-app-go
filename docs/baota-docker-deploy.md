# Baota Docker Deployment

This project is adapted for Baota Panel's built-in MySQL service.
Docker runs the website container with Nginx, the built frontend, and the Go API.
The Go backend connects to Baota MySQL on the host machine.

## 1. Create the database in Baota

Open Baota Panel -> Databases -> MySQL -> Add database.

Recommended values:

- Database name: `personal_website`
- Username: `root` or a dedicated user created in Baota
- Password: use the password shown in Baota
- Character set: `utf8mb4`

If you use a dedicated user, replace `MYSQL_USERNAME` and `MYSQL_PASSWORD` in `.env`.

## 2. Import initial data

Use phpMyAdmin or Baota's database import tool to import `init.sql` into
`personal_website`.

The default admin account after importing `init.sql` is:

- Username: `admin`
- Password: `admin123`

Warning: `init.sql` truncates existing tables. Use it only for first deployment
or intentional reset. Change this password immediately after first login.

## 3. Create `.env`

On the server, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:

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
MYSQL_PASSWORD=your_baota_mysql_password

JWT_SECRET=change_to_a_random_secret_at_least_32_chars
JWT_EXPIRATION=86400000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_initial_admin_password
ADMIN_EMAIL=admin@example.com
ADMIN_RESET_PASSWORD=false

REDIS_ENABLED=true
REDIS_ADDR=127.0.0.1:6379
REDIS_PASSWORD=your_baota_redis_password
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

当前项目的 `docker-compose.yml` 使用 `network_mode: host`，连接宝塔本机 MySQL 时请优先使用 `MYSQL_HOST=127.0.0.1`。如果旧配置里写过 `MYSQL_HOST=host.docker.internal`，建议改回 `127.0.0.1`。

## 4. Start with Docker Compose

```bash
docker compose up -d --build
docker compose logs -f web
```

The app listens on host port `3718`.

## 5. Configure Baota reverse proxy

In Baota website settings, reverse proxy your domain to:

```text
http://127.0.0.1:3718
```

Then visit:

```text
https://your-domain/admin/login
```

## 6. Login troubleshooting

Check whether the backend can reach Baota MySQL:

```bash
docker compose logs -f web
```

Check whether the admin user exists:

```bash
mysql -uroot -p personal_website -e "SELECT id, username, role FROM users;"
```

Test the login API:

```bash
curl -X POST http://127.0.0.1:3718/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Success returns a JSON object containing `token`.
