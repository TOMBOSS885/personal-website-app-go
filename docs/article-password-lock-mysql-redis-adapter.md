# Article Password Lock: MySQL + Redis Adapter

This feature uses both databases in different roles:

- MySQL is the source of truth. It stores whether an article is locked and the bcrypt password hash.
- Redis is optional acceleration. It stores public API cache, rate-limit counters, and buffered article view counters.

## MySQL Changes

The `articles` table needs two new columns:

```sql
ALTER TABLE articles
  ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN access_password_hash VARCHAR(255) NULL;
```

The rate-limit settings table also needs article unlock rule columns:

```sql
ALTER TABLE rate_limit_settings
  ADD COLUMN article_unlock_per_minute INT NOT NULL DEFAULT 30,
  ADD COLUMN article_unlock_max_failures INT NOT NULL DEFAULT 5,
  ADD COLUMN article_unlock_penalty_seconds INT NOT NULL DEFAULT 600;
```

If `AUTO_MIGRATE=true`, GORM will add these columns at startup.

If `AUTO_MIGRATE=false`, run the SQL above manually before deploying the new backend. Otherwise public article lists and article saves may fail because the backend expects the new columns to exist.

Password rules:

- The plaintext article password is never stored.
- `access_password_hash` stores a bcrypt hash only.
- When `is_locked=0`, `access_password_hash` should be empty or `NULL`.
- When `is_locked=1`, `access_password_hash` must contain a valid bcrypt hash.

Optional cleanup for unlocked articles:

```sql
UPDATE articles
SET access_password_hash = NULL
WHERE is_locked = 0;
```

## Redis Changes

Redis does not store article passwords or password hashes.

Redis is used for:

- public list cache, such as `/api/public/articles`;
- unlock request rate-limit counters;
- per-IP and per-article failed password lockout counters;
- article view buffering.

The public cache key schema was bumped to `cache:public:v2:*` so old cached article lists without `isLocked` will not be reused after deployment.

You can also clear old public cache manually:

```bash
redis-cli --scan --pattern 'cache:public:*' | xargs -r redis-cli del
```

Wrong password protection:

- `article:unlock:fail:{ip}:{articleId}` counts failed unlock attempts.
- `article:unlock:block:{ip}:{articleId}` blocks the same IP from trying the same article again for 10 minutes.
- The threshold and lock duration are configurable in the admin security panel.
- After the same IP triggers article password lockout enough times in one day, it is banned using the existing `DailyLimitTriggerThreshold` and `BanDays` settings.

If you need to manually clear one blocked IP/article pair:

```bash
redis-cli del 'article:unlock:fail:IP:ARTICLE_ID' 'article:unlock:block:IP:ARTICLE_ID'
```

If Redis is unavailable:

- article lock and password validation still work through MySQL;
- unlock rate limiting and wrong-password lockout fall back to in-memory limiting;
- article views still increment in fallback mode.

## Deployment Checklist

1. Back up MySQL.
2. If `AUTO_MIGRATE=false`, run the MySQL `ALTER TABLE` SQL above.
3. Deploy the new backend and frontend.
4. Optional: clear `cache:public:*` in Redis.
5. In admin article editor, enable password protection and set a password.
6. Visit the public article URL and verify that the first response has no `content` body until the correct password is submitted.
