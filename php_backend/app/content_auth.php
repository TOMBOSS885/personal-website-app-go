<?php

declare(strict_types=1);

function app_schema_018_ready(): bool
{
    try {
        $db = app_db();
        $columns = (int) $db->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_accounts' AND COLUMN_NAME IN ('nickname','nickname_normalized','role')")->fetchColumn();
        $articleColumns = (int) $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'creator_user_id'")->fetchColumn();
        $projectColumns = (int) $db->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME IN ('creator_user_id','tags')")->fetchColumn();
        $tables = (int) $db->query("SELECT COUNT(DISTINCT TABLE_NAME) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('tags','article_tags','project_tags')")->fetchColumn();
        return $columns === 3 && $articleColumns === 1 && $projectColumns === 2 && $tables === 3;
    } catch (Throwable $error) {
        return false;
    }
}

function app_require_schema_018(): void
{
    if (!app_schema_018_ready()) app_error(503, 'Please import migrations/018_user_roles_content_ownership.sql first.', 'MIGRATION_REQUIRED');
}

function app_normalize_nickname($value, bool $required = true): array
{
    $nickname = trim((string) $value);
    if ($nickname === '') {
        if ($required) app_error(400, '昵称不能为空。', 'NICKNAME_REQUIRED');
        return ['', ''];
    }
    if (function_exists('mb_substr')) $nickname = mb_substr($nickname, 0, 80); else $nickname = substr($nickname, 0, 80);
    if (preg_match('/[\x00-\x1F\x7F]/', $nickname)) app_error(400, '昵称不能包含控制字符。', 'NICKNAME_INVALID');
    if (function_exists('mb_strlen') ? mb_strlen($nickname) > 80 : strlen($nickname) > 240) app_error(400, '昵称长度不能超过 80 个字符。', 'NICKNAME_INVALID');
    $normalized = function_exists('mb_strtolower') ? mb_strtolower($nickname, 'UTF-8') : strtolower($nickname);
    return [$nickname, $normalized];
}

function app_display_name(string $nickname, string $email): string
{
    return trim($nickname) !== '' ? trim($nickname) : $email;
}

function app_user_profile_payload(array $row): array
{
    $nickname = trim((string) ($row['nickname'] ?? ''));
    $email = (string) ($row['email'] ?? '');
    return [
        'id' => (int) ($row['id'] ?? 0),
        'email' => $email,
        'nickname' => $nickname,
        'displayName' => app_display_name($nickname, $email),
        'role' => strtoupper((string) ($row['role'] ?? 'USER')) === 'ADMIN' ? 'ADMIN' : 'USER',
    ];
}

function app_current_user_profile(): array
{
    app_require_schema_018();
    app_user_required();
    $statement = app_db()->prepare('SELECT id, email, nickname, role FROM user_accounts WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $row = $statement->fetch();
    if (!$row) app_error(401, '账号当前不可用，请重新登录。', 'USER_SESSION_INVALID');
    return app_user_profile_payload($row);
}

function app_user_admin_required(): array
{
    $profile = app_current_user_profile();
    if ($profile['role'] !== 'ADMIN') app_error(403, '只有管理员可以使用创作中心。', 'USER_ADMIN_REQUIRED');
    if (function_exists('app_schema_015_ready') && app_schema_015_ready() && function_exists('app_oauth_user_has_identity') && !app_oauth_user_has_identity((int) $profile['id'])) {
        app_error(403, '请先绑定至少一个第三方账号后再使用创作中心。', 'OAUTH_BINDING_REQUIRED');
    }
    return $profile;
}

function app_update_current_user_nickname(): array
{
    app_require_schema_018();
    app_user_required();
    app_user_csrf_required();
    [$nickname, $normalized] = app_normalize_nickname(app_body()['nickname'] ?? '', true);
    try {
        $statement = app_db()->prepare('UPDATE user_accounts SET nickname = ?, nickname_normalized = ?, updated_at = NOW() WHERE id = ?');
        $statement->execute([$nickname, $normalized, (int) $_SESSION['user_id']]);
    } catch (PDOException $error) {
        if ((int) ($error->errorInfo[1] ?? 0) === 1062) app_error(409, '该昵称已被使用，请选择其他昵称。', 'NICKNAME_TAKEN');
        throw $error;
    }
    $statement = app_db()->prepare('SELECT id, email, nickname, role FROM user_accounts WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $profile = app_user_profile_payload($statement->fetch() ?: []);
    app_audit_set_context(['action' => 'UPDATE_USER_NICKNAME', 'eventType' => 'authentication', 'adminId' => null]);
    app_audit_set_details(['userId' => $profile['id'], 'nicknameUpdated' => true]);
    return $profile;
}

function app_normalize_content_tags($value): array
{
    $values = is_array($value) ? $value : preg_split('/[,，\n]+/', (string) $value);
    $result = [];
    $seen = [];
    foreach ($values ?: [] as $raw) {
        $tag = trim((string) $raw);
        if ($tag === '') continue;
        if (function_exists('mb_substr')) $tag = mb_substr($tag, 0, 80); else $tag = substr($tag, 0, 80);
        if (preg_match('/[\x00-\x1F\x7F]/', $tag)) app_error(400, '标签不能包含控制字符。', 'TAG_INVALID');
        $normalized = function_exists('mb_strtolower') ? mb_strtolower($tag, 'UTF-8') : strtolower($tag);
        if (isset($seen[$normalized])) continue;
        $seen[$normalized] = true;
        $result[] = ['name' => $tag, 'normalized' => $normalized];
        if (count($result) >= 30) break;
    }
    return $result;
}

function app_sync_content_tags(PDO $database, string $type, int $contentId, $value): string
{
    $tags = app_normalize_content_tags($value);
    if ($contentId <= 0) return implode(', ', array_column($tags, 'name'));
    $relation = $type === 'article' ? 'article_tags' : 'project_tags';
    $idColumn = $type === 'article' ? 'article_id' : 'project_id';
    $database->prepare("DELETE FROM $relation WHERE $idColumn = ?")->execute([$contentId]);
    $names = [];
    foreach ($tags as $tag) {
        $database->prepare('INSERT INTO tags (name, normalized_name, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE name = name')->execute([$tag['name'], $tag['normalized']]);
        $tagId = (int) $database->lastInsertId();
        if ($tagId === 0) { $lookup = $database->prepare('SELECT id FROM tags WHERE normalized_name = ?'); $lookup->execute([$tag['normalized']]); $tagId = (int) $lookup->fetchColumn(); }
        if ($tagId > 0) $database->prepare("INSERT IGNORE INTO $relation ($idColumn, tag_id) VALUES (?, ?)")->execute([$contentId, $tagId]);
        $names[] = $tag['name'];
    }
    return implode(', ', $names);
}

function app_content_author_payload(array $row): array
{
    $creatorId = array_key_exists('creator_user_id', $row) && $row['creator_user_id'] !== null ? (int) $row['creator_user_id'] : null;
    $email = (string) ($row['creator_email'] ?? '');
    $nickname = trim((string) ($row['creator_nickname'] ?? ''));
    if ($nickname === '' && $email === '' && array_key_exists('creator_user_id', $row)) {
        static $siteNickname = null;
        if ($siteNickname === null) {
            try {
                $siteNickname = trim((string) (app_db()->query('SELECT nickname FROM site_profile WHERE id = 1')->fetchColumn() ?: ''));
            } catch (Throwable $error) {
                $siteNickname = '';
            }
        }
        $displayName = $siteNickname !== '' ? $siteNickname : '站点管理员';
    } else {
        $displayName = $nickname !== '' ? $nickname : ($email !== '' ? $email : '站点管理员');
    }
    return ['userId' => $creatorId, 'nickname' => $nickname, 'email' => $email, 'displayName' => $displayName];
}

function app_current_admin_user_id(): ?int
{
    $username = strtolower(trim((string) ($_SESSION['admin_username'] ?? '')));
    if ($username === '') return null;
    $statement = app_db()->prepare('SELECT id FROM user_accounts WHERE LOWER(email) = ? LIMIT 1');
    $statement->execute([$username]);
    $id = $statement->fetchColumn();
    return $id === false ? null : (int) $id;
}
