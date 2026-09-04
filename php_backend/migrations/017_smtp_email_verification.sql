-- SMTP configuration and short-lived registration email verification codes.
-- Safe to run after migrations 001-016.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS mail_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    smtp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    smtp_host VARCHAR(255) NOT NULL DEFAULT '',
    smtp_port SMALLINT UNSIGNED NOT NULL DEFAULT 465,
    smtp_username VARCHAR(254) NOT NULL DEFAULT '',
    smtp_password_encrypted TEXT NOT NULL,
    smtp_from_email VARCHAR(254) NOT NULL DEFAULT '',
    smtp_from_name VARCHAR(200) NOT NULL DEFAULT '',
    smtp_security VARCHAR(16) NOT NULL DEFAULT 'ssl',
    registration_email_verification_enabled TINYINT(1) NOT NULL DEFAULT 0,
    last_test_at DATETIME NULL,
    last_test_success TINYINT(1) NULL,
    updated_at DATETIME NOT NULL,
    updated_by BIGINT UNSIGNED NULL,
    INDEX idx_mail_settings_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mail_settings (id, updated_at)
VALUES (1, NOW())
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    purpose VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    client_hash BINARY(32) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_email_verification_lookup (email, purpose, used_at, expires_at),
    INDEX idx_email_verification_client (client_hash, created_at),
    INDEX idx_email_verification_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
