SET NAMES utf8mb4;

-- This migration supports both an older database and a fresh database created
-- from 001_schema.sql. MySQL 5.7 has no ADD COLUMN IF NOT EXISTS, so each
-- operation is guarded through information_schema.
SET @schema_name = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='content_type')=0,
    'ALTER TABLE articles ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT ''markdown'' AFTER published', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='static_site_key')=0,
    'ALTER TABLE articles ADD COLUMN static_site_key VARCHAR(64) NULL AFTER content_type', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='static_site_name')=0,
    'ALTER TABLE articles ADD COLUMN static_site_name VARCHAR(255) NULL AFTER static_site_key', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND INDEX_NAME='idx_articles_content_type')=0,
    'ALTER TABLE articles ADD INDEX idx_articles_content_type (content_type)', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='upload_settings' AND COLUMN_NAME='article_site_zip_max_mb')=0,
    'ALTER TABLE upload_settings ADD COLUMN article_site_zip_max_mb INT NOT NULL DEFAULT 12', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='upload_settings' AND COLUMN_NAME='article_site_total_mb')=0,
    'ALTER TABLE upload_settings ADD COLUMN article_site_total_mb INT NOT NULL DEFAULT 40', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='upload_settings' AND COLUMN_NAME='article_site_file_count')=0,
    'ALTER TABLE upload_settings ADD COLUMN article_site_file_count INT NOT NULL DEFAULT 400', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
