SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS site_visits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    visitor_hash BINARY(32) NOT NULL,
    path VARCHAR(255) NOT NULL,
    page_title VARCHAR(120) NOT NULL DEFAULT '',
    referrer_host VARCHAR(190) NOT NULL DEFAULT '',
    device_type VARCHAR(12) NOT NULL DEFAULT '电脑',
    browser VARCHAR(32) NOT NULL DEFAULT '其他',
    operating_system VARCHAR(32) NOT NULL DEFAULT '其他',
    screen_width SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    visited_at DATETIME NOT NULL,
    INDEX idx_site_visits_time (visited_at),
    INDEX idx_site_visits_visitor_time (visitor_hash, visited_at),
    INDEX idx_site_visits_path_time (path(100), visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
