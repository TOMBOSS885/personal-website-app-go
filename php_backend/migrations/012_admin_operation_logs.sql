-- Administrator authentication and operation audit log.
-- Idempotent and safe to run after migrations 001-011.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(32) NOT NULL,
    action VARCHAR(160) NOT NULL,
    admin_id BIGINT UNSIGNED NULL,
    username VARCHAR(100) NOT NULL DEFAULT '',
    ip_address VARCHAR(45) NOT NULL DEFAULT 'unknown',
    user_agent VARCHAR(512) NOT NULL DEFAULT '',
    http_method VARCHAR(10) NOT NULL,
    route VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL DEFAULT '',
    resource_id BIGINT UNSIGNED NULL,
    status_code SMALLINT UNSIGNED NOT NULL DEFAULT 200,
    success TINYINT(1) NOT NULL DEFAULT 1,
    message VARCHAR(500) NOT NULL DEFAULT '',
    details_json MEDIUMTEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_admin_operation_logs_created (created_at, id),
    INDEX idx_admin_operation_logs_event (event_type, created_at, id),
    INDEX idx_admin_operation_logs_admin (admin_id, created_at, id),
    INDEX idx_admin_operation_logs_success (success, created_at, id),
    INDEX idx_admin_operation_logs_route (route(120), created_at, id),
    CONSTRAINT fk_admin_operation_logs_admin
        FOREIGN KEY (admin_id) REFERENCES admin_account(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE FROM admin_operation_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='admin_operation_logs' AND COLUMN_NAME='details_json')=0,
    'ALTER TABLE admin_operation_logs ADD COLUMN details_json MEDIUMTEXT NULL AFTER message', 'SELECT 1');
PREPARE audit_details_column FROM @sql; EXECUTE audit_details_column; DEALLOCATE PREPARE audit_details_column;
