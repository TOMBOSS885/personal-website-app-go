-- Content discovery additions: lightweight article series metadata.
-- Safe to run once after migrations 001-009.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'series_name'
);
SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE articles ADD COLUMN series_name VARCHAR(120) NOT NULL DEFAULT '''' AFTER tags',
    'SELECT 1'
);
PREPARE add_series_name FROM @sql;
EXECUTE add_series_name;
DEALLOCATE PREPARE add_series_name;

SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'series_order'
);
SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE articles ADD COLUMN series_order INT NOT NULL DEFAULT 0 AFTER series_name',
    'SELECT 1'
);
PREPARE add_series_order FROM @sql;
EXECUTE add_series_order;
DEALLOCATE PREPARE add_series_order;

SET @index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND INDEX_NAME = 'idx_articles_series'
);
SET @sql := IF(
    @index_exists = 0,
    'ALTER TABLE articles ADD INDEX idx_articles_series (series_name, series_order, published)',
    'SELECT 1'
);
PREPARE add_series_index FROM @sql;
EXECUTE add_series_index;
DEALLOCATE PREPARE add_series_index;
