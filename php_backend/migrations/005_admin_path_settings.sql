SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS site_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    admin_path_suffix VARCHAR(64) NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Do not insert a value here. The first admin settings request copies the currently
-- working config/fallback suffix, so deploying this migration cannot lock the admin out.
