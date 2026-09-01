SET NAMES utf8mb4;

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='site_visits' AND COLUMN_NAME='transferred_bytes')=0,
    'ALTER TABLE site_visits ADD COLUMN transferred_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER screen_width', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

CREATE TABLE IF NOT EXISTS site_analytics_visitors (
    visitor_hash BINARY(32) NOT NULL PRIMARY KEY,
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    INDEX idx_site_analytics_visitors_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO site_analytics_visitors (visitor_hash, first_seen_at, last_seen_at)
SELECT visitor_hash, MIN(visited_at), MAX(visited_at)
FROM site_visits
GROUP BY visitor_hash
ON DUPLICATE KEY UPDATE
    first_seen_at = LEAST(first_seen_at, VALUES(first_seen_at)),
    last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at));

CREATE TABLE IF NOT EXISTS site_analytics_totals (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    total_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_visitors BIGINT UNSIGNED NOT NULL DEFAULT 0,
    estimated_transfer_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO site_analytics_totals (id, total_views, total_visitors, estimated_transfer_bytes, updated_at)
SELECT 1, COUNT(*), COUNT(DISTINCT visitor_hash), COALESCE(SUM(transferred_bytes), 0), NOW()
FROM site_visits
ON DUPLICATE KEY UPDATE
    total_views = GREATEST(total_views, VALUES(total_views)),
    total_visitors = GREATEST(total_visitors, VALUES(total_visitors)),
    estimated_transfer_bytes = GREATEST(estimated_transfer_bytes, VALUES(estimated_transfer_bytes)),
    updated_at = NOW();
