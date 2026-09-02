<?php

declare(strict_types=1);

/** Administrator-only management for public user accounts. */

function app_user_admin_identity_row(array $row): array
{
    return [
        'id' => (int) ($row['id'] ?? 0),
        'provider' => (string) ($row['provider'] ?? ''),
        'providerSubject' => (string) ($row['provider_subject'] ?? ''),
        'providerUnionId' => !empty($row['provider_union_id']) ? (string) $row['provider_union_id'] : null,
        'displayName' => (string) ($row['display_name'] ?? ''),
        'avatarUrl' => (string) ($row['avatar_url'] ?? ''),
        'boundAt' => !empty($row['bound_at']) ? app_now_iso($row['bound_at']) : null,
        'lastLoginAt' => !empty($row['last_login_at']) ? app_now_iso($row['last_login_at']) : null,
        'updatedAt' => !empty($row['updated_at']) ? app_now_iso($row['updated_at']) : null,
    ];
}

function app_user_admin_row(array $row): array
{
    $lockedUntil = !empty($row['locked_until']) ? (string) $row['locked_until'] : null;
    $disabledAt = !empty($row['disabled_at']) ? (string) $row['disabled_at'] : null;
    $locked = $lockedUntil !== null && strtotime($lockedUntil) > time();
    $disabled = $disabledAt !== null;
    $identityRows = is_array($row['oauth_identities'] ?? null) ? $row['oauth_identities'] : [];
    $oauthIdentities = array_map('app_user_admin_identity_row', $identityRows);
    $oauthProviders = array_values(array_unique(array_filter(array_map(
        static function (array $identity): string { return (string) ($identity['provider'] ?? ''); },
        $oauthIdentities
    ))));
    if (!$oauthProviders && !empty($row['oauth_providers'])) {
        $oauthProviders = array_values(array_filter(explode(',', (string) $row['oauth_providers'])));
    }
    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'status' => $disabled ? 'disabled' : ($locked ? 'locked' : 'active'),
        'failedLoginAttempts' => (int) ($row['failed_login_attempts'] ?? 0),
        'lockedUntil' => $lockedUntil ? app_now_iso($lockedUntil) : null,
        'disabledAt' => $disabledAt ? app_now_iso($disabledAt) : null,
        'disabledReason' => (string) ($row['disabled_reason'] ?? ''),
        'lastLoginAt' => !empty($row['last_login_at']) ? app_now_iso($row['last_login_at']) : null,
        'createdAt' => app_now_iso($row['created_at'] ?? null),
        'updatedAt' => app_now_iso($row['updated_at'] ?? null),
        'visitCount' => (int) ($row['visit_count'] ?? 0),
        'oauthProviders' => $oauthProviders,
        'oauthIdentities' => $oauthIdentities,
        'oauthIdentityCount' => count($oauthIdentities),
    ];
}

function app_admin_users(): array
{
    app_require_schema_013();
    app_require_schema_014();
    app_require_schema_015();
    $page = max(0, app_int($_GET['page'] ?? 0));
    $size = app_clamp(app_int($_GET['size'] ?? 20, 20), 1, 100);
    $search = trim((string) ($_GET['q'] ?? $_GET['search'] ?? ''));
    if (function_exists('mb_substr')) $search = mb_substr($search, 0, 100);
    else $search = substr($search, 0, 100);
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    if (!in_array($status, ['', 'active', 'locked', 'disabled'], true)) $status = '';
    $where = ['1=1'];
    $params = [];
    if ($search !== '') {
        $escapedSearch = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
        $where[] = '(u.email LIKE ? OR CAST(u.id AS CHAR) = ? OR EXISTS (SELECT 1 FROM oauth_identities os WHERE os.user_id = u.id AND (os.provider LIKE ? OR os.display_name LIKE ? OR os.provider_subject LIKE ? OR os.provider_union_id LIKE ?)))';
        $params[] = $escapedSearch;
        $params[] = $search;
        $params[] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], strtolower($search)) . '%';
        $params[] = $escapedSearch;
        $params[] = $escapedSearch;
        $params[] = $escapedSearch;
    }
    if ($status === 'disabled') $where[] = 'u.disabled_at IS NOT NULL';
    elseif ($status === 'locked') $where[] = 'u.disabled_at IS NULL AND u.locked_until IS NOT NULL AND u.locked_until > NOW()';
    elseif ($status === 'active') $where[] = 'u.disabled_at IS NULL AND (u.locked_until IS NULL OR u.locked_until <= NOW())';
    $condition = implode(' AND ', $where);
    $database = app_db();
    $count = $database->prepare("SELECT COUNT(*) FROM user_accounts u WHERE $condition");
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    $sql = "SELECT u.*, (SELECT COUNT(*) FROM site_visits v WHERE v.user_id = u.id) AS visit_count
        FROM user_accounts u WHERE $condition ORDER BY u.created_at DESC, u.id DESC LIMIT $size OFFSET " . ($page * $size);
    $statement = $database->prepare($sql);
    $statement->execute($params);
    $userRows = $statement->fetchAll();
    $identitiesByUser = [];
    if ($userRows) {
        $userIds = array_map(static function (array $row): int { return (int) $row['id']; }, $userRows);
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $identityStatement = $database->prepare("SELECT id, user_id, provider, provider_subject, provider_union_id, display_name, avatar_url, bound_at, last_login_at, updated_at
            FROM oauth_identities WHERE user_id IN ($placeholders) ORDER BY user_id, provider");
        $identityStatement->execute($userIds);
        foreach ($identityStatement->fetchAll() as $identity) {
            $userId = (int) $identity['user_id'];
            if (!isset($identitiesByUser[$userId])) $identitiesByUser[$userId] = [];
            $identitiesByUser[$userId][] = $identity;
        }
    }
    $rows = array_map(static function (array $row) use ($identitiesByUser): array {
        $row['oauth_identities'] = $identitiesByUser[(int) $row['id']] ?? [];
        return app_user_admin_row($row);
    }, $userRows);
    $summary = $database->query("SELECT COUNT(*) AS total, SUM(disabled_at IS NULL AND (locked_until IS NULL OR locked_until <= NOW())) AS active, SUM(disabled_at IS NULL AND locked_until > NOW()) AS locked, SUM(disabled_at IS NOT NULL) AS disabled FROM user_accounts")->fetch() ?: [];
    return app_page($rows, $total, $size, $page) + ['users' => $rows, 'summary' => [
        'total' => (int) ($summary['total'] ?? 0), 'active' => (int) ($summary['active'] ?? 0),
        'locked' => (int) ($summary['locked'] ?? 0), 'disabled' => (int) ($summary['disabled'] ?? 0),
    ]];
}

function app_admin_user_update(int $id): void
{
    app_require_schema_014();
    $database = app_db();
    // Parse and validate the request body before opening the transaction so a
    // malformed JSON response cannot leave the PDO connection in a transaction
    // during shutdown auditing.
    $body = app_body();
    $action = strtolower(trim((string) ($body['action'] ?? '')));
    $reason = trim((string) ($body['reason'] ?? $body['disabledReason'] ?? ''));
    if (function_exists('mb_substr')) $reason = mb_substr($reason, 0, 255); else $reason = substr($reason, 0, 255);
    $statement = $database->prepare('SELECT * FROM user_accounts WHERE id = ? FOR UPDATE');
    $database->beginTransaction();
    try {
        $statement->execute([$id]);
        $before = $statement->fetch();
        if (!$before) { $database->rollBack(); app_error(404, 'User not found.', 'USER_NOT_FOUND'); }
        switch ($action) {
            case 'lock':
                $hours = app_clamp(app_int($body['hours'] ?? 24, 24), 1, 8760);
                $database->prepare("UPDATE user_accounts SET locked_until = DATE_ADD(NOW(), INTERVAL $hours HOUR), failed_login_attempts = 0, updated_at = NOW(), session_version = session_version + 1 WHERE id = ?")->execute([$id]);
                break;
            case 'unlock':
                $database->prepare('UPDATE user_accounts SET locked_until = NULL, failed_login_attempts = 0, updated_at = NOW(), session_version = session_version + 1 WHERE id = ?')->execute([$id]);
                break;
            case 'disable':
                $database->prepare('UPDATE user_accounts SET disabled_at = NOW(), disabled_reason = ?, updated_at = NOW(), session_version = session_version + 1 WHERE id = ?')->execute([$reason, $id]);
                break;
            case 'enable':
                $database->prepare("UPDATE user_accounts SET disabled_at = NULL, disabled_reason = '', locked_until = NULL, failed_login_attempts = 0, updated_at = NOW(), session_version = session_version + 1 WHERE id = ?")->execute([$id]);
                break;
            case 'reset-password':
                $password = (string) ($body['newPassword'] ?? '');
                if (strlen($password) < 10 || strlen($password) > 128) { $database->rollBack(); app_error(400, '密码长度必须为 10 至 128 位。', 'PASSWORD_INVALID'); }
                $database->prepare('UPDATE user_accounts SET password_hash = ?, locked_until = NULL, failed_login_attempts = 0, updated_at = NOW(), session_version = session_version + 1 WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
                break;
            default:
                $database->rollBack(); app_error(400, 'Unsupported user action.', 'INVALID_USER_ACTION');
        }
        $afterStatement = $database->prepare('SELECT * FROM user_accounts WHERE id = ?');
        $afterStatement->execute([$id]);
        $after = $afterStatement->fetch() ?: null;
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    app_audit_set_change('user_account', $id, $before, $after, strtoupper($action) . ' user_account');
    app_json(['success' => true, 'user' => app_user_admin_row($after ?: [])]);
}

function app_admin_user_delete(int $id): void
{
    app_require_schema_014();
    $body = app_body();
    if (!app_bool($body['confirm'] ?? false)) app_error(400, '请确认删除该账号，此操作不可撤销。', 'DELETE_CONFIRMATION_REQUIRED');
    $statement = app_db()->prepare('SELECT * FROM user_accounts WHERE id = ?');
    $statement->execute([$id]);
    $before = $statement->fetch();
    if (!$before) app_error(404, 'User not found.', 'USER_NOT_FOUND');
    app_db()->prepare('DELETE FROM user_accounts WHERE id = ?')->execute([$id]);
    app_audit_set_change('user_account', $id, $before, null, 'DELETE user_account');
    app_json(['success' => true, 'id' => $id]);
}
