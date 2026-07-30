<?php

declare(strict_types=1);

const APP_ANALYTICS_RETENTION_DAYS = 180;
const APP_ANALYTICS_MAX_ROWS = 50000;

function app_analytics_record_visit(): array
{
    $body = app_body();
    $path = app_analytics_path((string) ($body['path'] ?? '/'));
    if ($path === null || app_analytics_is_bot((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
        return ['recorded' => false];
    }

    $visitorToken = trim((string) ($body['visitorId'] ?? ''));
    if (!preg_match('/^[a-zA-Z0-9_-]{16,100}$/', $visitorToken)) {
        return ['recorded' => false];
    }

    $secret = (string) (app_config()['app']['setup_key'] ?? app_config()['app']['session_name'] ?? 'site-analytics');
    $visitorHash = hash_hmac('sha256', $visitorToken, $secret, true);
    $duplicate = app_db()->prepare('SELECT id FROM site_visits WHERE visitor_hash = ? AND path = ? AND visited_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND) LIMIT 1');
    $duplicate->execute([$visitorHash, $path]);
    if ($duplicate->fetchColumn()) return ['recorded' => false];

    $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $client = app_analytics_client($userAgent, app_int($body['screenWidth'] ?? 0));
    $title = app_analytics_text((string) ($body['title'] ?? ''), 120);
    $referrerHost = app_analytics_referrer_host((string) ($body['referrerHost'] ?? ''));
    $statement = app_db()->prepare('INSERT INTO site_visits (visitor_hash, path, page_title, referrer_host, device_type, browser, operating_system, screen_width, visited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())');
    $statement->execute([
        $visitorHash,
        $path,
        $title,
        $referrerHost,
        $client['device'],
        $client['browser'],
        $client['os'],
        $client['screenWidth'],
    ]);

    app_analytics_maybe_cleanup();
    return ['recorded' => true];
}

function app_analytics_report(): array
{
    $range = app_int($_GET['range'] ?? 30, 30);
    if (!in_array($range, [7, 30, 90], true)) $range = 30;
    $since = "DATE_SUB(CURDATE(), INTERVAL " . ($range - 1) . " DAY)";

    $summary = app_db()->query("SELECT
        (SELECT COUNT(*) FROM site_visits) AS total_views,
        COUNT(*) AS period_views,
        COUNT(DISTINCT visitor_hash) AS period_visitors,
        SUM(CASE WHEN visited_at >= CURDATE() THEN 1 ELSE 0 END) AS today_views,
        COUNT(DISTINCT CASE WHEN visited_at >= CURDATE() THEN visitor_hash END) AS today_visitors
        FROM site_visits WHERE visited_at >= $since")->fetch() ?: [];

    $daily = app_db()->query("SELECT DATE(visited_at) AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
        FROM site_visits WHERE visited_at >= $since GROUP BY DATE(visited_at) ORDER BY day")->fetchAll();
    $dailyByDate = [];
    foreach ($daily as $row) $dailyByDate[(string) $row['day']] = $row;
    $daily = [];
    for ($offset = $range - 1; $offset >= 0; $offset--) {
        $day = date('Y-m-d', strtotime("-$offset days"));
        $row = $dailyByDate[$day] ?? null;
        $daily[] = ['date' => $day, 'views' => (int) ($row['views'] ?? 0), 'visitors' => (int) ($row['visitors'] ?? 0)];
    }

    $topPages = app_db()->query("SELECT path, MAX(page_title) AS title, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
        FROM site_visits WHERE visited_at >= $since GROUP BY path ORDER BY views DESC LIMIT 12")->fetchAll();
    $referrers = app_db()->query("SELECT IF(referrer_host = '', '直接访问', referrer_host) AS name, COUNT(*) AS views
        FROM site_visits WHERE visited_at >= $since GROUP BY referrer_host ORDER BY views DESC LIMIT 10")->fetchAll();
    $devices = app_analytics_grouped_report('device_type', $since, 8);
    $browsers = app_analytics_grouped_report('browser', $since, 8);
    $systems = app_analytics_grouped_report('operating_system', $since, 8);
    $hours = app_db()->query("SELECT HOUR(visited_at) AS hour, COUNT(*) AS views FROM site_visits WHERE visited_at >= $since GROUP BY HOUR(visited_at) ORDER BY hour")->fetchAll();
    $hourMap = [];
    foreach ($hours as $row) $hourMap[(int) $row['hour']] = (int) $row['views'];
    $hours = [];
    for ($hour = 0; $hour < 24; $hour++) $hours[] = ['hour' => $hour, 'views' => $hourMap[$hour] ?? 0];

    $recent = app_db()->query("SELECT path, page_title, referrer_host, device_type, browser, operating_system, screen_width, visited_at,
        SUBSTRING(HEX(visitor_hash), 1, 10) AS visitor
        FROM site_visits ORDER BY visited_at DESC LIMIT 40")->fetchAll();

    return [
        'range' => $range,
        'summary' => [
            'totalViews' => (int) ($summary['total_views'] ?? 0),
            'periodViews' => (int) ($summary['period_views'] ?? 0),
            'periodVisitors' => (int) ($summary['period_visitors'] ?? 0),
            'todayViews' => (int) ($summary['today_views'] ?? 0),
            'todayVisitors' => (int) ($summary['today_visitors'] ?? 0),
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
        'recent' => array_map(static function (array $row): array {
            return [
                'path' => $row['path'], 'title' => $row['page_title'], 'referrer' => $row['referrer_host'],
                'device' => $row['device_type'], 'browser' => $row['browser'], 'os' => $row['operating_system'],
                'screenWidth' => (int) $row['screen_width'], 'visitor' => $row['visitor'], 'visitedAt' => app_now_iso($row['visited_at']),
            ];
        }, $recent),
    ];
}

function app_analytics_dashboard_summary(): array
{
    $row = app_db()->query("SELECT COUNT(*) AS total_visits, SUM(visited_at >= CURDATE()) AS today_visits, COUNT(DISTINCT CASE WHEN visited_at >= CURDATE() THEN visitor_hash END) AS today_visitors FROM site_visits")->fetch() ?: [];
    return [
        'totalVisits' => (int) ($row['total_visits'] ?? 0),
        'todayVisits' => (int) ($row['today_visits'] ?? 0),
        'todayVisitors' => (int) ($row['today_visitors'] ?? 0),
    ];
}

function app_analytics_grouped_report(string $column, string $since, int $limit): array
{
    $allowed = ['device_type', 'browser', 'operating_system'];
    if (!in_array($column, $allowed, true)) return [];
    $rows = app_db()->query("SELECT $column AS name, COUNT(*) AS views FROM site_visits WHERE visited_at >= $since GROUP BY $column ORDER BY views DESC LIMIT $limit")->fetchAll();
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

function app_analytics_maybe_cleanup(): void
{
    try {
        if (random_int(1, 200) !== 1) return;
        app_db()->exec('DELETE FROM site_visits WHERE visited_at < DATE_SUB(NOW(), INTERVAL ' . APP_ANALYTICS_RETENTION_DAYS . ' DAY) LIMIT 2000');
        $count = (int) app_db()->query('SELECT COUNT(*) FROM site_visits')->fetchColumn();
        $excess = min(5000, max(0, $count - APP_ANALYTICS_MAX_ROWS));
        if ($excess > 0) app_db()->exec("DELETE FROM site_visits ORDER BY id ASC LIMIT $excess");
    } catch (Throwable $error) {
        error_log('Analytics cleanup failed: ' . $error->getMessage());
    }
}
