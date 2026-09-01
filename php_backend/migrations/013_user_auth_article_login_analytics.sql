-- User authentication, login-gated articles, and authenticated analytics.
-- Safe to run after migrations 001-012.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS user_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_user_accounts_locked (locked_until),
    INDEX idx_user_accounts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='login_required')=0,
    'ALTER TABLE articles ADD COLUMN login_required TINYINT(1) NOT NULL DEFAULT 0 AFTER published', 'SELECT 1');
PREPARE add_article_login_required FROM @sql; EXECUTE add_article_login_required; DEALLOCATE PREPARE add_article_login_required;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND COLUMN_NAME='user_id')=0,
    'ALTER TABLE site_visits ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER visitor_hash', 'SELECT 1');
PREPARE add_visit_user_id FROM @sql; EXECUTE add_visit_user_id; DEALLOCATE PREPARE add_visit_user_id;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND COLUMN_NAME='user_email')=0,
    'ALTER TABLE site_visits ADD COLUMN user_email VARCHAR(254) NOT NULL DEFAULT '''' AFTER user_id', 'SELECT 1');
PREPARE add_visit_user_email FROM @sql; EXECUTE add_visit_user_email; DEALLOCATE PREPARE add_visit_user_email;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND COLUMN_NAME='is_authenticated')=0,
    'ALTER TABLE site_visits ADD COLUMN is_authenticated TINYINT(1) NOT NULL DEFAULT 0 AFTER user_email', 'SELECT 1');
PREPARE add_visit_authenticated FROM @sql; EXECUTE add_visit_authenticated; DEALLOCATE PREPARE add_visit_authenticated;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND INDEX_NAME='idx_site_visits_user_time')=0,
    'ALTER TABLE site_visits ADD INDEX idx_site_visits_user_time (user_id, visited_at)', 'SELECT 1');
PREPARE add_visit_user_index FROM @sql; EXECUTE add_visit_user_index; DEALLOCATE PREPARE add_visit_user_index;

ALTER TABLE site_visits MODIFY user_email VARCHAR(254) NOT NULL DEFAULT '';
