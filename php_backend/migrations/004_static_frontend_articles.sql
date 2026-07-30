SET NAMES utf8mb4;

ALTER TABLE articles
    ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT 'markdown' AFTER published,
    ADD COLUMN static_site_key VARCHAR(64) NULL AFTER content_type,
    ADD COLUMN static_site_name VARCHAR(255) NULL AFTER static_site_key,
    ADD INDEX idx_articles_content_type (content_type);

ALTER TABLE upload_settings
    ADD COLUMN article_site_zip_max_mb INT NOT NULL DEFAULT 12,
    ADD COLUMN article_site_total_mb INT NOT NULL DEFAULT 40,
    ADD COLUMN article_site_file_count INT NOT NULL DEFAULT 400;
