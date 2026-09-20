-- Administrator RFC 6238 authenticator-app two-factor authentication.
-- Idempotent and safe to run after migrations 001-018.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_account' AND COLUMN_NAME='totp_secret_encrypted')=0,
    'ALTER TABLE admin_account ADD COLUMN totp_secret_encrypted VARCHAR(512) NULL AFTER password_hash', 'SELECT 1');
PREPARE add_admin_totp_secret FROM @sql; EXECUTE add_admin_totp_secret; DEALLOCATE PREPARE add_admin_totp_secret;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_account' AND COLUMN_NAME='totp_enabled')=0,
    'ALTER TABLE admin_account ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret_encrypted', 'SELECT 1');
PREPARE add_admin_totp_enabled FROM @sql; EXECUTE add_admin_totp_enabled; DEALLOCATE PREPARE add_admin_totp_enabled;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_account' AND COLUMN_NAME='totp_last_counter')=0,
    'ALTER TABLE admin_account ADD COLUMN totp_last_counter BIGINT UNSIGNED NULL AFTER totp_enabled', 'SELECT 1');
PREPARE add_admin_totp_counter FROM @sql; EXECUTE add_admin_totp_counter; DEALLOCATE PREPARE add_admin_totp_counter;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_account' AND COLUMN_NAME='totp_confirmed_at')=0,
    'ALTER TABLE admin_account ADD COLUMN totp_confirmed_at DATETIME NULL AFTER totp_last_counter', 'SELECT 1');
PREPARE add_admin_totp_confirmed FROM @sql; EXECUTE add_admin_totp_confirmed; DEALLOCATE PREPARE add_admin_totp_confirmed;
