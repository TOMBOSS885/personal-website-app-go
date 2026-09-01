-- User account administration fields. Safe to run repeatedly.
SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET @schema_name = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND COLUMN_NAME='disabled_at')=0,
    'ALTER TABLE user_accounts ADD COLUMN disabled_at DATETIME NULL AFTER locked_until', 'SELECT 1');
PREPARE add_user_disabled_at FROM @sql; EXECUTE add_user_disabled_at; DEALLOCATE PREPARE add_user_disabled_at;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND COLUMN_NAME='disabled_reason')=0,
    'ALTER TABLE user_accounts ADD COLUMN disabled_reason VARCHAR(255) NOT NULL DEFAULT '''' AFTER disabled_at', 'SELECT 1');
PREPARE add_user_disabled_reason FROM @sql; EXECUTE add_user_disabled_reason; DEALLOCATE PREPARE add_user_disabled_reason;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND INDEX_NAME='idx_user_accounts_disabled')=0,
    'ALTER TABLE user_accounts ADD INDEX idx_user_accounts_disabled (disabled_at)', 'SELECT 1');
PREPARE add_user_disabled_index FROM @sql; EXECUTE add_user_disabled_index; DEALLOCATE PREPARE add_user_disabled_index;
