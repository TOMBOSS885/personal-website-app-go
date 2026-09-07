<?php

declare(strict_types=1);

const APP_AUDIT_MAX_ROWS = 200000;

/**
 * Audit logging for administrator authentication and API activity.
 *
 * This module deliberately records request metadata only. Passwords, CSRF
 * tokens, request bodies, and uploaded file contents are never persisted.
 */

function app_audit_context(): array
{
    static $context = [
        'route' => '',
        'method' => '',
        'username' => '',
        'eventType' => 'admin_request',
        'action' => '',
        'adminId' => null,
        'resourceType' => '',
        'resourceId' => null,
        'message' => '',
        'details' => null,
        'success' => null,
    ];
    return $context;
}

function app_audit_set_context(array $values): void
{
    $context = app_audit_current_context();
    foreach ($values as $key => $value) {
        if (array_key_exists($key, $context)) $context[$key] = $value;
    }
    $GLOBALS['app_audit_context'] = $context;
}

function app_audit_current_context(): array
{
    return is_array($GLOBALS['app_audit_context'] ?? null)
        ? $GLOBALS['app_audit_context']
        : app_audit_context();
}

function app_audit_request_start(string $route, string $method): void
{
    app_audit_set_context([
        'route' => $route,
        'method' => $method,
        'eventType' => str_starts_with($route, 'auth/') ? 'authentication' : (str_starts_with($route, 'creator/') ? 'content_request' : 'admin_request'),
        'action' => $method . ' ' . $route,
    ]);
}

function app_audit_login_attempt(string $username): void
{
    app_audit_set_context([
        'username' => function_exists('mb_substr') ? mb_substr($username, 0, 100) : substr($username, 0, 100),
        'eventType' => 'authentication',
        'action' => 'LOGIN',
    ]);
}

function app_audit_logout(): void
{
    app_audit_set_context([
        'eventType' => 'authentication',
        'action' => 'LOGOUT',
        'adminId' => !empty($_SESSION['admin_id']) ? (int) $_SESSION['admin_id'] : null,
        'username' => (string) ($_SESSION['admin_username'] ?? ''),
    ]);
}

function app_audit_set_details(array $details): void
{
    app_audit_set_context(['details' => $details]);
}

function app_audit_normalize_value($value, int $depth = 0)
{
    if ($depth > 2) return '[nested]';
    if (is_array($value)) {
        $result = [];
        foreach ($value as $key => $item) {
            $keyString = (string) $key;
            if (preg_match('/password|token|secret|hash|authorization|cookie|_key$/i', $keyString)) {
                $result[$keyString] = $item === null || $item === '' ? $item : '[redacted]';
                continue;
            }
            $result[$keyString] = app_audit_normalize_value($item, $depth + 1);
        }
        return $result;
    }
    if (is_string($value)) {
        if (function_exists('mb_substr')) return mb_substr($value, 0, 4000);
        return substr($value, 0, 4000);
    }
    if (is_scalar($value) || $value === null) return $value;
    return (string) $value;
}

function app_audit_diff(?array $before, ?array $after): array
{
    $before = $before ?? [];
    $after = $after ?? [];
    $keys = array_unique(array_merge(array_keys($before), array_keys($after)));
    $changes = [];
    foreach ($keys as $key) {
        $key = (string) $key;
        if (preg_match('/password|token|secret|hash|authorization|cookie|_key$/i', $key)) {
            if (array_key_exists($key, $before) || array_key_exists($key, $after)) $changes[$key] = ['before' => '[redacted]', 'after' => '[redacted]'];
            continue;
        }
        $old = $before[$key] ?? null;
        $new = $after[$key] ?? null;
        if ($old === $new) continue;
        $changes[$key] = ['before' => app_audit_normalize_value($old), 'after' => app_audit_normalize_value($new)];
    }
    return $changes;
}

function app_audit_prune(PDO $database): void
{
    // Keep the newest 200,000 rows. The primary-key lookup avoids loading log
    // details into PHP and works without a MySQL event scheduler.
    $cutoff = $database->query('SELECT id FROM admin_operation_logs ORDER BY id DESC LIMIT 1 OFFSET ' . APP_AUDIT_MAX_ROWS)->fetchColumn();
    if ($cutoff !== false && $cutoff !== null) {
        $statement = $database->prepare('DELETE FROM admin_operation_logs WHERE id <= ?');
        $statement->execute([(int) $cutoff]);
    }
    // Retain the existing age cleanup as a second bound for stale data that
    // may have been imported from an older backup.
    $database->exec('DELETE FROM admin_operation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR) LIMIT 5000');
}

function app_audit_set_change(string $resourceType, ?int $resourceId, ?array $before, ?array $after, string $action): void
{
    app_audit_set_context([
        'resourceType' => $resourceType,
        'resourceId' => $resourceId,
        'action' => $action,
    ]);
    app_audit_set_details([
        'resourceType' => $resourceType,
        'resourceId' => $resourceId,
        'changes' => app_audit_diff($before, $after),
    ]);
}

function app_audit_db_row(string $table, ?int $id = null): ?array
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) return null;
    $sql = $id === null ? "SELECT * FROM `$table` LIMIT 1" : "SELECT * FROM `$table` WHERE id = ?";
    $statement = app_db()->prepare($sql);
    $id === null ? $statement->execute() : $statement->execute([$id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function app_audit_route_parts(string $route): array
{
    $parts = explode('/', trim($route, '/'));
    $resourceType = $parts[1] ?? '';
    $resourceId = null;
    foreach ($parts as $part) {
        if (preg_match('/^\d+$/', $part)) {
            $resourceId = (int) $part;
            break;
        }
    }
    return [$resourceType, $resourceId];
}

function app_audit_insert(int $statusCode = 200, ?bool $success = null, string $message = ''): void
{
    $context = app_audit_current_context();
    $route = (string) ($context['route'] ?? '');
    // Creator operations are authenticated user actions too. Keep them in the
    // shared audit table so article/project ownership changes are traceable.
    if ($route === '' || (!str_starts_with($route, 'admin/') && !str_starts_with($route, 'auth/') && !str_starts_with($route, 'creator/'))) return;

    $resourceType = (string) ($context['resourceType'] ?? '');
    $resourceId = $context['resourceId'] ?? null;
    if ($resourceType === '') [$resourceType, $resourceId] = app_audit_route_parts($route);
    $success = $success ?? ($context['success'] ?? ($statusCode >= 200 && $statusCode < 400));
    $adminId = $context['adminId'] ?? (!empty($_SESSION['admin_id']) ? (int) $_SESSION['admin_id'] : null);
    $username = (string) ($context['username'] ?? ($_SESSION['admin_username'] ?? ($_SESSION['user_email'] ?? '')));
    $userAgent = trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (function_exists('mb_substr')) $userAgent = mb_substr($userAgent, 0, 512);
    else $userAgent = substr($userAgent, 0, 512);
    $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    if (!filter_var($ip, FILTER_VALIDATE_IP)) $ip = 'unknown';
    $message = trim($message !== '' ? $message : (string) ($context['message'] ?? ''));
    if (function_exists('mb_substr')) $message = mb_substr($message, 0, 500);
    else $message = substr($message, 0, 500);

    try {
        $database = app_db();
        $details = $context['details'] ?? null;
        if ($details === null && !in_array((string) ($context['method'] ?? 'GET'), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $details = ['submitted' => app_audit_normalize_value($GLOBALS['app_request_body'] ?? [])];
        }
        $detailsJson = $details === null ? null : json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_string($detailsJson)) $detailsJson = null;
        if (is_string($detailsJson) && strlen($detailsJson) > 64000) $detailsJson = substr($detailsJson, 0, 64000);
        $statement = $database->prepare(
            'INSERT INTO admin_operation_logs
                (event_type, action, admin_id, username, ip_address, user_agent, http_method, route,
                 resource_type, resource_id, status_code, success, message, details_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
        );
        $statement->execute([
            (string) ($context['eventType'] ?? (str_starts_with($route, 'creator/') ? 'content_request' : 'admin_request')),
            (string) ($context['action'] ?? ((string) ($context['method'] ?? '') . ' ' . $route)),
            $adminId,
            $username,
            $ip,
            $userAgent,
            (string) ($context['method'] ?? ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            $route,
            $resourceType,
            $resourceId,
            $statusCode,
            $success ? 1 : 0,
            $message,
            $detailsJson,
        ]);
        // Retention is enforced during writes and reads so shared hosting does
        // not require a privileged MySQL event scheduler configuration.
        app_audit_prune($database);
    } catch (Throwable $error) {
        // Auditing must never turn a valid admin operation into a 500 response.
        error_log('Admin audit log failed: ' . $error->getMessage());
    }
}

function app_audit_register_shutdown(): void
{
    static $registered = false;
    if ($registered) return;
    $registered = true;
    register_shutdown_function(static function (): void {
        $route = (string) (app_audit_current_context()['route'] ?? '');
        if ($route === '') return;
        $status = http_response_code();
        $fatal = error_get_last();
        if (is_array($fatal) && in_array((int) ($fatal['type'] ?? 0), [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            $status = 500;
        }
        app_audit_insert(is_int($status) && $status > 0 ? $status : 200);
    });
}

function app_audit_logs(): array
{
    $database = app_db();
    app_audit_prune($database);
    $page = max(0, app_int($_GET['page'] ?? 0));
    $size = app_clamp(app_int($_GET['size'] ?? 50, 50), 1, 100);
    $eventType = trim((string) ($_GET['eventType'] ?? ''));
    $success = (string) ($_GET['success'] ?? '');
    $where = ['1=1'];
    $params = [];
    if (in_array($eventType, ['authentication', 'admin_request', 'content_request'], true)) {
        $where[] = 'event_type = ?';
        $params[] = $eventType;
    }
    if ($success === '1' || $success === '0') {
        $where[] = 'success = ?';
        $params[] = (int) $success;
    }
    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $search = function_exists('mb_substr') ? mb_substr($search, 0, 80) : substr($search, 0, 80);
        $where[] = '(username LIKE ? OR route LIKE ? OR action LIKE ? OR ip_address LIKE ?)';
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
        array_push($params, $like, $like, $like, $like);
    }
    $condition = implode(' AND ', $where);
    $count = $database->prepare("SELECT COUNT(*) FROM admin_operation_logs WHERE $condition");
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    $statement = $database->prepare(
        "SELECT id, event_type, action, admin_id, username, ip_address, user_agent, http_method, route,
                resource_type, resource_id, status_code, success, message, details_json, created_at
         FROM admin_operation_logs WHERE $condition ORDER BY id DESC LIMIT $size OFFSET " . ($page * $size)
    );
    $statement->execute($params);
    $rows = array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'eventType' => (string) $row['event_type'],
            'action' => (string) $row['action'],
            'adminId' => $row['admin_id'] === null ? null : (int) $row['admin_id'],
            'username' => (string) $row['username'],
            'ipAddress' => (string) $row['ip_address'],
            'userAgent' => (string) $row['user_agent'],
            'httpMethod' => (string) $row['http_method'],
            'route' => (string) $row['route'],
            'resourceType' => (string) $row['resource_type'],
            'resourceId' => $row['resource_id'] === null ? null : (int) $row['resource_id'],
            'statusCode' => (int) $row['status_code'],
            'success' => (bool) $row['success'],
            'message' => (string) $row['message'],
            'details' => $row['details_json'] ? (json_decode((string) $row['details_json'], true) ?: null) : null,
            'createdAt' => app_now_iso($row['created_at']),
        ];
    }, $statement->fetchAll());
    return app_page($rows, $total, $size, $page);
}
