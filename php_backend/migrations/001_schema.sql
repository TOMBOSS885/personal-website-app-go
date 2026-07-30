SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS admin_account (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_profile (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL DEFAULT '站长',
    avatar VARCHAR(500) NOT NULL DEFAULT '',
    bio VARCHAR(1000) NOT NULL DEFAULT '',
    bio_en VARCHAR(1000) NOT NULL DEFAULT '',
    location VARCHAR(255) NOT NULL DEFAULT '',
    website VARCHAR(255) NOT NULL DEFAULT '',
    github VARCHAR(255) NOT NULL DEFAULT '',
    twitter VARCHAR(255) NOT NULL DEFAULT '',
    linkedin VARCHAR(255) NOT NULL DEFAULT '',
    email_public VARCHAR(255) NOT NULL DEFAULT '',
    tags VARCHAR(500) NOT NULL DEFAULT '',
    tags_en VARCHAR(500) NOT NULL DEFAULT '',
    welcome_text VARCHAR(255) NOT NULL DEFAULT '',
    welcome_text_en VARCHAR(255) NOT NULL DEFAULT '',
    cta_title VARCHAR(255) NOT NULL DEFAULT '',
    cta_title_en VARCHAR(255) NOT NULL DEFAULT '',
    cta_description VARCHAR(1000) NOT NULL DEFAULT '',
    cta_description_en VARCHAR(1000) NOT NULL DEFAULT '',
    coffee_count INT NOT NULL DEFAULT 0,
    stars_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(1000) NOT NULL DEFAULT '',
    content MEDIUMTEXT NOT NULL,
    cover_image VARCHAR(500) NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT '',
    tags VARCHAR(500) NOT NULL DEFAULT '',
    views INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 0,
    content_type VARCHAR(20) NOT NULL DEFAULT 'markdown',
    static_site_key VARCHAR(64) NULL,
    static_site_name VARCHAR(255) NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    access_password_hash VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_articles_published_created (published, created_at),
    INDEX idx_articles_category (category),
    INDEX idx_articles_content_type (content_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    cover_image VARCHAR(500) NOT NULL DEFAULT '',
    tech_stack VARCHAR(500) NOT NULL DEFAULT '',
    github_url VARCHAR(500) NOT NULL DEFAULT '',
    demo_url VARCHAR(500) NOT NULL DEFAULT '',
    stars INT NOT NULL DEFAULT 0,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_projects_featured_order (featured, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skills (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT '',
    proficiency INT NOT NULL DEFAULT 0,
    icon VARCHAR(500) NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_cards (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL DEFAULT '',
    description VARCHAR(1000) NOT NULL DEFAULT '',
    description_en VARCHAR(1000) NOT NULL DEFAULT '',
    icon VARCHAR(100) NOT NULL DEFAULT 'Code',
    gradient VARCHAR(100) NOT NULL DEFAULT 'from-indigo-500 to-purple-500',
    display_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS themes (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    preset_key VARCHAR(100) NOT NULL DEFAULT 'purple-pink',
    primary_color VARCHAR(50) NOT NULL DEFAULT '#6366f1',
    secondary_color VARCHAR(50) NOT NULL DEFAULT '#a855f7',
    accent_color VARCHAR(50) NOT NULL DEFAULT '#ec4899',
    background VARCHAR(500) NOT NULL DEFAULT '',
    background_style VARCHAR(50) NOT NULL DEFAULT 'gradient',
    background_image VARCHAR(500) NOT NULL DEFAULT '',
    background_size VARCHAR(50) NOT NULL DEFAULT 'cover',
    background_position VARCHAR(50) NOT NULL DEFAULT 'center',
    background_repeat VARCHAR(50) NOT NULL DEFAULT 'no-repeat',
    card_bg VARCHAR(100) NOT NULL DEFAULT '',
    text_primary VARCHAR(50) NOT NULL DEFAULT '',
    text_secondary VARCHAR(50) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS live2d_settings (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    position VARCHAR(50) NOT NULL DEFAULT 'bottom-right',
    size INT NOT NULL DEFAULT 280,
    primary_color VARCHAR(100) NOT NULL DEFAULT 'rgba(96,165,250,0.92)',
    transition_type VARCHAR(50) NOT NULL DEFAULT 'slide',
    transition_duration INT NOT NULL DEFAULT 1500,
    menu_align VARCHAR(50) NOT NULL DEFAULT 'right',
    show_sleep_button TINYINT(1) NOT NULL DEFAULT 1,
    show_about_button TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS live2d_models (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    model_path VARCHAR(1000) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 0,
    scale DECIMAL(8,3) NOT NULL DEFAULT 1,
    offset_x DECIMAL(8,3) NOT NULL DEFAULT 0,
    offset_y DECIMAL(8,3) NOT NULL DEFAULT 0,
    volume DECIMAL(8,3) NOT NULL DEFAULT 0,
    tips_enabled TINYINT(1) NOT NULL DEFAULT 1,
    welcome_messages VARCHAR(2000) NOT NULL DEFAULT '',
    tip_messages VARCHAR(4000) NOT NULL DEFAULT '',
    tip_duration INT NOT NULL DEFAULT 3500,
    tip_interval INT NOT NULL DEFAULT 9000,
    tip_offset_x INT NOT NULL DEFAULT 0,
    tip_offset_y INT NOT NULL DEFAULT 0,
    typing_enabled TINYINT(1) NOT NULL DEFAULT 0,
    typing_param VARCHAR(255) NOT NULL DEFAULT '',
    typing_speed INT NOT NULL DEFAULT 120,
    typing_min_value DECIMAL(8,3) NOT NULL DEFAULT 0,
    typing_max_value DECIMAL(8,3) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS upload_settings (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    article_image_max_mb INT NOT NULL DEFAULT 5,
    theme_background_max_mb INT NOT NULL DEFAULT 5,
    avatar_image_max_mb INT NOT NULL DEFAULT 2,
    image_max_dimension INT NOT NULL DEFAULT 8192,
    image_max_pixels INT NOT NULL DEFAULT 40000000,
    avatar_max_dimension INT NOT NULL DEFAULT 4096,
    avatar_max_pixels INT NOT NULL DEFAULT 16000000,
    avatar_min_dimension INT NOT NULL DEFAULT 64,
    article_site_zip_max_mb INT NOT NULL DEFAULT 12,
    article_site_total_mb INT NOT NULL DEFAULT 40,
    article_site_file_count INT NOT NULL DEFAULT 400
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    admin_path_suffix VARCHAR(64) NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_profile (id, nickname, bio, tags, welcome_text, cta_title, cta_description, updated_at)
VALUES (1, '站长', '欢迎来到我的个人网站。', '开发者,终身学习者', '你好，我是', '保持联系', '欢迎通过公开邮箱联系我。', NOW());
INSERT IGNORE INTO themes (id, preset_key) VALUES (1, 'purple-pink');
INSERT IGNORE INTO live2d_settings (id) VALUES (1);
INSERT IGNORE INTO upload_settings (id) VALUES (1);
