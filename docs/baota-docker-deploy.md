# Baota Docker Deployment

This project is adapted for Baota Panel's built-in MySQL 5.7.x service.
Docker runs only the website container. The Spring Boot backend connects to
Baota MySQL on the host machine.

## 1. Create the database in Baota

Open Baota Panel -> Databases -> MySQL -> Add database.

Recommended values:

- Database name: `personal_website`
- Username: `root` or a dedicated user created in Baota
- Password: use the password shown in Baota
- Character set: `utf8mb4`

If you use a dedicated user, replace `SPRING_DATASOURCE_USERNAME` in `.env`.

## 2. Import initial data

Use phpMyAdmin or Baota's database import tool to import `init.sql` into
`personal_website`.

The default admin account after import is:

- Username: `admin`
- Password: `admin123`

Warning: `init.sql` truncates existing tables. Use it only for first deployment
or intentional reset.

## 3. Create `.env`

On the server, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:

```env
SPRING_DATASOURCE_URL=jdbc:mysql://127.0.0.1:3306/personal_website?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=your_baota_mysql_password
JWT_SECRET=change_to_a_random_secret_at_least_32_chars
JWT_EXPIRATION=86400000
JAVA_OPTS=-Xms256m -Xmx512m
```

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
