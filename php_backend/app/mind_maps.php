<?php

declare(strict_types=1);

function app_schema_016_ready(): bool
{
    try {
        $tables = (int) app_db()->query("SELECT COUNT(DISTINCT TABLE_NAME) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('mind_maps','mind_map_revisions')")->fetchColumn();
        return $tables === 2;
    } catch (Throwable $error) {
        return false;
    }
}

function app_require_schema_016(): void
{
    if (!app_schema_016_ready()) app_error(503, 'Please import migrations/016_mind_maps.sql first.', 'MIGRATION_REQUIRED');
}

function app_mind_map_identity_required(): int
{
    app_require_schema_016();
    app_require_schema_015();
    if (empty($_SESSION['user_id'])) app_error(401, '请先登录后使用思维导图。', 'USER_UNAUTHENTICATED');
    app_user_required();
    if (!app_oauth_user_has_identity((int) $_SESSION['user_id'])) {
        app_error(403, '绑定至少一个第三方账号后才能查看或创建思维导图。', 'OAUTH_IDENTITY_REQUIRED');
    }
    return (int) $_SESSION['user_id'];
}

function app_mind_map_payload(array $row, bool $includeData = false): array
{
    $result = [
        'id' => (int) $row['id'],
        'title' => (string) $row['title'],
        'description' => (string) ($row['description'] ?? ''),
        'creatorId' => (int) $row['creator_id'],
        'creatorEmail' => (string) $row['creator_email'],
        'version' => (int) ($row['version'] ?? 1),
        'createdAt' => app_now_iso($row['created_at'] ?? null),
        'updatedAt' => app_now_iso($row['updated_at'] ?? null),
    ];
    if ($includeData) {
        $decoded = json_decode((string) ($row['data'] ?? ''), true);
        $result['data'] = is_array($decoded) ? $decoded : ['nodes' => [], 'viewport' => ['x' => 0, 'y' => 0, 'scale' => 1]];
    }
    return $result;
}

function app_mind_map_normalize_data($value): string
{
    if (!is_array($value)) app_error(400, '思维导图数据格式无效。', 'MIND_MAP_DATA_INVALID');
    $nodes = is_array($value['nodes'] ?? null) ? array_values($value['nodes']) : [];
    if (count($nodes) > 5000) app_error(413, '单张思维导图最多支持 5000 个节点。', 'MIND_MAP_TOO_LARGE');
    $clean = [];
    $ids = [];
    foreach ($nodes as $node) {
        if (!is_array($node)) continue;
        $id = substr(trim((string) ($node['id'] ?? '')), 0, 80);
        $text = trim((string) ($node['text'] ?? ''));
        if ($id === '' || $text === '') continue;
        if (isset($ids[$id])) continue;
        $ids[$id] = true;
        $clean[] = [
            'id' => $id,
            'parentId' => ($node['parentId'] ?? null) === null ? null : substr((string) $node['parentId'], 0, 80),
            'text' => function_exists('mb_substr') ? mb_substr($text, 0, 200) : substr($text, 0, 200),
            'x' => max(-100000, min(100000, (float) ($node['x'] ?? 0))),
            'y' => max(-100000, min(100000, (float) ($node['y'] ?? 0))),
            'collapsed' => !empty($node['collapsed']),
            'note' => function_exists('mb_substr') ? mb_substr((string) ($node['note'] ?? ''), 0, 2000) : substr((string) ($node['note'] ?? ''), 0, 2000),
            'color' => preg_match('/^#[0-9a-f]{6}$/i', (string) ($node['color'] ?? '')) ? (string) $node['color'] : '#dbeafe',
            'projectId' => !empty($node['projectId']) ? (int) $node['projectId'] : null,
            'articleId' => !empty($node['articleId']) ? (int) $node['articleId'] : null,
            'articleHeadingId' => substr((string) ($node['articleHeadingId'] ?? ''), 0, 180),
            'articleHeadingText' => function_exists('mb_substr') ? mb_substr((string) ($node['articleHeadingText'] ?? ''), 0, 255) : substr((string) ($node['articleHeadingText'] ?? ''), 0, 255),
        ];
    }
    $viewport = is_array($value['viewport'] ?? null) ? $value['viewport'] : [];
    $payload = ['nodes' => $clean, 'viewport' => [
        'x' => max(-100000, min(100000, (float) ($viewport['x'] ?? 0))),
        'y' => max(-100000, min(100000, (float) ($viewport['y'] ?? 0))),
        'scale' => max(0.2, min(2.5, (float) ($viewport['scale'] ?? 1))),
    ]];
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || strlen($json) > 8 * 1024 * 1024) app_error(413, '思维导图数据过大。', 'MIND_MAP_TOO_LARGE');
    return $json;
}

function app_mind_map_resources(): array
{
    app_mind_map_identity_required();
    $projects = app_projects(false);
    $articles = app_db()->query('SELECT id, title, summary, published, is_locked, login_required, requires_oauth_identity FROM articles WHERE published = 1 ORDER BY created_at DESC, id DESC LIMIT 500')->fetchAll();
    return ['projects' => $projects, 'articles' => array_map(static function (array $row): array {
        return ['id' => (int) $row['id'], 'title' => (string) $row['title'], 'summary' => (string) ($row['summary'] ?? ''), 'isLocked' => !empty($row['is_locked']), 'loginRequired' => !empty($row['login_required']), 'requiresThirdPartyBinding' => !empty($row['requires_oauth_identity'])];
    }, $articles)];
}

function app_public_mind_maps(): array
{
    app_mind_map_identity_required();
    $rows = app_db()->query('SELECT id, title, description, creator_id, creator_email, version, created_at, updated_at FROM mind_maps ORDER BY updated_at DESC, id DESC LIMIT 500')->fetchAll();
    return array_map(static fn(array $row): array => app_mind_map_payload($row), $rows);
}

function app_public_mind_map(int $id): array
{
    app_mind_map_identity_required();
    $statement = app_db()->prepare('SELECT * FROM mind_maps WHERE id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, '思维导图不存在。', 'NOT_FOUND');
    return app_mind_map_payload($row, true);
}

function app_save_mind_map(?int $id = null): array
{
    $userId = app_mind_map_identity_required();
    app_user_csrf_required();
    $body = app_body();
    $title = trim((string) ($body['title'] ?? ''));
    if ($title === '' || strlen($title) > 200) app_error(400, '思维导图标题不能为空且不超过 200 个字符。', 'MIND_MAP_TITLE_INVALID');
    $description = trim((string) ($body['description'] ?? ''));
    if (strlen($description) > 1000) $description = substr($description, 0, 1000);
    $data = app_mind_map_normalize_data($body['data'] ?? []);
    $database = app_db();
    if ($id === null) {
        $email = (string) $_SESSION['user_email'];
        $database->beginTransaction();
        try {
            $statement = $database->prepare('INSERT INTO mind_maps (title, description, data, creator_id, creator_email, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())');
            $statement->execute([$title, $description, $data, $userId, $email]);
            $newId = (int) $database->lastInsertId();
            $database->prepare('INSERT INTO mind_map_revisions (mind_map_id, version, data, editor_id, editor_email, created_at) VALUES (?, 1, ?, ?, ?, NOW())')->execute([$newId, $data, $userId, $email]);
            $database->commit();
        } catch (Throwable $error) { if ($database->inTransaction()) $database->rollBack(); throw $error; }
        $id = $newId;
    } else {
        $statement = $database->prepare('SELECT * FROM mind_maps WHERE id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) app_error(404, '思维导图不存在。', 'NOT_FOUND');
        if ((int) $row['creator_id'] !== $userId) app_error(403, '只有创建者可以修改思维导图。', 'MIND_MAP_FORBIDDEN');
        $database->beginTransaction();
        try {
            $locked = $database->prepare('SELECT version FROM mind_maps WHERE id = ? FOR UPDATE');
            $locked->execute([$id]);
            $version = (int) $locked->fetchColumn() + 1;
            $database->prepare('UPDATE mind_maps SET title = ?, description = ?, data = ?, version = ?, updated_at = NOW() WHERE id = ?')->execute([$title, $description, $data, $version, $id]);
            $database->prepare('INSERT INTO mind_map_revisions (mind_map_id, version, data, editor_id, editor_email, created_at) VALUES (?, ?, ?, ?, ?, NOW())')->execute([$id, $version, $data, $userId, (string) $_SESSION['user_email']]);
            $database->commit();
        } catch (Throwable $error) { if ($database->inTransaction()) $database->rollBack(); throw $error; }
    }
    $statement = $database->prepare('SELECT * FROM mind_maps WHERE id = ?'); $statement->execute([$id]);
    return app_mind_map_payload($statement->fetch(), true);
}

function app_admin_mind_maps(): array
{
    app_require_schema_016();
    $rows = app_db()->query('SELECT id, title, description, creator_id, creator_email, version, created_at, updated_at FROM mind_maps ORDER BY updated_at DESC, id DESC LIMIT 1000')->fetchAll();
    return array_map(static fn(array $row): array => app_mind_map_payload($row), $rows);
}

function app_admin_delete_mind_map(int $id): array
{
    app_require_schema_016();
    $statement = app_db()->prepare('DELETE FROM mind_maps WHERE id = ?'); $statement->execute([$id]);
    if ($statement->rowCount() === 0) app_error(404, '思维导图不存在。', 'NOT_FOUND');
    return ['success' => true];
}

function app_admin_mind_map_revisions(int $id): array
{
    app_require_schema_016();
    $statement = app_db()->prepare('SELECT id, version, editor_id, editor_email, created_at FROM mind_map_revisions WHERE mind_map_id = ? ORDER BY version DESC LIMIT 100');
    $statement->execute([$id]);
    return array_map(static function (array $row): array { return ['id' => (int) $row['id'], 'version' => (int) $row['version'], 'editorId' => (int) $row['editor_id'], 'editorEmail' => (string) $row['editor_email'], 'createdAt' => app_now_iso($row['created_at'])]; }, $statement->fetchAll());
}
