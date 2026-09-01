<?php

declare(strict_types=1);

function app_social_text($value, int $maxLength, string $fieldName, bool $required = false): string
{
    $text = trim((string) $value);
    if ($required && $text === '') app_error(400, $fieldName . '不能为空', 'INVALID_SOCIAL_INPUT');
    if ($text === '') return '';
    if (preg_match('//u', $text) !== 1) app_error(400, $fieldName . '编码无效', 'INVALID_SOCIAL_INPUT');
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $text)) {
        app_error(400, $fieldName . '包含无效字符', 'INVALID_SOCIAL_INPUT');
    }
    $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : preg_match_all('/./us', $text, $unused);
    if ($length > $maxLength) app_error(400, $fieldName . '不能超过 ' . $maxLength . ' 个字符', 'INVALID_SOCIAL_INPUT');
    return $text;
}

function app_social_url($value, string $fieldName, bool $required = false): string
{
    $url = app_social_text($value, 500, $fieldName, $required);
    if ($url === '') return '';
    if (!filter_var($url, FILTER_VALIDATE_URL)) app_error(400, $fieldName . '格式无效', 'INVALID_SOCIAL_URL');
    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
    if (!in_array($scheme, ['http', 'https'], true)) app_error(400, $fieldName . '仅支持 http 或 https', 'INVALID_SOCIAL_URL');
    return $url;
}

function app_friend_link_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'description' => (string) $row['description'],
        'url' => (string) $row['url'],
        'avatarUrl' => (string) $row['avatar_url'],
        'category' => (string) $row['category'],
        'displayOrder' => (int) $row['display_order'],
        'enabled' => (bool) $row['enabled'],
        'createdAt' => app_now_iso($row['created_at'] ?? null),
        'updatedAt' => app_now_iso($row['updated_at'] ?? null),
    ];
}

function app_public_friend_links(): array
{
    return app_public_cache_remember('friend-links', 60, function (): array {
        $rows = app_db()->query('SELECT * FROM friend_links WHERE enabled = 1 ORDER BY display_order ASC, id ASC')->fetchAll();
        return array_map('app_friend_link_row', $rows);
    });
}

function app_admin_friend_links(): array
{
    $rows = app_db()->query('SELECT * FROM friend_links ORDER BY display_order ASC, id ASC')->fetchAll();
    return array_map('app_friend_link_row', $rows);
}

function app_save_friend_link(?int $id): array
{
    $before = null;
    if ($id !== null) {
        $existing = app_db()->prepare('SELECT * FROM friend_links WHERE id = ?');
        $existing->execute([$id]);
        $before = $existing->fetch() ?: null;
        if ($before === null) app_error(404, '友链不存在', 'NOT_FOUND');
    }
    $body = app_body();
    $name = app_social_text($body['name'] ?? '', 80, '站点名称', true);
    $description = app_social_text($body['description'] ?? '', 300, '站点描述');
    $url = app_social_url($body['url'] ?? '', '站点链接', true);
    $avatarUrl = app_social_url($body['avatarUrl'] ?? '', '头像链接');
    $category = app_social_text($body['category'] ?? 'Blog', 40, '分类');
    $displayOrder = app_clamp(app_int($body['displayOrder'] ?? 0), -100000, 100000);
    $enabled = app_bool($body['enabled'] ?? true) ? 1 : 0;

    if ($id === null) {
        $statement = app_db()->prepare('INSERT INTO friend_links (name, description, url, avatar_url, category, display_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
        $statement->execute([$name, $description, $url, $avatarUrl, $category, $displayOrder, $enabled]);
        $id = (int) app_db()->lastInsertId();
    } else {
        $statement = app_db()->prepare('UPDATE friend_links SET name = ?, description = ?, url = ?, avatar_url = ?, category = ?, display_order = ?, enabled = ?, updated_at = NOW() WHERE id = ?');
        $statement->execute([$name, $description, $url, $avatarUrl, $category, $displayOrder, $enabled, $id]);
        if ($statement->rowCount() === 0) {
            $check = app_db()->prepare('SELECT id FROM friend_links WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetchColumn()) app_error(404, '友链不存在', 'NOT_FOUND');
        }
    }

    app_public_cache_clear();
    $statement = app_db()->prepare('SELECT * FROM friend_links WHERE id = ?');
    $statement->execute([$id]);
    $after = $statement->fetch() ?: null;
    app_audit_set_change('friend_link', $id, $before, $after, $before === null ? 'CREATE friend_link' : 'UPDATE friend_link');
    return app_friend_link_row($after ?: []);
}

function app_delete_friend_link(int $id): array
{
    $beforeStatement = app_db()->prepare('SELECT * FROM friend_links WHERE id = ?');
    $beforeStatement->execute([$id]);
    $before = $beforeStatement->fetch() ?: null;
    if ($before === null) app_error(404, '友链不存在', 'NOT_FOUND');
    $statement = app_db()->prepare('DELETE FROM friend_links WHERE id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) app_error(404, '友链不存在', 'NOT_FOUND');
    app_public_cache_clear();
    app_audit_set_change('friend_link', $id, $before, null, 'DELETE friend_link');
    return ['success' => true];
}

function app_guest_message_rate_limit(): void
{
    $rateKey = app_security_peer_hash('guest-message-minute');
    $bucket = (int) floor(time() / 60);
    try {
        $statement = app_db()->prepare('INSERT INTO guest_message_rate_limits (rate_key, window_bucket, request_count, updated_at) VALUES (?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE request_count = LEAST(request_count + 1, 65535), updated_at = NOW()');
        $statement->execute([$rateKey, $bucket]);
        $statement = app_db()->prepare('SELECT request_count FROM guest_message_rate_limits WHERE rate_key = ? AND window_bucket = ?');
        $statement->execute([$rateKey, $bucket]);
        if ((int) $statement->fetchColumn() > 10) {
            header('Retry-After: 60');
            app_error(429, '每分钟最多发送 10 条留言，请稍后再试', 'GUEST_MESSAGE_RATE_LIMITED');
        }
        if (random_int(1, 100) === 1) {
            app_db()->exec('DELETE FROM guest_message_rate_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY) LIMIT 500');
        }
    } catch (PDOException $error) {
        error_log('Guest message rate limit failed: ' . $error->getMessage());
        app_error(503, '留言服务暂时繁忙，请稍后再试', 'GUEST_MESSAGE_UNAVAILABLE');
    }
}

function app_guest_message_target(array $row): ?array
{
    $type = (string) ($row['target_type'] ?? '');
    $id = (int) ($row['target_id'] ?? 0);
    if (!in_array($type, ['article', 'project'], true) || $id < 1) return null;
    return [
        'type' => $type,
        'id' => $id,
        'title' => (string) ($row['target_title'] ?? ''),
        'url' => $type === 'article' ? '/blog/' . $id : '/projects#project-' . $id,
    ];
}

function app_guest_message_row(array $row, bool $admin = false): array
{
    $message = [
        'id' => (int) $row['id'],
        'nickname' => (string) $row['nickname'],
        'website' => (string) $row['website'],
        'content' => (string) $row['content'],
        'target' => app_guest_message_target($row),
        'createdAt' => app_now_iso($row['created_at'] ?? null),
    ];
    if ($admin) {
        $message['email'] = (string) $row['email'];
        $message['status'] = (string) $row['status'];
        $message['sourceKey'] = substr(bin2hex((string) $row['author_key']), 0, 12);
        $message['updatedAt'] = app_now_iso($row['updated_at'] ?? null);
    }
    return $message;
}

function app_guest_message_target_input(array $body): array
{
    $type = strtolower(trim((string) ($body['targetType'] ?? '')));
    $id = app_int($body['targetId'] ?? 0);
    if ($type === '' && $id < 1) return ['', null, ''];
    if (!in_array($type, ['article', 'project'], true) || $id < 1) {
        app_error(400, '关联内容无效', 'INVALID_GUEST_MESSAGE_TARGET');
    }

    if ($type === 'article') {
        $statement = app_db()->prepare('SELECT title FROM articles WHERE id = ? AND published = 1');
    } else {
        $statement = app_db()->prepare('SELECT name FROM projects WHERE id = ?');
    }
    $statement->execute([$id]);
    $title = $statement->fetchColumn();
    if ($title === false) app_error(400, '关联内容不存在或暂不可见', 'GUEST_MESSAGE_TARGET_NOT_FOUND');
    return [$type, $id, app_social_text($title, 200, '关联标题', true)];
}

function app_public_guest_message_targets(): array
{
    $counts = [];
    $rows = app_db()->query("SELECT target_type, target_id, COUNT(*) AS message_count, MAX(id) AS latest_message_id FROM guest_messages WHERE status = 'visible' AND deleted_at IS NULL AND target_type IN ('article', 'project') AND target_id IS NOT NULL GROUP BY target_type, target_id")->fetchAll();
    foreach ($rows as $row) {
        $counts[(string) $row['target_type']][(int) $row['target_id']] = [
            'messageCount' => (int) $row['message_count'],
            'latestMessageId' => (int) $row['latest_message_id'],
        ];
    }
    $mapTarget = function (string $type, array $row) use ($counts): array {
        $id = (int) $row['id'];
        return array_merge([
            'id' => $id,
            'title' => (string) ($row['title'] ?? $row['name'] ?? ''),
            'messageCount' => 0,
            'latestMessageId' => null,
        ], $counts[$type][$id] ?? []);
    };
    $articles = app_db()->query('SELECT id, title FROM articles WHERE published = 1 ORDER BY created_at DESC, id DESC')->fetchAll();
    $projects = app_db()->query('SELECT id, name FROM projects ORDER BY display_order ASC, id DESC')->fetchAll();
    return [
        'articles' => array_map(function (array $row) use ($mapTarget): array { return $mapTarget('article', $row); }, $articles),
        'projects' => array_map(function (array $row) use ($mapTarget): array { return $mapTarget('project', $row); }, $projects),
    ];
}

function app_public_guest_messages(): array
{
    $page = max(0, app_int($_GET['page'] ?? 0));
    $size = app_clamp(app_int($_GET['size'] ?? 20), 1, 50);
    $conditions = ["status = 'visible'", 'deleted_at IS NULL'];
    $values = [];
    $targetType = strtolower(trim((string) ($_GET['targetType'] ?? '')));
    $targetId = app_int($_GET['targetId'] ?? 0);
    if ($targetType !== '' || $targetId > 0) {
        if (!in_array($targetType, ['article', 'project'], true) || $targetId < 1) {
            app_error(400, '关联内容筛选无效', 'INVALID_GUEST_MESSAGE_TARGET');
        }
        $conditions[] = 'target_type = ?';
        $conditions[] = 'target_id = ?';
        $values[] = $targetType;
        $values[] = $targetId;
    }
    $where = implode(' AND ', $conditions);
    $count = app_db()->prepare('SELECT COUNT(*) FROM guest_messages WHERE ' . $where);
    $count->execute($values);
    $total = (int) $count->fetchColumn();
    $statement = app_db()->prepare('SELECT id, nickname, website, content, target_type, target_id, target_title, created_at FROM guest_messages WHERE ' . $where . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?');
    $index = 1;
    foreach ($values as $value) $statement->bindValue($index++, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    $statement->bindValue($index++, $size, PDO::PARAM_INT);
    $statement->bindValue($index, $page * $size, PDO::PARAM_INT);
    $statement->execute();
    return [
        'content' => array_map('app_guest_message_row', $statement->fetchAll()),
        'page' => $page,
        'size' => $size,
        'totalElements' => $total,
        'totalPages' => $total === 0 ? 0 : (int) ceil($total / $size),
    ];
}

function app_public_guest_message(int $id): array
{
    $statement = app_db()->prepare("SELECT id, nickname, website, content, target_type, target_id, target_title, created_at FROM guest_messages WHERE id = ? AND status = 'visible' AND deleted_at IS NULL");
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, '留言不存在或已隐藏', 'NOT_FOUND');
    return app_guest_message_row($row);
}

function app_create_guest_message(): array
{
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) app_error(413, '留言请求过大', 'GUEST_MESSAGE_TOO_LARGE');
    $body = app_body();
    if (trim((string) ($body['company'] ?? '')) !== '') app_error(400, '留言参数无效', 'INVALID_SOCIAL_INPUT');
    app_guest_message_rate_limit();

    $nickname = app_social_text($body['nickname'] ?? '', 40, '昵称', true);
    $email = app_social_text($body['email'] ?? '', 254, '邮箱');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) app_error(400, '邮箱格式无效', 'INVALID_EMAIL');
    $website = app_social_url($body['website'] ?? '', '个人网站');
    $content = app_social_text($body['content'] ?? '', 1000, '留言内容', true);
    [$targetType, $targetId, $targetTitle] = app_guest_message_target_input($body);
    $authorKey = app_security_peer_hash('guest-message-author');

    $statement = app_db()->prepare("INSERT INTO guest_messages (nickname, email, website, content, target_type, target_id, target_title, status, author_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'visible', ?, NOW(), NOW())");
    $statement->execute([$nickname, $email, $website, $content, $targetType, $targetId, $targetTitle, $authorKey]);
    $id = (int) app_db()->lastInsertId();
    app_public_cache_clear();
    return [
        'id' => $id,
        'nickname' => $nickname,
        'website' => $website,
        'content' => $content,
        'target' => app_guest_message_target(['target_type' => $targetType, 'target_id' => $targetId, 'target_title' => $targetTitle]),
        'createdAt' => date(DATE_ATOM),
    ];
}

function app_admin_guest_messages(): array
{
    $page = max(0, app_int($_GET['page'] ?? 0));
    $size = app_clamp(app_int($_GET['size'] ?? 30), 1, 100);
    $status = trim((string) ($_GET['status'] ?? ''));
    if (!in_array($status, ['', 'visible', 'hidden'], true)) $status = '';
    $keyword = app_social_text($_GET['q'] ?? '', 100, '搜索关键词');
    $conditions = ['deleted_at IS NULL'];
    $values = [];
    if ($status !== '') {
        $conditions[] = 'status = ?';
        $values[] = $status;
    }
    if ($keyword !== '') {
        $conditions[] = '(nickname LIKE ? OR email LIKE ? OR content LIKE ? OR target_title LIKE ?)';
        $like = '%' . $keyword . '%';
        array_push($values, $like, $like, $like, $like);
    }
    $where = implode(' AND ', $conditions);
    $count = app_db()->prepare('SELECT COUNT(*) FROM guest_messages WHERE ' . $where);
    $count->execute($values);
    $total = (int) $count->fetchColumn();
    $statement = app_db()->prepare('SELECT id, nickname, email, website, content, target_type, target_id, target_title, status, author_key, created_at, updated_at FROM guest_messages WHERE ' . $where . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?');
    $index = 1;
    foreach ($values as $value) $statement->bindValue($index++, $value, PDO::PARAM_STR);
    $statement->bindValue($index++, $size, PDO::PARAM_INT);
    $statement->bindValue($index, $page * $size, PDO::PARAM_INT);
    $statement->execute();
    $messages = array_map(function (array $row): array { return app_guest_message_row($row, true); }, $statement->fetchAll());
    return ['content' => $messages, 'page' => $page, 'size' => $size, 'totalElements' => $total, 'totalPages' => $total === 0 ? 0 : (int) ceil($total / $size)];
}

function app_update_guest_message_status(int $id): array
{
    $beforeStatement = app_db()->prepare('SELECT * FROM guest_messages WHERE id = ?');
    $beforeStatement->execute([$id]);
    $before = $beforeStatement->fetch() ?: null;
    if ($before === null) app_error(404, '留言不存在', 'NOT_FOUND');
    $body = app_body();
    $status = trim((string) ($body['status'] ?? ''));
    if (!in_array($status, ['visible', 'hidden'], true)) app_error(400, '留言状态无效', 'INVALID_MESSAGE_STATUS');
    $statement = app_db()->prepare('UPDATE guest_messages SET status = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL');
    $statement->execute([$status, $id]);
    if ($statement->rowCount() === 0) {
        $check = app_db()->prepare('SELECT id FROM guest_messages WHERE id = ? AND deleted_at IS NULL');
        $check->execute([$id]);
        if (!$check->fetchColumn()) app_error(404, '留言不存在', 'NOT_FOUND');
    }
    app_public_cache_clear();
    $afterStatement = app_db()->prepare('SELECT * FROM guest_messages WHERE id = ?');
    $afterStatement->execute([$id]);
    app_audit_set_change('guest_message', $id, $before, $afterStatement->fetch() ?: null, 'UPDATE guest_message');
    return ['id' => $id, 'status' => $status];
}

function app_delete_guest_message(int $id): array
{
    $beforeStatement = app_db()->prepare('SELECT * FROM guest_messages WHERE id = ?');
    $beforeStatement->execute([$id]);
    $before = $beforeStatement->fetch() ?: null;
    if ($before === null) app_error(404, '留言不存在', 'NOT_FOUND');
    $statement = app_db()->prepare("UPDATE guest_messages SET status = 'hidden', deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL");
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) app_error(404, '留言不存在', 'NOT_FOUND');
    app_public_cache_clear();
    $afterStatement = app_db()->prepare('SELECT * FROM guest_messages WHERE id = ?');
    $afterStatement->execute([$id]);
    app_audit_set_change('guest_message', $id, $before, $afterStatement->fetch() ?: null, 'DELETE guest_message');
    return ['success' => true];
}
