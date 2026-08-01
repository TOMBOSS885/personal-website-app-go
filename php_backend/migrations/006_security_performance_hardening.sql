SET NAMES utf8mb4;

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_account' AND COLUMN_NAME='session_version')=0,
    'ALTER TABLE admin_account ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER password_hash', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

CREATE TABLE IF NOT EXISTS admin_login_attempts (
    client_hash BINARY(32) NOT NULL PRIMARY KEY,
    failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_admin_login_attempts_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_unlock_attempts (
    article_id BIGINT UNSIGNED NOT NULL,
    client_hash BINARY(32) NOT NULL,
    failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (article_id, client_hash),
    INDEX idx_article_unlock_attempts_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_visit_dedup (
    visitor_hash BINARY(32) NOT NULL,
    path_hash BINARY(32) NOT NULL,
    last_visited_at DATETIME NOT NULL,
    PRIMARY KEY (visitor_hash, path_hash),
    INDEX idx_site_visit_dedup_time (last_visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_rate_limits (
    rate_key BINARY(32) NOT NULL,
    window_bucket INT UNSIGNED NOT NULL,
    request_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (rate_key, window_bucket),
    INDEX idx_analytics_rate_limits_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_report_cache (
    cache_key VARCHAR(64) NOT NULL PRIMARY KEY,
    payload MEDIUMTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_analytics_report_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    visitor_hash BINARY(32) NOT NULL,
    path VARCHAR(255) NOT NULL,
    page_title VARCHAR(120) NOT NULL DEFAULT '',
    referrer_host VARCHAR(190) NOT NULL DEFAULT '',
    device_type VARCHAR(12) NOT NULL DEFAULT 'computer',
    browser VARCHAR(32) NOT NULL DEFAULT 'other',
    operating_system VARCHAR(32) NOT NULL DEFAULT 'other',
    screen_width SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    visited_at DATETIME NOT NULL,
    INDEX idx_site_visits_time (visited_at),
    INDEX idx_site_visits_visitor_time (visitor_hash, visited_at),
    INDEX idx_site_visits_path_time (path(100), visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND INDEX_NAME='idx_site_visits_visitor_path_time')=0,
    'ALTER TABLE site_visits ADD INDEX idx_site_visits_visitor_path_time (visitor_hash, path(100), visited_at)', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
