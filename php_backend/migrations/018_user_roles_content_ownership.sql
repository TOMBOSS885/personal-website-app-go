-- User profiles, roles, content ownership, and shared tags.
-- Safe to run after migrations 001-017.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND COLUMN_NAME='nickname')=0,
    'ALTER TABLE user_accounts ADD COLUMN nickname VARCHAR(80) NULL AFTER email', 'SELECT 1');
PREPARE add_user_nickname FROM @sql; EXECUTE add_user_nickname; DEALLOCATE PREPARE add_user_nickname;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND COLUMN_NAME='nickname_normalized')=0,
    'ALTER TABLE user_accounts ADD COLUMN nickname_normalized VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER nickname', 'SELECT 1');
PREPARE add_user_nickname_normalized FROM @sql; EXECUTE add_user_nickname_normalized; DEALLOCATE PREPARE add_user_nickname_normalized;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND COLUMN_NAME='role')=0,
    "ALTER TABLE user_accounts ADD COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' AFTER nickname_normalized", 'SELECT 1');
PREPARE add_user_role FROM @sql; EXECUTE add_user_role; DEALLOCATE PREPARE add_user_role;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='user_accounts' AND INDEX_NAME='uq_user_accounts_nickname_normalized')=0,
    'ALTER TABLE user_accounts ADD UNIQUE KEY uq_user_accounts_nickname_normalized (nickname_normalized)', 'SELECT 1');
PREPARE user_nickname_index FROM @sql; EXECUTE user_nickname_index; DEALLOCATE PREPARE user_nickname_index;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND COLUMN_NAME='creator_user_id')=0,
    'ALTER TABLE articles ADD COLUMN creator_user_id BIGINT UNSIGNED NULL AFTER id', 'SELECT 1');
PREPARE add_article_creator FROM @sql; EXECUTE add_article_creator; DEALLOCATE PREPARE add_article_creator;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='articles' AND INDEX_NAME='idx_articles_creator_user')=0,
    'ALTER TABLE articles ADD INDEX idx_articles_creator_user (creator_user_id, updated_at, id)', 'SELECT 1');
PREPARE article_creator_index FROM @sql; EXECUTE article_creator_index; DEALLOCATE PREPARE article_creator_index;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='projects' AND COLUMN_NAME='tags')=0,
    "ALTER TABLE projects ADD COLUMN tags VARCHAR(500) NOT NULL DEFAULT '' AFTER tech_stack", 'SELECT 1');
PREPARE add_project_tags FROM @sql; EXECUTE add_project_tags; DEALLOCATE PREPARE add_project_tags;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='projects' AND COLUMN_NAME='creator_user_id')=0,
    'ALTER TABLE projects ADD COLUMN creator_user_id BIGINT UNSIGNED NULL AFTER id', 'SELECT 1');
PREPARE add_project_creator FROM @sql; EXECUTE add_project_creator; DEALLOCATE PREPARE add_project_creator;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='projects' AND INDEX_NAME='idx_projects_creator_user')=0,
    'ALTER TABLE projects ADD INDEX idx_projects_creator_user (creator_user_id, updated_at, id)', 'SELECT 1');
PREPARE project_creator_index FROM @sql; EXECUTE project_creator_index; DEALLOCATE PREPARE project_creator_index;

CREATE TABLE IF NOT EXISTS tags (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    normalized_name VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_tags_normalized_name (normalized_name),
    INDEX idx_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_tags (
    article_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    INDEX idx_article_tags_tag (tag_id, article_id),
    CONSTRAINT fk_article_tags_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    CONSTRAINT fk_article_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_tags (
    project_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (project_id, tag_id),
    INDEX idx_project_tags_tag (tag_id, project_id),
    CONSTRAINT fk_project_tags_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If the administrator username is an existing user email, preserve that
-- account as the initial ADMIN. Other accounts remain USER until explicitly
-- promoted from the existing administrator user-management page.
UPDATE user_accounts u JOIN admin_account a ON LOWER(a.username) = LOWER(u.email)
SET u.role = 'ADMIN'
WHERE u.role = 'USER';
