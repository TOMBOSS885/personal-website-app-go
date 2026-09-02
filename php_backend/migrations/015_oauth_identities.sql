-- Third-party identities and OAuth transaction state. Safe to run repeatedly.
SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS oauth_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_scope VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_subject VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_union_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500) NOT NULL DEFAULT '',
    bound_at DATETIME NOT NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_oauth_provider_subject (provider, provider_scope, provider_subject),
    UNIQUE KEY uq_oauth_provider_union (provider, provider_union_id),
    UNIQUE KEY uq_oauth_user_provider (user_id, provider),
    INDEX idx_oauth_identity_user (user_id, provider),
    CONSTRAINT fk_oauth_identity_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    state_hash BINARY(32) NOT NULL,
    session_hash BINARY(32) NOT NULL,
    provider VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    intent VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    return_path VARCHAR(500) NOT NULL DEFAULT '/',
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    UNIQUE KEY uq_oauth_transaction_state (state_hash),
    INDEX idx_oauth_transaction_expiry (expires_at, used_at),
    INDEX idx_oauth_transaction_user (user_id, created_at),
    CONSTRAINT fk_oauth_transaction_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-running the migration also repairs a pre-release table created with the
-- site's case-insensitive default collation.
ALTER TABLE oauth_identities
    MODIFY provider VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY provider_scope VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY provider_subject VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    MODIFY provider_union_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='oauth_identities' AND INDEX_NAME='uq_oauth_provider_subject')=0,
    'ALTER TABLE oauth_identities ADD UNIQUE KEY uq_oauth_provider_subject (provider, provider_scope, provider_subject)', 'SELECT 1');
PREPARE add_oauth_subject_unique FROM @sql; EXECUTE add_oauth_subject_unique; DEALLOCATE PREPARE add_oauth_subject_unique;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='oauth_identities' AND INDEX_NAME='uq_oauth_provider_union')=0,
    'ALTER TABLE oauth_identities ADD UNIQUE KEY uq_oauth_provider_union (provider, provider_union_id)', 'SELECT 1');
PREPARE add_oauth_union_unique FROM @sql; EXECUTE add_oauth_union_unique; DEALLOCATE PREPARE add_oauth_union_unique;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='oauth_identities' AND INDEX_NAME='uq_oauth_user_provider')=0,
    'ALTER TABLE oauth_identities ADD UNIQUE KEY uq_oauth_user_provider (user_id, provider)', 'SELECT 1');
PREPARE add_oauth_user_provider_unique FROM @sql; EXECUTE add_oauth_user_provider_unique; DEALLOCATE PREPARE add_oauth_user_provider_unique;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='requires_oauth_identity')=0,
    'ALTER TABLE articles ADD COLUMN requires_oauth_identity TINYINT(1) NOT NULL DEFAULT 0 AFTER login_required', 'SELECT 1');
PREPARE add_article_requires_oauth FROM @sql; EXECUTE add_article_requires_oauth; DEALLOCATE PREPARE add_article_requires_oauth;
