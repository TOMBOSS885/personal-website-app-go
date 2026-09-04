-- Mind map snapshots and append-only edit history.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS mind_maps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    data MEDIUMTEXT NOT NULL,
    creator_id BIGINT UNSIGNED NOT NULL,
    creator_email VARCHAR(254) NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_mind_maps_updated (updated_at, id),
    INDEX idx_mind_maps_creator (creator_id, updated_at),
    CONSTRAINT fk_mind_map_creator FOREIGN KEY (creator_id) REFERENCES user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mind_map_revisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mind_map_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    data MEDIUMTEXT NOT NULL,
    editor_id BIGINT UNSIGNED NOT NULL,
    editor_email VARCHAR(254) NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_mind_map_revisions_map (mind_map_id, version),
    CONSTRAINT fk_mind_map_revision_map FOREIGN KEY (mind_map_id) REFERENCES mind_maps(id) ON DELETE CASCADE,
    CONSTRAINT fk_mind_map_revision_editor FOREIGN KEY (editor_id) REFERENCES user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
