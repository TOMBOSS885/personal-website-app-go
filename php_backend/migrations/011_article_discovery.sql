-- Article discovery metadata and indexes.
-- This migration is idempotent and safe to run after migrations 001-010.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'featured'
);
SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE articles ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER series_order',
    'SELECT 1'
);
PREPARE add_article_featured FROM @sql;
EXECUTE add_article_featured;
DEALLOCATE PREPARE add_article_featured;

SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'display_order'
);
SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE articles ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER featured',
    'SELECT 1'
);
PREPARE add_article_display_order FROM @sql;
EXECUTE add_article_display_order;
DEALLOCATE PREPARE add_article_display_order;

SET @index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND INDEX_NAME = 'idx_articles_featured_order'
);
SET @sql := IF(
    @index_exists = 0,
    'ALTER TABLE articles ADD INDEX idx_articles_featured_order (published, featured, display_order, created_at)',
    'SELECT 1'
);
PREPARE add_article_featured_index FROM @sql;
EXECUTE add_article_featured_index;
DEALLOCATE PREPARE add_article_featured_index;

SET @index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND INDEX_NAME = 'idx_articles_popular'
);
SET @sql := IF(
    @index_exists = 0,
    'ALTER TABLE articles ADD INDEX idx_articles_popular (published, views, created_at, id)',
    'SELECT 1'
);
PREPARE add_article_popular_index FROM @sql;
EXECUTE add_article_popular_index;
DEALLOCATE PREPARE add_article_popular_index;
