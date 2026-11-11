SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS webdav_backup_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    endpoint_url VARCHAR(1000) NOT NULL DEFAULT '',
    remote_path VARCHAR(255) NOT NULL DEFAULT 'personal-website',
    username VARCHAR(255) NOT NULL DEFAULT '',
    password_encrypted TEXT NULL,
    backup_password_encrypted TEXT NULL,
    cron_token_encrypted TEXT NULL,
    schedule_minutes INT UNSIGNED NOT NULL DEFAULT 1440,
    retention_count INT UNSIGNED NOT NULL DEFAULT 7,
    last_run_at DATETIME NULL,
    next_run_at DATETIME NULL,
    last_status VARCHAR(32) NOT NULL DEFAULT 'never',
    last_error VARCHAR(1000) NOT NULL DEFAULT '',
    last_remote_name VARCHAR(255) NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL,
    updated_by BIGINT UNSIGNED NULL,
    INDEX idx_webdav_backup_due (enabled, next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO webdav_backup_settings (id, updated_at)
SELECT 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM webdav_backup_settings WHERE id = 1);
