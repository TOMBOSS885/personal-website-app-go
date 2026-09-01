<?php

declare(strict_types=1);

const APP_ANALYTICS_RETENTION_DAYS = 365;
const APP_ANALYTICS_MAX_ROWS = 50000;
const APP_ANALYTICS_RATE_WINDOW_SECONDS = 300;
const APP_ANALYTICS_RATE_LIMIT = 30;
const APP_ANALYTICS_PEER_RATE_LIMIT = 150;
const APP_ANALYTICS_DEDUP_SECONDS = 30;
const APP_ANALYTICS_REPORT_CACHE_SECONDS = 30;
const APP_ANALYTICS_MAX_BODY_BYTES = 4096;
const APP_ANALYTICS_MAX_TRANSFER_BYTES = 8388608;
const APP_ANALYTICS_VISITOR_COOKIE = 'site_analytics_visitor';

function app_analytics_record_visit(): array
{
    if (app_analytics_is_bot((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')) || !app_analytics_same_origin_request()) {
        return ['recorded' => false];
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > APP_ANALYTICS_MAX_BODY_BYTES) {
        app_error(413, '请求内容超过统计接口限制', 'REQUEST_TOO_LARGE');
    }
    if (!app_analytics_rate_limit_allow()) return ['recorded' => false, 'rateLimited' => true];

    $body = app_analytics_body();
    $path = app_analytics_path((string) ($body['path'] ?? '/'));
    if ($path === null) return ['recorded' => false];

    $visitorToken = trim((string) ($body['visitorId'] ?? ''));
    if (!preg_match('/^[a-zA-Z0-9_-]{16,100}$/', $visitorToken)) {
        return ['recorded' => false];
    }

    $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');

    // A signed cookie provides stable browser identity. Network identity is
    // kept separately for rate limiting so rotating cookies cannot bypass it.
    $visitorHash = app_analytics_visitor_hash($visitorToken);
    $transferredBytes = app_analytics_transfer_bytes($body['transferredBytes'] ?? 0);
    $pathHash = hash('sha256', $path, true);
    $client = app_analytics_client($userAgent, app_int($body['screenWidth'] ?? 0));
    $title = app_analytics_text((string) ($body['title'] ?? ''), 120);
    $referrerHost = app_analytics_referrer_host((string) ($body['referrerHost'] ?? ''));
    $userId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    $userEmail = $userId !== null ? (string) ($_SESSION['user_email'] ?? '') : '';
    $isAuthenticated = $userId !== null ? 1 : 0;

    $database = app_db();
    $database->beginTransaction();
    try {
        $dedup = $database->prepare('INSERT INTO site_visit_dedup (visitor_hash, path_hash, last_visited_at) VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_visited_at = IF(
                last_visited_at < DATE_SUB(VALUES(last_visited_at), INTERVAL ' . APP_ANALYTICS_DEDUP_SECONDS . ' SECOND),
                VALUES(last_visited_at),
                last_visited_at
            )');
        $dedup->execute([$visitorHash, $pathHash]);
        if ($dedup->rowCount() === 0) {
            $database->commit();
            return ['recorded' => false];
        }

        $statement = $database->prepare('INSERT INTO site_visits (visitor_hash, user_id, user_email, is_authenticated, path, page_title, referrer_host, device_type, browser, operating_system, screen_width, transferred_bytes, visited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $statement->execute([
            $visitorHash,
            $userId,
            $userEmail,
            $isAuthenticated,
            $path,
            $title,
            $referrerHost,
            $client['device'],
            $client['browser'],
            $client['os'],
            $client['screenWidth'],
            $transferredBytes,
        ]);

        $visitor = $database->prepare('INSERT INTO site_analytics_visitors (visitor_hash, first_seen_at, last_seen_at) VALUES (?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE last_seen_at = NOW()');
        $visitor->execute([$visitorHash]);
        $newVisitor = $visitor->rowCount() === 1 ? 1 : 0;

        $totals = $database->prepare('INSERT INTO site_analytics_totals (id, total_views, total_visitors, estimated_transfer_bytes, updated_at)
            VALUES (1, 1, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                total_views = total_views + 1,
                total_visitors = total_visitors + VALUES(total_visitors),
                estimated_transfer_bytes = estimated_transfer_bytes + VALUES(estimated_transfer_bytes),
                updated_at = NOW()');
        $totals->execute([$newVisitor, $transferredBytes]);
        $database->commit();
    } catch (PDOException $error) {
        if ($database->inTransaction()) $database->rollBack();
        error_log('Analytics deduplication unavailable: ' . $error->getMessage());
        return ['recorded' => false];
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }

    app_analytics_maybe_cleanup();
    return ['recorded' => true];
}

function app_analytics_public_monitor(): array
{
    $cacheKey = 'public-site-monitor-v2';
    $cached = app_analytics_cache_get($cacheKey);
    if ($cached !== null) return $cached;

    try {
        $row = app_db()->query("SELECT
            total_views,
            total_visitors,
            estimated_transfer_bytes,
            updated_at,
            NULLIF(LEAST(
                COALESCE((SELECT MIN(created_at) FROM articles), '9999-12-31 23:59:59'),
                COALESCE((SELECT MIN(first_seen_at) FROM site_analytics_visitors), '9999-12-31 23:59:59'),
                COALESCE((SELECT MIN(visited_at) FROM site_visits), '9999-12-31 23:59:59')
            ), '9999-12-31 23:59:59') AS started_at
            FROM site_analytics_totals WHERE id = 1")->fetch() ?: [];
        $report = [
            'totalViews' => (int) ($row['total_views'] ?? 0),
            'totalVisitors' => (int) ($row['total_visitors'] ?? 0),
            'estimatedTransferBytes' => (int) ($row['estimated_transfer_bytes'] ?? 0),
            'startedAt' => !empty($row['started_at']) ? app_now_iso($row['started_at']) : null,
            'updatedAt' => !empty($row['updated_at']) ? app_now_iso($row['updated_at']) : null,
        ];
    } catch (PDOException $error) {
        // Keep the public page usable during a rolling deployment. Traffic is
        // unavailable until migration 008 has added the aggregate tables.
        $row = app_db()->query('SELECT COUNT(*) AS total_views, COUNT(DISTINCT visitor_hash) AS total_visitors, MIN(visited_at) AS started_at FROM site_visits')->fetch() ?: [];
        $report = [
            'totalViews' => (int) ($row['total_views'] ?? 0),
            'totalVisitors' => (int) ($row['total_visitors'] ?? 0),
            'estimatedTransferBytes' => 0,
            'startedAt' => !empty($row['started_at']) ? app_now_iso($row['started_at']) : null,
            'updatedAt' => null,
        ];
    }

    app_analytics_cache_set($cacheKey, $report);
    return $report;
}

function app_analytics_report(): array
{
    $range = app_int($_GET['range'] ?? 30, 30);
    if (!in_array($range, [7, 30, 90, 365], true)) $range = 30;
    $userSearch = trim((string) ($_GET['userSearch'] ?? ''));
    $authenticated = (string) ($_GET['authenticated'] ?? '');
    $cacheKey = 'report-' . $range . '-' . md5($userSearch . '|' . $authenticated);
    $cached = app_analytics_cache_get($cacheKey);
    if ($cached !== null) return $cached;
    $since = "DATE_SUB(CURDATE(), INTERVAL " . ($range - 1) . " DAY)";

    $filters = ["visited_at >= $since"];
    $params = [];
    if ($userSearch !== '') { $filters[] = '(user_email LIKE ? OR CAST(user_id AS CHAR) = ?)'; $params[] = '%' . $userSearch . '%'; $params[] = $userSearch; }
    if ($authenticated === '1') $filters[] = 'is_authenticated = 1';
    if ($authenticated === '0') $filters[] = 'is_authenticated = 0';
    $where = implode(' AND ', $filters);
    $summaryStatement = app_db()->prepare("SELECT
        (SELECT total_views FROM site_analytics_totals WHERE id = 1) AS total_views,
        COUNT(*) AS period_views,
        COUNT(DISTINCT visitor_hash) AS period_visitors,
        SUM(CASE WHEN visited_at >= CURDATE() THEN 1 ELSE 0 END) AS today_views,
        COUNT(DISTINCT CASE WHEN visited_at >= CURDATE() THEN visitor_hash END) AS today_visitors,
        COUNT(DISTINCT CASE WHEN is_authenticated = 1 THEN user_id END) AS authenticated_users,
        SUM(CASE WHEN is_authenticated = 1 THEN 1 ELSE 0 END) AS authenticated_views
        FROM site_visits WHERE $where");
    $summaryStatement->execute($params);
    $summary = $summaryStatement->fetch() ?: [];

    $dailyStatement = app_db()->prepare("SELECT DATE(visited_at) AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
        FROM site_visits WHERE $where GROUP BY DATE(visited_at) ORDER BY day");
    $dailyStatement->execute($params);
    $daily = $dailyStatement->fetchAll();
    $dailyByDate = [];
    foreach ($daily as $row) $dailyByDate[(string) $row['day']] = $row;
    $daily = [];
    for ($offset = $range - 1; $offset >= 0; $offset--) {
        $day = date('Y-m-d', strtotime("-$offset days"));
        $row = $dailyByDate[$day] ?? null;
        $daily[] = ['date' => $day, 'views' => (int) ($row['views'] ?? 0), 'visitors' => (int) ($row['visitors'] ?? 0)];
    }

    $topPagesStatement = app_db()->prepare("SELECT path, MAX(page_title) AS title, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
        FROM site_visits WHERE $where GROUP BY path ORDER BY views DESC LIMIT 12");
    $topPagesStatement->execute($params);
    $topPages = $topPagesStatement->fetchAll();
    $referrersStatement = app_db()->prepare("SELECT IF(referrer_host = '', '直接访问', referrer_host) AS name, COUNT(*) AS views
        FROM site_visits WHERE $where GROUP BY referrer_host ORDER BY views DESC LIMIT 10");
    $referrersStatement->execute($params);
    $referrers = $referrersStatement->fetchAll();
    $devices = app_analytics_grouped_report('device_type', $where, $params, 8);
    $browsers = app_analytics_grouped_report('browser', $where, $params, 8);
    $systems = app_analytics_grouped_report('operating_system', $where, $params, 8);
    $hoursStatement = app_db()->prepare("SELECT HOUR(visited_at) AS hour, COUNT(*) AS views FROM site_visits WHERE $where GROUP BY HOUR(visited_at) ORDER BY hour");
    $hoursStatement->execute($params);
    $hours = $hoursStatement->fetchAll();
    $hourMap = [];
    foreach ($hours as $row) $hourMap[(int) $row['hour']] = (int) $row['views'];
    $hours = [];
    for ($hour = 0; $hour < 24; $hour++) $hours[] = ['hour' => $hour, 'views' => $hourMap[$hour] ?? 0];

    $recentStatement = app_db()->prepare("SELECT path, page_title, referrer_host, device_type, browser, operating_system, screen_width, visited_at,
        SUBSTRING(HEX(visitor_hash), 1, 10) AS visitor, user_id, user_email, is_authenticated
        FROM site_visits WHERE $where ORDER BY visited_at DESC LIMIT 100");
    $recentStatement->execute($params);
    $recent = $recentStatement->fetchAll();
    $usersStatement = app_db()->prepare("SELECT user_id, user_email, COUNT(*) AS views, MAX(visited_at) AS last_visited_at
        FROM site_visits WHERE $where AND is_authenticated = 1 GROUP BY user_id, user_email ORDER BY last_visited_at DESC LIMIT 100");
    $usersStatement->execute($params);
    $users = array_map(static function (array $row): array {
        return ['userId' => (int) $row['user_id'], 'email' => (string) $row['user_email'], 'views' => (int) $row['views'], 'lastVisitedAt' => app_now_iso($row['last_visited_at'])];
    }, $usersStatement->fetchAll());

    $report = [
        'range' => $range,
        'summary' => [
            'totalViews' => (int) ($summary['total_views'] ?? 0),
            'periodViews' => (int) ($summary['period_views'] ?? 0),
            'periodVisitors' => (int) ($summary['period_visitors'] ?? 0),
            'todayViews' => (int) ($summary['today_views'] ?? 0),
            'todayVisitors' => (int) ($summary['today_visitors'] ?? 0),
            'authenticatedUsers' => (int) ($summary['authenticated_users'] ?? 0),
            'authenticatedViews' => (int) ($summary['authenticated_views'] ?? 0),
        ],
        'daily' => $daily,
        'topPages' => array_map(static function (array $row): array {
            return ['path' => $row['path'], 'title' => $row['title'], 'views' => (int) $row['views'], 'visitors' => (int) $row['visitors']];
        }, $topPages),
        'referrers' => $referrers,
        'devices' => $devices,
        'browsers' => $browsers,
        'systems' => $systems,
        'hours' => $hours,
        'users' => $users,
        'recent' => array_map(static function (array $row): array {
            return [
                'path' => $row['path'], 'title' => $row['page_title'], 'referrer' => $row['referrer_host'],
                'device' => $row['device_type'], 'browser' => $row['browser'], 'os' => $row['operating_system'],
                'screenWidth' => (int) $row['screen_width'], 'visitor' => $row['visitor'], 'visitedAt' => app_now_iso($row['visited_at']),
                'userId' => !empty($row['user_id']) ? (int) $row['user_id'] : null, 'userEmail' => (string) ($row['user_email'] ?? ''), 'authenticated' => (bool) ($row['is_authenticated'] ?? false),
            ];
        }, $recent),
    ];
    app_analytics_cache_set($cacheKey, $report);
    return $report;
}

function app_analytics_dashboard_summary(): array
{
    $row = app_db()->query("SELECT (SELECT total_views FROM site_analytics_totals WHERE id = 1) AS total_visits, SUM(visited_at >= CURDATE()) AS today_visits, COUNT(DISTINCT CASE WHEN visited_at >= CURDATE() THEN visitor_hash END) AS today_visitors FROM site_visits")->fetch() ?: [];
    return [
        'totalVisits' => (int) ($row['total_visits'] ?? 0),
        'todayVisits' => (int) ($row['today_visits'] ?? 0),
        'todayVisitors' => (int) ($row['today_visitors'] ?? 0),
    ];
}

function app_analytics_grouped_report(string $column, string $where, array $params, int $limit): array
{
    $allowed = ['device_type', 'browser', 'operating_system'];
    if (!in_array($column, $allowed, true)) return [];
    $statement = app_db()->prepare("SELECT $column AS name, COUNT(*) AS views FROM site_visits WHERE $where GROUP BY $column ORDER BY views DESC LIMIT $limit");
    $statement->execute($params);
    $rows = $statement->fetchAll();
    return array_map(static function (array $row): array {
        return ['name' => (string) $row['name'], 'views' => (int) $row['views']];
    }, $rows);
}

function app_analytics_path(string $path): ?string
{
    $path = trim((string) (parse_url($path, PHP_URL_PATH) ?: '/'));
    if ($path === '') $path = '/';
    if ($path[0] !== '/' || strlen($path) > 255 || preg_match('#^/(?:admin|api|assets|uploads)(?:/|$)#i', $path)) return null;
    return preg_replace('#/{2,}#', '/', $path);
}

function app_analytics_referrer_host(string $value): string
{
    $host = strtolower(trim($value));
    if ($host === '' || strlen($host) > 190 || !preg_match('/^[a-z0-9.-]+(?::\d{1,5})?$/', $host)) return '';
    $current = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    return preg_replace('/:\d+$/', '', $host) === $current ? '' : $host;
}

function app_analytics_text(string $value, int $length): string
{
    $value = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $value) ?? '');
    return function_exists('mb_substr') ? mb_substr($value, 0, $length) : substr($value, 0, $length);
}

function app_analytics_client(string $userAgent, int $screenWidth): array
{
    $browser = '其他';
    if (stripos($userAgent, 'Edg/') !== false) $browser = 'Edge';
    elseif (stripos($userAgent, 'OPR/') !== false || stripos($userAgent, 'Opera') !== false) $browser = 'Opera';
    elseif (stripos($userAgent, 'Firefox/') !== false) $browser = 'Firefox';
    elseif (stripos($userAgent, 'Chrome/') !== false || stripos($userAgent, 'CriOS/') !== false) $browser = 'Chrome';
    elseif (stripos($userAgent, 'Safari/') !== false) $browser = 'Safari';

    $os = '其他';
    if (stripos($userAgent, 'Windows') !== false) $os = 'Windows';
    elseif (stripos($userAgent, 'Android') !== false) $os = 'Android';
    elseif (preg_match('/iPhone|iPad|iPod/i', $userAgent)) $os = 'iOS';
    elseif (stripos($userAgent, 'Mac OS') !== false) $os = 'macOS';
    elseif (stripos($userAgent, 'Linux') !== false) $os = 'Linux';

    $screenWidth = app_clamp($screenWidth, 0, 65535);
    $device = preg_match('/iPad|Tablet/i', $userAgent) ? '平板' : (preg_match('/Mobile|Android|iPhone|iPod/i', $userAgent) || ($screenWidth > 0 && $screenWidth < 768) ? '手机' : '电脑');
    return ['browser' => $browser, 'os' => $os, 'device' => $device, 'screenWidth' => $screenWidth];
}

function app_analytics_is_bot(string $userAgent): bool
{
    return $userAgent === '' || (bool) preg_match('/bot|crawler|spider|slurp|headless|preview|monitor/i', $userAgent);
}

function app_analytics_rate_limit_allow(): bool
{
    $bucket = (int) floor(time() / APP_ANALYTICS_RATE_WINDOW_SECONDS);
    try {
        $limits = [
            ['client|' . app_analytics_remote_network(), APP_ANALYTICS_RATE_LIMIT],
            ['peer|' . app_analytics_remote_network(true), APP_ANALYTICS_PEER_RATE_LIMIT],
        ];
        foreach ($limits as [$identity, $limit]) {
            $rateKey = hash_hmac('sha256', 'rate|' . $identity, app_analytics_secret(), true);
            $statement = app_db()->prepare('INSERT INTO analytics_rate_limits (rate_key, window_bucket, request_count, updated_at)
                VALUES (?, ?, 1, NOW())
                ON DUPLICATE KEY UPDATE request_count = LAST_INSERT_ID(LEAST(request_count + 1, 65535)), updated_at = NOW()');
            $statement->execute([$rateKey, $bucket]);
            if ($statement->rowCount() !== 1 && (int) app_db()->query('SELECT LAST_INSERT_ID()')->fetchColumn() > $limit) return false;
        }
        return true;
    } catch (PDOException $error) {
        // During a rolling deployment, fail closed until migration 006 is imported.
        error_log('Analytics rate limiting unavailable: ' . $error->getMessage());
        return false;
    }
}

function app_analytics_transfer_bytes($value): int
{
    if (is_string($value) && !preg_match('/^\d{1,12}$/', $value)) return 0;
    if (!is_int($value) && !is_float($value) && !is_string($value)) return 0;
    return app_clamp((int) $value, 0, APP_ANALYTICS_MAX_TRANSFER_BYTES);
}

function app_analytics_body(): array
{
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > APP_ANALYTICS_MAX_BODY_BYTES) app_error(413, '请求内容超过统计接口限制', 'REQUEST_TOO_LARGE');
    $raw = file_get_contents('php://input', false, null, 0, APP_ANALYTICS_MAX_BODY_BYTES + 1);
    if ($raw === false || trim($raw) === '') return [];
    if (strlen($raw) > APP_ANALYTICS_MAX_BODY_BYTES) app_error(413, '请求内容超过统计接口限制', 'REQUEST_TOO_LARGE');
    $data = json_decode($raw, true);
    if (!is_array($data)) app_error(400, '请求 JSON 格式错误', 'INVALID_JSON');
    return $data;
}

function app_analytics_same_origin_request(): bool
{
    $fetchSite = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
    if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) return false;

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return true;
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $requestHost = strtolower(preg_replace('/:\d+$/', '', trim((string) ($_SERVER['HTTP_HOST'] ?? ''))));
    return $originHost !== '' && $requestHost !== '' && hash_equals($requestHost, $originHost);
}

function app_analytics_visitor_hash(string $visitorToken): string
{
    $cookie = trim((string) ($_COOKIE[APP_ANALYTICS_VISITOR_COOKIE] ?? ''));
    if (preg_match('/^([a-f0-9]{64})\.([a-f0-9]{64})$/', $cookie, $matches)) {
        $expected = hash_hmac('sha256', 'visitor-cookie|' . $matches[1], app_analytics_secret());
        if (hash_equals($expected, $matches[2])) return hex2bin($matches[1]);
    }

    // Preserve the previous identity on the first request after upgrading,
    // then bind it to a signed, long-lived browser cookie.
    $visitorHash = hash_hmac('sha256', $visitorToken, app_analytics_legacy_secret(), true);
    $payload = bin2hex($visitorHash);
    $signature = hash_hmac('sha256', 'visitor-cookie|' . $payload, app_analytics_secret());
    setcookie(APP_ANALYTICS_VISITOR_COOKIE, $payload . '.' . $signature, [
        'expires' => time() + 31536000,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    return $visitorHash;
}

function app_analytics_remote_network(bool $_peerOnly = false): string
{
    // This shared-host deployment does not use a trusted reverse-proxy chain.
    // Forwarded client-IP headers are therefore untrusted and intentionally ignored.
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if (!filter_var($remote, FILTER_VALIDATE_IP)) return 'unknown';
    if (filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) return $remote;

    // Group IPv6 privacy addresses by /64 so rotating the interface identifier
    // does not bypass deduplication or the write limit.
    $packed = inet_pton($remote);
    if ($packed === false || strlen($packed) !== 16) return $remote;
    return bin2hex(substr($packed, 0, 8)) . '::/64';
}

function app_analytics_secret(): string
{
    static $secret;
    if (is_string($secret)) return $secret;
    $config = app_config();
    $app = $config['app'] ?? [];
    $material = trim((string) ($app['analytics_key'] ?? $app['setup_key'] ?? ''));
    if ($material === '') {
        $material = json_encode($config['database'] ?? [], JSON_UNESCAPED_SLASHES) ?: 'local-fallback';
    }
    return $secret = hash('sha256', 'analytics|' . $material);
}

function app_analytics_legacy_secret(): string
{
    static $secret;
    if (is_string($secret)) return $secret;
    $config = app_config();
    $app = $config['app'] ?? [];
    return $secret = (string) ($app['setup_key'] ?? $app['session_name'] ?? 'site-analytics');
}

function app_analytics_cache_get(string $key): ?array
{
    try {
        $statement = app_db()->prepare('SELECT payload FROM analytics_report_cache WHERE cache_key = ? AND expires_at > NOW()');
        $statement->execute([$key]);
        $payload = $statement->fetchColumn();
        if (!is_string($payload) || $payload === '') return null;
        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : null;
    } catch (PDOException $error) {
        return null;
    }
}

function app_analytics_cache_set(string $key, array $value): void
{
    $payload = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) return;
    try {
        $statement = app_db()->prepare('INSERT INTO analytics_report_cache (cache_key, payload, expires_at, updated_at)
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' . APP_ANALYTICS_REPORT_CACHE_SECONDS . ' SECOND), NOW())
            ON DUPLICATE KEY UPDATE payload = VALUES(payload), expires_at = VALUES(expires_at), updated_at = NOW()');
        $statement->execute([$key, $payload]);
    } catch (PDOException $error) {
        error_log('Analytics report cache unavailable: ' . $error->getMessage());
    }
}

function app_analytics_maybe_cleanup(): void
{
    try {
        if (random_int(1, 200) !== 1) return;
        app_db()->exec('DELETE FROM site_visits WHERE visited_at < DATE_SUB(NOW(), INTERVAL ' . APP_ANALYTICS_RETENTION_DAYS . ' DAY) LIMIT 2000');
        app_db()->exec('DELETE FROM site_visit_dedup WHERE last_visited_at < DATE_SUB(NOW(), INTERVAL 2 DAY) LIMIT 2000');
        app_db()->exec('DELETE FROM analytics_rate_limits WHERE updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY) LIMIT 2000');
        app_db()->exec('DELETE FROM analytics_report_cache WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');

        // Find the retention boundary through the primary-key index. This avoids
        // a synchronous full-table COUNT in a normal visitor request.
        $cutoff = app_db()->query('SELECT id FROM site_visits ORDER BY id DESC LIMIT 1 OFFSET ' . APP_ANALYTICS_MAX_ROWS)->fetchColumn();
        if ($cutoff !== false) {
            $statement = app_db()->prepare('DELETE FROM site_visits WHERE id <= ? ORDER BY id ASC LIMIT 2000');
            $statement->execute([(int) $cutoff]);
        }
    } catch (Throwable $error) {
        error_log('Analytics cleanup failed: ' . $error->getMessage());
    }
}
