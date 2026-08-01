SET NAMES utf8mb4;

SET @schema_name = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='guest_messages' AND COLUMN_NAME='target_type')=0,
    'ALTER TABLE guest_messages ADD COLUMN target_type VARCHAR(16) NOT NULL DEFAULT '''' AFTER content', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='guest_messages' AND COLUMN_NAME='target_id')=0,
    'ALTER TABLE guest_messages ADD COLUMN target_id BIGINT UNSIGNED NULL AFTER target_type', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='guest_messages' AND COLUMN_NAME='target_title')=0,
    'ALTER TABLE guest_messages ADD COLUMN target_title VARCHAR(200) NOT NULL DEFAULT '''' AFTER target_id', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='guest_messages' AND INDEX_NAME='idx_guest_messages_target_public')=0,
    'ALTER TABLE guest_messages ADD INDEX idx_guest_messages_target_public (target_type, target_id, status, deleted_at, created_at, id)', 'SELECT 1');
PREPARE migration_stmt FROM @sql; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
