SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS friend_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    url VARCHAR(500) NOT NULL,
    avatar_url VARCHAR(500) NOT NULL DEFAULT '',
    category VARCHAR(40) NOT NULL DEFAULT 'Blog',
    display_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_friend_links_enabled_order (enabled, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(40) NOT NULL,
    email VARCHAR(254) NOT NULL DEFAULT '',
    website VARCHAR(500) NOT NULL DEFAULT '',
    content VARCHAR(1200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    author_key BINARY(32) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    INDEX idx_guest_messages_public (status, deleted_at, created_at, id),
    INDEX idx_guest_messages_author_time (author_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guest_message_rate_limits (
    rate_key BINARY(32) NOT NULL,
    window_bucket BIGINT UNSIGNED NOT NULL,
    request_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (rate_key, window_bucket),
    INDEX idx_guest_message_rate_cleanup (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
