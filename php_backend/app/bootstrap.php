<?php

declare(strict_types=1);

require_once __DIR__ . '/live2d.php';
require_once __DIR__ . '/analytics.php';
require_once __DIR__ . '/article_sites.php';
require_once __DIR__ . '/social.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/user_auth.php';
require_once __DIR__ . '/user_admin.php';

const APP_BACKUP_MAX_ARCHIVE_BYTES = 536870912;
const APP_BACKUP_MAX_FILES = 20000;
const APP_BACKUP_MAX_SETTINGS_BYTES = 65536;

function app_config(): array
{
    static $config;
    if ($config !== null) return $config;

    $path = dirname(__DIR__) . '/config/config.php';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => 'Missing config/config.php. Copy config.example.php and configure the database.', 'code' => 'CONFIG_MISSING'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $config = require $path;
    date_default_timezone_set((string) ($config['app']['timezone'] ?? 'Asia/Shanghai'));
    if (!empty($config['app']['production'])) {
        ini_set('display_errors', '0');
        error_reporting(E_ALL);
    }
    return $config;
}

function app_db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $db = app_config()['database'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $db['port'] ?? 3306, $db['name'], $db['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+08:00'",
    ]);
    return $pdo;
}

function app_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $app = app_config()['app'];
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    session_name((string) ($app['session_name'] ?? 'personal_website_admin'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function app_destroy_session_state(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function app_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function app_json_cached($data, int $maxAge = 30, int $staleAge = 120): void
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) app_error(500, 'Unable to encode response', 'JSON_ENCODING_FAILED');
    $etag = '"' . hash('sha256', $json) . '"';
    header('Cache-Control: public, max-age=' . max(0, $maxAge) . ', stale-while-revalidate=' . max(0, $staleAge));
    header('ETag: ' . $etag);
    if (strpos((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''), $etag) !== false) {
        http_response_code(304);
        exit;
    }
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo $json;
    exit;
}

function app_public_cache_remember(string $key, int $ttl, callable $producer): array
{
    $safeKey = preg_replace('/[^a-z0-9_-]/i', '-', $key);
    $cacheRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\') . '/.cache/api';
    $cachePath = $cacheRoot . '/' . $safeKey . '.json';
    if (is_file($cachePath) && filemtime($cachePath) >= time() - $ttl) {
        $cached = json_decode((string) @file_get_contents($cachePath), true);
        if (is_array($cached)) return $cached;
    }

    $value = $producer();
    if (!is_array($value)) return [];
    try {
        if (!is_dir($cacheRoot) && !mkdir($cacheRoot, 0755, true) && !is_dir($cacheRoot)) return $value;
        $temporary = $cachePath . '.' . bin2hex(random_bytes(4)) . '.tmp';
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($encoded) && file_put_contents($temporary, $encoded, LOCK_EX) !== false) {
            @chmod($temporary, 0644);
            if (!@rename($temporary, $cachePath)) @unlink($temporary);
        }
    } catch (Throwable $error) {
        error_log('Public API cache write failed: ' . $error->getMessage());
    }
    return $value;
}

function app_public_cache_clear(): void
{
    $cacheRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\') . '/.cache/api';
    if (!is_dir($cacheRoot)) return;
    foreach (glob($cacheRoot . '/*.json') ?: [] as $path) {
        if (is_file($path)) @unlink($path);
    }
}

function app_security_secret(string $purpose): string
{
    $config = app_config();
    $material = (string) ($config['app']['setup_key'] ?? '') . '|' . (string) ($config['database']['name'] ?? '');
    return hash('sha256', $purpose . '|' . $material);
}

function app_client_address(): string
{
    // Shared-host deployments do not have a verified proxy chain. Never trust
    // a client-supplied forwarding header for login, unlock, or guestbook limits.
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown';
}

function app_security_client_hash(string $purpose): string
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if (!filter_var($remote, FILTER_VALIDATE_IP)) $remote = 'unknown';
    return hash_hmac('sha256', 'client|' . $purpose . '|' . $remote . '|' . app_client_address(), app_security_secret($purpose), true);
}

function app_security_peer_hash(string $purpose): string
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if (!filter_var($remote, FILTER_VALIDATE_IP)) $remote = 'unknown';
    return hash_hmac('sha256', 'peer|' . $purpose . '|' . $remote, app_security_secret($purpose), true);
}

function app_security_peer_rate_limit_allow(string $purpose, int $limit): bool
{
    $bucket = (int) floor(time() / 300);
    $rateKey = app_security_peer_hash($purpose);
    try {
        $statement = app_db()->prepare('INSERT INTO analytics_rate_limits (rate_key, window_bucket, request_count, updated_at) VALUES (?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE request_count = LAST_INSERT_ID(LEAST(request_count + 1, 65535)), updated_at = NOW()');
        $statement->execute([$rateKey, $bucket]);
        if ($statement->rowCount() === 1) return true;
        return (int) app_db()->query('SELECT LAST_INSERT_ID()')->fetchColumn() <= $limit;
    } catch (PDOException $error) {
        error_log('Security peer rate limit unavailable: ' . $error->getMessage());
        return false;
    }
}

function app_security_maybe_cleanup(): void
{
    try {
        if (random_int(1, 100) !== 1) return;
        app_db()->exec('DELETE FROM admin_login_attempts WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 500');
        app_db()->exec('DELETE FROM article_unlock_attempts WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 500');
    } catch (Throwable $error) {
        error_log('Security attempt cleanup failed: ' . $error->getMessage());
    }
}

function app_error(int $status, string $message, string $code = 'REQUEST_FAILED'): void
{
    if (function_exists('app_audit_set_context')) app_audit_set_context(['message' => $message]);
    app_json(['message' => $message, 'code' => $code], $status);
}

function app_body(): array
{
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 5 * 1024 * 1024) app_error(413, '璇锋眰鍐呭瓒呰繃 5MB 闄愬埗', 'REQUEST_TOO_LARGE');
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    if (strlen($raw) > 5 * 1024 * 1024) app_error(413, '璇锋眰鍐呭瓒呰繃 5MB 闄愬埗', 'REQUEST_TOO_LARGE');
    $data = json_decode($raw, true);
    if (!is_array($data)) app_error(400, '璇锋眰 JSON 鏍煎紡閿欒', 'INVALID_JSON');
    $GLOBALS['app_request_body'] = $data;
    return $data;
}

function app_bool($value): bool
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
}

function app_int($value, int $fallback = 0): int
{
    return is_numeric($value) ? (int) $value : $fallback;
}

function app_clamp(int $value, int $min, int $max): int
{
    return max($min, min($max, $value));
}

function app_now_iso(?string $value): ?string
{
    if (!$value) return null;
    return date(DATE_ATOM, strtotime($value));
}

function app_admin_path_suffix_is_valid(string $value): bool
{
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/', $value)) return false;
    $reserved = ['api', 'assets', 'blog', 'projects', 'search', 'uploads', 'friends', 'guestbook', 'monitor'];
    return !in_array(strtolower($value), $reserved, true);
}

function app_admin_path_suffix_is_routable(string $value): bool
{
    return $value === 'admin' || app_admin_path_suffix_is_valid($value);
}

function app_admin_entry_bootstrap_suffix(): string
{
    $configured = trim((string) (app_config()['app']['admin_path_suffix'] ?? ''));
    return app_admin_path_suffix_is_valid($configured) ? $configured : 'admin';
}

function app_admin_entry_suffix(): string
{
    static $suffix;
    if (is_string($suffix)) return $suffix;

    try {
        $row = app_db()->query('SELECT admin_path_suffix FROM site_settings WHERE id = 1')->fetch();
        $stored = trim((string) ($row['admin_path_suffix'] ?? ''));
        if (app_admin_path_suffix_is_routable($stored)) return $suffix = $stored;

        // Migration 005 intentionally creates an empty table. Existing sites must keep
        // /admin until the administrator explicitly saves a private suffix in the UI.
        return $suffix = 'admin';
    } catch (PDOException $error) {
        // Existing installations may not have run migration 005 yet.
    }

    return $suffix = app_admin_entry_bootstrap_suffix();
}

function app_site_settings_ensure(): void
{
    app_db()->exec("CREATE TABLE IF NOT EXISTS site_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        admin_path_suffix VARCHAR(64) NOT NULL,
        updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $statement = app_db()->prepare('INSERT IGNORE INTO site_settings (id, admin_path_suffix, updated_at) VALUES (1, ?, NOW())');
    $statement->execute([app_admin_entry_suffix()]);
}

function app_admin_security_settings(): array
{
    app_site_settings_ensure();
    $row = app_db()->query('SELECT admin_path_suffix, updated_at FROM site_settings WHERE id = 1')->fetch();
    return [
        'adminPathSuffix' => (string) $row['admin_path_suffix'],
        'updatedAt' => app_now_iso($row['updated_at'] ?? null),
    ];
}

function app_update_admin_security_settings(): array
{
    $body = app_body();
    $suffix = trim((string) ($body['adminPathSuffix'] ?? ''));
    if (!app_admin_path_suffix_is_valid($suffix)) {
        app_error(400, '鍚庡彴鍦板潃鍚庣紑蹇呴』涓?8 鍒?64 浣嶅瓧姣嶃€佹暟瀛椼€佽繛瀛楃鎴栦笅鍒掔嚎锛屼笖涓嶈兘浣跨敤鍏紑椤甸潰鍚嶇О', 'INVALID_ADMIN_PATH');
    }

    app_site_settings_ensure();
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare('SELECT password_hash FROM admin_account WHERE id = ? FOR UPDATE');
        $statement->execute([$_SESSION['admin_id']]);
        $admin = $statement->fetch();
        $password = (string) ($body['currentPassword'] ?? '');
        if (!$admin || strlen($password) > 1024 || !password_verify($password, $admin['password_hash'])) {
            $database->rollBack();
            app_error(400, '褰撳墠绠＄悊鍛樺瘑鐮佷笉姝ｇ‘', 'INVALID_CURRENT_PASSWORD');
        }
        $statement = $database->prepare('UPDATE site_settings SET admin_path_suffix = ?, updated_at = NOW() WHERE id = 1');
        $statement->execute([$suffix]);
        $database->prepare('UPDATE admin_account SET session_version = session_version + 1, updated_at = NOW() WHERE id = ?')->execute([$_SESSION['admin_id']]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    return ['adminPathSuffix' => $suffix, 'loginPath' => '/' . $suffix . '/login', 'requiresLogin' => true];
}

function app_admin_entry_required(): void
{
    $provided = trim((string) ($_SERVER['HTTP_X_ADMIN_ENTRY'] ?? ''));
    if ($provided === '' || !hash_equals(app_admin_entry_suffix(), $provided)) {
        app_error(404, 'Not found', 'NOT_FOUND');
    }
}

function app_admin_required(): void
{
    if (empty($_SESSION['admin_id'])) app_error(401, '璇峰厛鐧诲綍', 'UNAUTHENTICATED');
    $now = time();
    $createdAt = (int) ($_SESSION['admin_created_at'] ?? 0);
    $lastSeenAt = (int) ($_SESSION['admin_last_seen_at'] ?? 0);
    if ($createdAt <= 0 || $lastSeenAt <= 0 || $now - $createdAt > 43200 || $now - $lastSeenAt > 3600) {
        app_destroy_session_state();
        app_error(401, '鐧诲綍鐘舵€佸凡杩囨湡锛岃閲嶆柊鐧诲綍', 'SESSION_EXPIRED');
    }

    $statement = app_db()->prepare('SELECT username, session_version FROM admin_account WHERE id = ?');
    $statement->execute([(int) $_SESSION['admin_id']]);
    $admin = $statement->fetch();
    if (!$admin || !hash_equals((string) ($admin['session_version'] ?? ''), (string) ($_SESSION['admin_session_version'] ?? ''))) {
        app_destroy_session_state();
        app_error(401, '鐧诲綍鐘舵€佸凡澶辨晥锛岃閲嶆柊鐧诲綍', 'SESSION_REVOKED');
    }
    $_SESSION['admin_last_seen_at'] = $now;
    $_SESSION['admin_username'] = (string) $admin['username'];
}

function app_csrf_required(): void
{
    $fetchSite = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
    if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) {
        app_error(403, 'Cross-site admin requests are not allowed.', 'CROSS_SITE_REQUEST_BLOCKED');
    }
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        app_error(403, 'CSRF validation failed. Refresh the admin page and try again.', 'CSRF_FAILED');
    }
}

function app_ensure_csrf(): string
{
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return (string) $_SESSION['csrf_token'];
}

function app_page(array $content, int $total, int $size, int $number): array
{
    $pages = $size > 0 ? (int) ceil($total / $size) : 0;
    return [
        'content' => $content,
        'totalElements' => $total,
        'totalPages' => $pages,
        'size' => $size,
        'number' => $number,
        'first' => $number === 0,
        'last' => $pages === 0 || $number >= $pages - 1,
        'empty' => count($content) === 0,
    ];
}

function app_profile(bool $localized = false): array
{
    $row = app_db()->query('SELECT * FROM site_profile WHERE id = 1')->fetch();
    if (!$row) app_error(500, 'Site profile has not been initialized.', 'PROFILE_MISSING');
    $english = $localized && strtolower((string) ($_GET['lang'] ?? 'zh')) === 'en';
    $result = [
        'id' => (int) $row['id'], 'nickname' => $row['nickname'], 'avatar' => $row['avatar'],
        'bio' => $english && $row['bio_en'] !== '' ? $row['bio_en'] : $row['bio'],
        'location' => $row['location'], 'website' => $row['website'], 'github' => $row['github'],
        'twitter' => $row['twitter'], 'linkedin' => $row['linkedin'], 'emailPublic' => $row['email_public'],
        'tags' => $english && $row['tags_en'] !== '' ? $row['tags_en'] : $row['tags'],
        'welcomeText' => $english && $row['welcome_text_en'] !== '' ? $row['welcome_text_en'] : $row['welcome_text'],
        'ctaTitle' => $english && $row['cta_title_en'] !== '' ? $row['cta_title_en'] : $row['cta_title'],
        'ctaDescription' => $english && $row['cta_description_en'] !== '' ? $row['cta_description_en'] : $row['cta_description'],
        'coffeeCount' => (int) $row['coffee_count'], 'starsCount' => (int) $row['stars_count'],
    ];
    if (!$localized) {
        $result += [
            'bioEn' => $row['bio_en'], 'tagsEn' => $row['tags_en'], 'welcomeTextEn' => $row['welcome_text_en'],
            'ctaTitleEn' => $row['cta_title_en'], 'ctaDescriptionEn' => $row['cta_description_en'],
        ];
    }
    return $result;
}

function app_article_row(array $row, bool $includeContent = true, bool $admin = false): array
{
    $contentType = strtolower((string) ($row['content_type'] ?? 'markdown')) === 'static' ? 'static' : 'markdown';
    $article = [
        'id' => (int) $row['id'], 'title' => $row['title'], 'summary' => $row['summary'],
        'coverImage' => $row['cover_image'], 'category' => $row['category'], 'tags' => $row['tags'],
        'seriesName' => (string) ($row['series_name'] ?? ''), 'seriesOrder' => (int) ($row['series_order'] ?? 0),
        'featured' => (bool) ($row['featured'] ?? false), 'displayOrder' => (int) ($row['display_order'] ?? 0),
        'views' => (int) $row['views'], 'published' => (bool) $row['published'], 'isLocked' => (bool) $row['is_locked'],
        'loginRequired' => (bool) ($row['login_required'] ?? false),
        'contentType' => $contentType, 'createdAt' => app_now_iso($row['created_at']), 'updatedAt' => app_now_iso($row['updated_at']),
    ];
    if ($includeContent) {
        $article['content'] = $contentType === 'static' ? '' : $row['content'];
        if ($contentType === 'static') {
            if ($admin) {
                $article['staticSiteKey'] = (string) ($row['static_site_key'] ?? '');
                $article['staticSiteName'] = (string) ($row['static_site_name'] ?? '');
            } else {
                $article['staticSiteUrl'] = app_article_site_signed_url($row);
            }
        }
    }
    return $article;
}

function app_articles(bool $admin = false): array
{
    app_require_schema_011();
    app_require_schema_013();
    $page = max(0, app_int($_GET['page'] ?? 0));
    $size = app_clamp(app_int($_GET['size'] ?? 10, 10), 1, 100);
    $where = $admin ? ['1=1'] : ['published = 1'];
    $params = [];
    foreach (['category', 'tag'] as $filter) {
        $value = trim((string) ($_GET[$filter] ?? ''));
        if ($value === '') continue;
        if ($filter === 'category') { $where[] = 'category = ?'; $params[] = $value; }
        else { $where[] = 'tags LIKE ?'; $params[] = '%' . $value . '%'; }
    }
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') { $where[] = '(title LIKE ? OR summary LIKE ? OR content LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; }
    $condition = implode(' AND ', $where);
    $count = app_db()->prepare("SELECT COUNT(*) FROM articles WHERE $condition");
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    // List endpoints never need the MEDIUMTEXT body or password hash. Article
    // content is loaded from the detail endpoint only when it is opened.
    $columns = 'id,title,summary,cover_image,category,tags,series_name,series_order,featured,display_order,views,published,login_required,content_type,static_site_key,static_site_name,is_locked,created_at,updated_at';
    $sql = "SELECT $columns FROM articles WHERE $condition ORDER BY created_at DESC LIMIT $size OFFSET " . ($page * $size);
    $statement = app_db()->prepare($sql);
    $statement->execute($params);
    $rows = array_map(function ($row) use ($admin) { return app_article_row($row, false, $admin); }, $statement->fetchAll());
    return app_page($rows, $total, $size, $page);
}

function app_discovery_article_columns(): string
{
    return 'id,title,summary,cover_image,category,tags,series_name,series_order,featured,display_order,views,published,login_required,content_type,is_locked,created_at,updated_at';
}

function app_discovery_articles(string $kind, $requestedLimit = null): array
{
    app_require_schema_011();
    app_require_schema_013();
    $limit = app_clamp($requestedLimit === null ? app_int($_GET['limit'] ?? 6, 6) : app_int($requestedLimit), 1, 20);
    $where = 'published = 1';
    $order = 'views DESC, created_at DESC, id DESC';
    if ($kind === 'featured') {
        $where .= ' AND featured = 1';
        $order = 'display_order ASC, created_at DESC, id DESC';
    }
    $sql = 'SELECT ' . app_discovery_article_columns() . " FROM articles WHERE $where ORDER BY $order LIMIT $limit";
    return array_map(static function (array $row): array {
        return app_article_row($row, false);
    }, app_db()->query($sql)->fetchAll());
}

function app_article_archive(int $yearFilter = 0): array
{
    app_require_schema_011();
    app_require_schema_013();
    if ($yearFilter !== 0 && ($yearFilter < 1970 || $yearFilter > (int) date('Y') + 1)) {
        app_error(400, 'Year is outside the supported archive range.', 'INVALID_YEAR');
    }
    $where = 'published = 1';
    $params = [];
    if ($yearFilter > 0) {
        $where .= ' AND created_at >= ? AND created_at < ?';
        $params[] = sprintf('%04d-01-01 00:00:00', $yearFilter);
        $params[] = sprintf('%04d-01-01 00:00:00', $yearFilter + 1);
    }
    $sql = 'SELECT ' . app_discovery_article_columns() . " FROM articles WHERE $where ORDER BY created_at DESC, id DESC LIMIT 501";
    $statement = app_db()->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    if (count($rows) > 500) {
        app_error(413, 'Archive contains too many articles. Select a year to narrow the result.', 'ARCHIVE_RESULT_TOO_LARGE');
    }
    $years = [];
    $total = 0;
    foreach ($rows as $row) {
        $timestamp = strtotime((string) $row['created_at']);
        $year = $timestamp === false ? 'unknown' : date('Y', $timestamp);
        $month = $timestamp === false ? '00' : date('m', $timestamp);
        if (!isset($years[$year])) {
            $years[$year] = ['year' => $year, 'count' => 0, 'months' => []];
        }
        if (!isset($years[$year]['months'][$month])) {
            $years[$year]['months'][$month] = ['month' => $month, 'count' => 0, 'articles' => []];
        }
        $years[$year]['count']++;
        $years[$year]['months'][$month]['count']++;
        $years[$year]['months'][$month]['articles'][] = app_article_row($row, false);
        $total++;
    }
    foreach ($years as &$year) {
        $year['months'] = array_values($year['months']);
    }
    unset($year);
    return ['totalArticles' => $total, 'years' => array_values($years)];
}

function app_article_series($articleLimitPerSeries = null): array
{
    app_require_schema_011();
    app_require_schema_013();
    if ($articleLimitPerSeries !== null) $articleLimitPerSeries = app_clamp(app_int($articleLimitPerSeries), 1, 50);
    $sql = 'SELECT ' . app_discovery_article_columns() . " FROM articles WHERE published = 1 AND TRIM(series_name) <> '' ORDER BY series_name ASC, series_order ASC, created_at ASC, id ASC LIMIT 501";
    $series = [];
    $rows = app_db()->query($sql)->fetchAll();
    if (count($rows) > 500) {
        app_error(413, 'Series index contains too many articles.', 'SERIES_RESULT_TOO_LARGE');
    }
    foreach ($rows as $row) {
        $name = trim((string) $row['series_name']);
        if ($name === '') continue;
        if (!isset($series[$name])) {
            $series[$name] = [
                'name' => $name,
                'count' => 0,
                'coverImage' => '',
                'summary' => '',
                'latestAt' => null,
                'articles' => [],
            ];
        }
        $article = app_article_row($row, false);
        $article['order'] = (int) ($row['series_order'] ?? 0);
        $series[$name]['count']++;
        if ($articleLimitPerSeries === null || count($series[$name]['articles']) < $articleLimitPerSeries) {
            $series[$name]['articles'][] = $article;
        }
        if ($series[$name]['coverImage'] === '' && $article['coverImage'] !== '') $series[$name]['coverImage'] = $article['coverImage'];
        if ($series[$name]['summary'] === '' && $article['summary'] !== '') $series[$name]['summary'] = $article['summary'];
        if ($series[$name]['latestAt'] === null || strcmp($article['createdAt'], $series[$name]['latestAt']) > 0) {
            $series[$name]['latestAt'] = $article['createdAt'];
        }
    }
    $result = array_values($series);
    usort($result, static function (array $left, array $right): int {
        return strcmp((string) ($right['latestAt'] ?? ''), (string) ($left['latestAt'] ?? '')) ?: strcasecmp($left['name'], $right['name']);
    });
    return $result;
}

function app_article_navigation(int $id): array
{
    $database = app_db();
    $currentStatement = $database->prepare('SELECT id, title, category, tags, series_name, series_order, created_at FROM articles WHERE id = ? AND published = 1');
    $currentStatement->execute([$id]);
    $current = $currentStatement->fetch();
    if (!$current) return ['previous' => null, 'next' => null, 'series' => [], 'related' => []];

    $mapArticle = static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'category' => (string) ($row['category'] ?? ''),
            'coverImage' => (string) ($row['cover_image'] ?? ''),
            'summary' => (string) ($row['summary'] ?? ''),
            'createdAt' => app_now_iso($row['created_at'] ?? null),
        ];
    };

    $previous = $database->prepare('SELECT id, title, summary, cover_image, category, created_at FROM articles WHERE published = 1 AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 1');
    $previous->execute([$current['created_at'], $current['created_at'], $id]);
    $next = $database->prepare('SELECT id, title, summary, cover_image, category, created_at FROM articles WHERE published = 1 AND (created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT 1');
    $next->execute([$current['created_at'], $current['created_at'], $id]);

    $series = [];
    $seriesName = trim((string) ($current['series_name'] ?? ''));
    if ($seriesName !== '') {
        $seriesStatement = $database->prepare('SELECT id, title, summary, cover_image, category, created_at, series_order FROM articles WHERE published = 1 AND series_name = ? ORDER BY series_order ASC, created_at ASC, id ASC LIMIT 50');
        $seriesStatement->execute([$seriesName]);
        foreach ($seriesStatement->fetchAll() as $row) {
            $item = $mapArticle($row);
            $item['order'] = (int) ($row['series_order'] ?? 0);
            $item['current'] = (int) $row['id'] === $id;
            $series[] = $item;
        }
    }

    $currentTags = array_values(array_filter(array_map('trim', explode(',', (string) ($current['tags'] ?? '')))));
    $relatedConditions = ['category = ?'];
    $relatedParams = [$id, (string) ($current['category'] ?? '')];
    foreach ($currentTags as $tag) {
        $relatedConditions[] = "FIND_IN_SET(?, REPLACE(tags, ' ', '')) > 0";
        $relatedParams[] = str_replace(' ', '', $tag);
    }
    $candidates = $database->prepare('SELECT id, title, summary, cover_image, category, tags, created_at FROM articles WHERE published = 1 AND id <> ? AND (' . implode(' OR ', $relatedConditions) . ') ORDER BY created_at DESC LIMIT 40');
    $candidates->execute($relatedParams);
    $related = [];
    foreach ($candidates->fetchAll() as $row) {
        $score = ((string) ($row['category'] ?? '') !== '' && $row['category'] === $current['category']) ? 2 : 0;
        $candidateTags = array_values(array_filter(array_map('trim', explode(',', (string) ($row['tags'] ?? '')))));
        $score += count(array_intersect($currentTags, $candidateTags));
        if ($score <= 0) continue;
        $item = $mapArticle($row);
        $item['_score'] = $score;
        $related[] = $item;
    }
    usort($related, static function (array $left, array $right): int {
        return ($right['_score'] <=> $left['_score']) ?: strcmp((string) ($right['createdAt'] ?? ''), (string) ($left['createdAt'] ?? ''));
    });
    $related = array_slice(array_map(static function (array $item): array { unset($item['_score']); return $item; }, $related), 0, 4);

    return [
        'previous' => ($row = $previous->fetch()) ? $mapArticle($row) : null,
        'next' => ($row = $next->fetch()) ? $mapArticle($row) : null,
        'seriesName' => $seriesName,
        'series' => $series,
        'related' => $related,
    ];
}

function app_public_feed(string $format = 'rss'): void
{
    $siteUrl = app_public_site_url();
    $profile = app_profile(true);
    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    $rows = app_db()->query('SELECT id, title, summary, content, login_required, category, tags, cover_image, created_at, updated_at FROM articles WHERE published = 1 ORDER BY created_at DESC LIMIT 30')->fetchAll();
    $items = '';
    foreach ($rows as $row) {
        $link = $siteUrl . '/blog/' . (int) $row['id'];
        $description = trim((string) $row['summary']);
        // Never expose正文 through RSS/Atom for login-gated articles. The
        // detail endpoint performs the actual session check, while feeds are
        // public and may be fetched by crawlers or cached clients.
        if (!empty($row['login_required'])) {
            if ($description === '') $description = '登录后查看文章正文。';
        } elseif ($description === '') {
            $description = trim(preg_replace('/\s+/', ' ', strip_tags((string) $row['content'])));
        }
        $description = function_exists('mb_substr') ? mb_substr($description, 0, 500) : substr($description, 0, 500);
        $date = date(DATE_RSS, strtotime((string) $row['updated_at']));
        if ($format === 'atom') {
            $items .= "  <entry>\n    <title>{$escape((string) $row['title'])}</title>\n    <link href=\"{$escape($link)}\"/>\n    <id>{$escape($link)}</id>\n    <updated>" . $escape(date(DATE_ATOM, strtotime((string) $row['updated_at']))) . "</updated>\n    <summary>{$escape($description)}</summary>\n  </entry>\n";
        } else {
            $items .= "    <item>\n      <title>{$escape((string) $row['title'])}</title>\n      <link>{$escape($link)}</link>\n      <guid isPermaLink=\"true\">{$escape($link)}</guid>\n      <pubDate>{$escape($date)}</pubDate>\n      <description>{$escape($description)}</description>\n    </item>\n";
        }
    }
    if ($format === 'atom') {
        $body = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<feed xmlns=\"http://www.w3.org/2005/Atom\">\n  <title>{$escape($profile['nickname'])}</title>\n  <link href=\"{$escape($siteUrl)}\"/>\n  <link rel=\"self\" href=\"{$escape($siteUrl . '/atom.xml')}\"/>\n  <id>{$escape($siteUrl . '/')}</id>\n  <updated>" . $escape(date(DATE_ATOM)) . "</updated>\n{$items}</feed>\n";
        // A post can change from public to login-gated. Prevent a previously
        // public feed response from surviving in a browser or CDN cache.
        app_public_text_response($body, 'application/atom+xml; charset=utf-8', -1);
    }
    $body = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\">\n  <channel>\n    <title>{$escape($profile['nickname'])}</title>\n    <link>{$escape($siteUrl)}</link>\n    <description>{$escape((string) $profile['bio'])}</description>\n    <lastBuildDate>" . $escape(date(DATE_RSS)) . "</lastBuildDate>\n{$items}  </channel>\n</rss>\n";
    app_public_text_response($body, 'application/rss+xml; charset=utf-8', -1);
}

function app_admin_backup_manifest(): array
{
    $tables = ['admin_account', 'user_accounts', 'articles', 'projects', 'skills', 'feature_cards', 'site_profile', 'site_settings', 'themes', 'live2d_settings', 'live2d_models', 'upload_settings', 'friend_links', 'guest_messages', 'site_visits', 'site_analytics_visitors', 'site_analytics_totals', 'admin_operation_logs'];
    $counts = [];
    foreach ($tables as $table) {
        try { $counts[$table] = (int) app_db()->query("SELECT COUNT(*) FROM `$table`")->fetchColumn(); } catch (Throwable $error) { $counts[$table] = null; }
    }
    $uploadRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\');
    $bytes = 0;
    $files = [];
    $filesTruncated = false;
    if (is_dir($uploadRoot)) {
        try {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploadRoot, FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if (!$file->isFile()) continue;
                $relative = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($uploadRoot))), '/');
                $size = $file->getSize();
                $bytes += $size;
                if (count($files) >= 2000) {
                    $filesTruncated = true;
                    continue;
                }
                $files[] = ['path' => $relative, 'bytes' => $size, 'modifiedAt' => date(DATE_ATOM, $file->getMTime())];
            }
        } catch (Throwable $error) {
            error_log('Backup manifest upload scan failed: ' . $error->getMessage());
        }
    }
    return ['generatedAt' => date(DATE_ATOM), 'schema' => '014', 'tables' => $counts, 'uploadBytes' => $bytes, 'uploadFiles' => $files, 'uploadFilesTruncated' => $filesTruncated, 'note' => '清单包含数据表数量和 uploads 文件列表。'];
}

function app_schema_010_ready(): bool
{
    $columns = app_db()->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME IN ('series_name', 'series_order')")->fetchColumn();
    if ((int) $columns !== 2) return false;
    $index = app_db()->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND INDEX_NAME = 'idx_articles_series'")->fetchColumn();
    return (int) $index > 0;
}

function app_require_schema_010(): void
{
    if (!app_schema_010_ready()) app_error(503, '璇峰厛瀵煎叆 migrations/010_content_discovery.sql', 'MIGRATION_REQUIRED');
}

function app_schema_011_ready(): bool
{
    try {
        if (!app_schema_010_ready()) return false;
        $columns = app_db()->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME IN ('featured', 'display_order')")->fetchColumn();
        if ((int) $columns !== 2) return false;
        $indexes = app_db()->query("SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND INDEX_NAME IN ('idx_articles_featured_order', 'idx_articles_popular')")->fetchColumn();
        return (int) $indexes === 2;
    } catch (Throwable $error) {
        error_log('Schema 011 check failed: ' . $error->getMessage());
        return false;
    }
}

function app_require_schema_011(): void
{
    if (!app_schema_011_ready()) app_error(503, 'Please import migrations/010_content_discovery.sql and migrations/011_article_discovery.sql first.', 'MIGRATION_REQUIRED');
}

function app_schema_012_ready(): bool
{
    try {
        $table = app_db()->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_operation_logs'")->fetchColumn();
        return (int) $table === 1;
    } catch (Throwable $error) {
        error_log('Schema 012 check failed: ' . $error->getMessage());
        return false;
    }
}

function app_require_schema_012(): void
{
    if (!app_schema_012_ready()) app_error(503, 'Please import migrations/012_admin_operation_logs.sql first.', 'MIGRATION_REQUIRED');
}

function app_schema_013_ready(): bool
{
    try {
        $userTable = (int) app_db()->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_accounts'")->fetchColumn() === 1;
        if (!$userTable) return false;
        $articleColumn = (int) app_db()->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'login_required'")->fetchColumn() === 1;
        $visitColumns = (int) app_db()->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_visits' AND COLUMN_NAME IN ('user_id','user_email','is_authenticated')")->fetchColumn();
        return $articleColumn && $visitColumns === 3;
    } catch (Throwable $error) {
        error_log('Schema 013 check failed: ' . $error->getMessage());
        return false;
    }
}

function app_require_schema_013(): void
{
    if (!app_schema_013_ready()) app_error(503, 'Please import migrations/013_user_auth_article_login_analytics.sql first.', 'MIGRATION_REQUIRED');
}

function app_schema_014_ready(): bool
{
    try {
        if (!app_schema_013_ready()) return false;
        $columns = app_db()->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_accounts' AND COLUMN_NAME IN ('disabled_at', 'disabled_reason')")->fetchColumn();
        return (int) $columns === 2;
    } catch (Throwable $error) {
        error_log('Schema 014 check failed: ' . $error->getMessage());
        return false;
    }
}

function app_require_schema_014(): void
{
    if (!app_schema_014_ready()) app_error(503, 'Please import migrations/014_user_admin_management.sql first.', 'MIGRATION_REQUIRED');
}

function app_backup_require_password($value): string
{
    $password = (string) $value;
    if (strlen($password) < 12 || strlen($password) > 256) app_error(400, 'Backup password must contain 12 to 256 characters.', 'BACKUP_PASSWORD_INVALID');
    return $password;
}

function app_backup_identifier(string $value): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $value)) throw new RuntimeException('Backup contains an invalid database identifier.');
    return '`' . $value . '`';
}

function app_backup_sql_literal($value, string $type): string
{
    if ($value === null) return 'NULL';
    $raw = (string) $value;
    if (preg_match('/binary|blob|bit/i', $type)) return $raw === '' ? "''" : '0x' . bin2hex($raw);
    if (preg_match('/^(?:tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double|real|year)/i', $type)
        && preg_match('/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i', $raw)) return $raw;
    if ($raw === '') return "''";
    return 'CONVERT(0x' . bin2hex($raw) . ' USING utf8mb4)';
}

function app_backup_dump_database(string $path): array
{
    $handle = @fopen($path, 'wb');
    if (!$handle) throw new RuntimeException('Unable to create the database backup file.');
    $database = app_db();
    $tables = $database->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $rowCount = 0;
    try {
        fwrite($handle, "SET NAMES utf8mb4;\nSET time_zone = '+08:00';\nSET FOREIGN_KEY_CHECKS = 0;\n");
        foreach ($tables as $tableName) {
            $table = app_backup_identifier((string) $tableName);
            $columns = $database->query('SHOW COLUMNS FROM ' . $table)->fetchAll();
            if (!$columns) continue;
            $columnNames = array_map(static function (array $column): string { return app_backup_identifier((string) $column['Field']); }, $columns);
            fwrite($handle, 'DELETE FROM ' . $table . ";\n");
            $rows = $database->query('SELECT * FROM ' . $table);
            while ($row = $rows->fetch(PDO::FETCH_ASSOC)) {
                $values = [];
                foreach ($columns as $column) $values[] = app_backup_sql_literal($row[$column['Field']] ?? null, (string) ($column['Type'] ?? ''));
                fwrite($handle, 'INSERT INTO ' . $table . ' (' . implode(',', $columnNames) . ') VALUES (' . implode(',', $values) . ");\n");
                $rowCount++;
            }
        }
        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 1;\n");
    } finally {
        fclose($handle);
    }
    return ['tables' => count($tables), 'rows' => $rowCount];
}

function app_backup_encrypt_file(string $path, string $password): array
{
    if (!function_exists('openssl_encrypt')) throw new RuntimeException('OpenSSL is required to encrypt backups.');
    $plain = @file_get_contents($path);
    if ($plain === false) throw new RuntimeException('鏃犳硶璇诲彇澶囦唤鏁版嵁');
    $salt = random_bytes(16);
    $iv = random_bytes(12);
    $key = hash_pbkdf2('sha256', $password, $salt, 210000, 32, true);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
    if ($cipher === false || $tag === '') throw new RuntimeException('澶囦唤鍔犲瘑澶辫触');
    return ['cipher' => $cipher, 'meta' => ['algorithm' => 'AES-256-GCM', 'kdf' => 'PBKDF2-HMAC-SHA256', 'iterations' => 210000, 'salt' => bin2hex($salt), 'iv' => bin2hex($iv), 'tag' => bin2hex($tag)]];
}

function app_backup_decrypt_file(string $path, string $password, array $meta, string $target): void
{
    // Metadata is outside the authenticated ciphertext. Bound the KDF cost
    // and validate all binary fields before invoking OpenSSL.
    $iterations = (int) ($meta['iterations'] ?? 0);
    $saltHex = (string) ($meta['salt'] ?? '');
    $ivHex = (string) ($meta['iv'] ?? '');
    $tagHex = (string) ($meta['tag'] ?? '');
    if (($meta['algorithm'] ?? '') !== 'AES-256-GCM'
        || ($meta['kdf'] ?? '') !== 'PBKDF2-HMAC-SHA256'
        || $iterations < 100000 || $iterations > 500000
        || !preg_match('/^[a-f0-9]{32}$/i', $saltHex)
        || !preg_match('/^[a-f0-9]{24}$/i', $ivHex)
        || !preg_match('/^[a-f0-9]{32}$/i', $tagHex)) {
        throw new RuntimeException('Invalid backup encryption metadata');
    }
    if (($meta['algorithm'] ?? '') !== 'AES-256-GCM' || !isset($meta['salt'], $meta['iv'], $meta['tag'])) throw new RuntimeException('Invalid backup encryption metadata.');
    $cipher = @file_get_contents($path);
    $salt = hex2bin($saltHex);
    $iv = hex2bin($ivHex);
    $tag = hex2bin($tagHex);
    if ($cipher === false || $salt === false || $iv === false || $tag === false) throw new RuntimeException('澶囦唤鍔犲瘑鏁版嵁鎹熷潖');
    $key = hash_pbkdf2('sha256', $password, $salt, $iterations, 32, true);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '');
    if ($plain === false || @file_put_contents($target, $plain, LOCK_EX) === false) throw new RuntimeException('Incorrect backup password or decryption failed.');
}

function app_backup_remove_tree(string $root): void
{
    if (!is_dir($root)) { if (is_file($root)) @unlink($root); return; }
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $entry) {
        if ($entry->isDir() && !$entry->isLink()) @rmdir($entry->getPathname()); else @unlink($entry->getPathname());
    }
    @rmdir($root);
}

function app_backup_safe_relative(string $value): string
{
    $value = str_replace('\\', '/', $value);
    if (strpos($value, "\0") !== false || strlen($value) > 1024) throw new RuntimeException('Invalid backup path');
    if ($value === '' || str_starts_with($value, '/') || str_contains($value, '//')) throw new RuntimeException('Backup contains an unsafe path.');
    foreach (explode('/', $value) as $part) {
        if ($part === '' || $part === '.' || $part === '..' || strlen($part) > 255
            || preg_match('/[\x00-\x1F<>:"|?*]/', $part)) {
            throw new RuntimeException('Backup contains an unsafe path.');
        }
    }
    return $value;
}

function app_backup_upload_path_is_ignored(string $relative): bool
{
    $normalized = str_replace('\\', '/', $relative);
    return $normalized === '.htaccess'
        || $normalized === '.user.ini'
        || str_starts_with($normalized, '.cache/')
        || str_contains($normalized, '/.cache/');
}

function app_backup_validate_upload_path(string $relative): string
{
    $relative = app_backup_safe_relative($relative);
    $parts = explode('/', $relative);
    foreach ($parts as $part) {
        if (str_starts_with($part, '.')) throw new RuntimeException('Backup contains a hidden upload path.');
    }
    if (count($parts) < 2) throw new RuntimeException('Backup contains an unsupported upload path.');

    $folder = strtolower($parts[0]);
    $extension = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
    if (in_array($folder, ['articles', 'theme', 'avatars'], true)) {
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) throw new RuntimeException('Backup contains an unsupported image upload.');
        return $relative;
    }
    if ($folder === 'live2d') {
        if (!in_array($extension, ['json', 'moc', 'moc3', 'mtn', 'exp', 'png', 'jpg', 'jpeg', 'webp'], true)) {
            throw new RuntimeException('Backup contains an unsupported Live2D upload.');
        }
        return $relative;
    }
    if ($folder === APP_ARTICLE_SITE_DIR && isset(app_article_site_allowed_extensions()[$extension])) return $relative;
    throw new RuntimeException('Backup contains an unsupported upload path.');
}

function app_backup_install_upload_protection(string $uploadRoot): void
{
    $rules = <<<'HTACCESS'
Options -Indexes
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule (^|/)\. - [F,L,NC]
RewriteRule ^article-sites(?:/|$) - [F,L,NC]
</IfModule>
<FilesMatch "\.(?:php[0-9]?|phtml|phar|cgi|pl|py|sh|exe|bat|cmd|html?|svg)$">
  Require all denied
</FilesMatch>
HTACCESS;
    if (@file_put_contents(rtrim($uploadRoot, '/\\') . '/.htaccess', $rules . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Unable to install upload directory protection.');
    }
}

function app_backup_copy_stream($input, string $target): void
{
    $parent = dirname($target);
    if (!is_dir($parent) && !mkdir($parent, 0755, true) && !is_dir($parent)) throw new RuntimeException('鏃犳硶鍒涘缓鎭㈠鐩綍');
    $output = @fopen($target, 'wb');
    if (!$output) throw new RuntimeException('鏃犳硶鍐欏叆鎭㈠鏂囦欢');
    $copied = stream_copy_to_stream($input, $output);
    fclose($output);
    if ($copied === false) throw new RuntimeException('鎭㈠鏂囦欢鍐欏叆澶辫触');
}

function app_backup_parse_legacy_settings(string $path): array
{
    $source = @file_get_contents($path);
    if (!is_string($source) || strlen($source) > APP_BACKUP_MAX_SETTINGS_BYTES) throw new RuntimeException('Legacy backup settings are invalid.');
    $tokens = token_get_all($source);
    $index = 0;
    $count = count($tokens);
    $skip = static function () use (&$tokens, &$index, $count): void {
        while ($index < $count && is_array($tokens[$index]) && $tokens[$index][0] === T_WHITESPACE) $index++;
    };
    $parseValue = null;
    $parseArray = null;
    $parseValue = static function () use (&$parseValue, &$parseArray, &$tokens, &$index, $count, $skip) {
        $skip();
        if ($index >= $count) throw new RuntimeException('Legacy backup settings are truncated.');
        $token = $tokens[$index++];
        if (is_array($token)) {
            [$id, $text] = $token;
            if ($id === T_ARRAY) {
                $skip();
                if ($tokens[$index++] !== '(') throw new RuntimeException('Legacy backup settings contain an invalid array.');
                return $parseArray(')');
            }
            if ($id === T_CONSTANT_ENCAPSED_STRING) {
                $raw = substr($text, 1, -1);
                return str_replace(['\\\\', "\\'"], ['\\', "'"], $raw);
            }
            if ($id === T_LNUMBER) return (int) $text;
            if ($id === T_DNUMBER) return (float) $text;
            if ($id === T_STRING && in_array(strtolower($text), ['true', 'false', 'null'], true)) return strtolower($text) === 'true' ? true : (strtolower($text) === 'false' ? false : null);
            throw new RuntimeException('Legacy backup settings contain executable code.');
        }
        if ($token === '[') return $parseArray(']');
        throw new RuntimeException('Legacy backup settings contain executable code.');
    };
    $parseArray = static function (string $closing) use (&$parseValue, &$tokens, &$index, $count, $skip): array {
        $result = [];
        while (true) {
            $skip();
            if ($index >= $count) throw new RuntimeException('Legacy backup settings contain an unterminated array.');
            if ($tokens[$index] === $closing) { $index++; return $result; }
            $key = count($result);
            $valueToken = $tokens[$index];
            if (is_array($valueToken) && in_array($valueToken[0], [T_CONSTANT_ENCAPSED_STRING, T_LNUMBER], true)) {
                $candidate = $parseValue();
                $skip();
                if ($index < $count && $tokens[$index] === '=>') { $index++; $key = $candidate; }
                else { $value = $candidate; $result[$key] = $value; $skip(); if ($index < $count && $tokens[$index] === ',') { $index++; continue; } if ($index < $count && $tokens[$index] === $closing) { $index++; return $result; } throw new RuntimeException('Legacy backup settings contain an invalid array.'); }
            }
            $result[$key] = $parseValue();
            $skip();
            if ($index < $count && $tokens[$index] === ',') { $index++; continue; }
            if ($index < $count && $tokens[$index] === $closing) { $index++; return $result; }
            throw new RuntimeException('Legacy backup settings contain an invalid array.');
        }
    };
    $skip();
    if ($index >= $count || !is_array($tokens[$index]) || $tokens[$index][0] !== T_OPEN_TAG) throw new RuntimeException('Legacy backup settings are invalid.');
    $index++;
    $skip();
    if ($index >= $count || !is_array($tokens[$index]) || $tokens[$index][0] !== T_RETURN) throw new RuntimeException('Legacy backup settings are invalid.');
    $index++;
    $settings = $parseValue();
    $skip();
    if ($index >= $count || $tokens[$index++] !== ';' || !is_array($settings)) throw new RuntimeException('Legacy backup settings are invalid.');
    $skip();
    if ($index !== $count) throw new RuntimeException('Legacy backup settings contain trailing code.');
    return $settings;
}

function app_backup_validate_app_settings(array $settings): array
{
    $validated = [];
    if (array_key_exists('production', $settings)) $validated['production'] = (bool) $settings['production'];
    if (array_key_exists('timezone', $settings)) {
        $timezone = (string) $settings['timezone'];
        if (!in_array($timezone, timezone_identifiers_list(), true)) throw new RuntimeException('Backup contains an invalid timezone.');
        $validated['timezone'] = $timezone;
    }
    if (array_key_exists('session_name', $settings)) {
        $sessionName = (string) $settings['session_name'];
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/', $sessionName)) throw new RuntimeException('Backup contains an invalid session name.');
        $validated['session_name'] = $sessionName;
    }
    if (array_key_exists('admin_path_suffix', $settings)) {
        $suffix = (string) $settings['admin_path_suffix'];
        if (!app_admin_path_suffix_is_routable($suffix)) throw new RuntimeException('Backup contains an invalid admin path.');
        $validated['admin_path_suffix'] = $suffix;
    }
    foreach (['setup_key', 'analytics_key'] as $key) {
        if (!array_key_exists($key, $settings)) continue;
        $secret = (string) $settings[$key];
        if (strlen($secret) < 32 || strlen($secret) > 512 || str_starts_with($secret, 'CHANGE_THIS_')) {
            throw new RuntimeException('Backup contains an invalid application secret.');
        }
        $validated[$key] = $secret;
    }
    if (array_key_exists('site_url', $settings)) {
        $url = rtrim((string) $settings['site_url'], '/');
        $parts = parse_url($url);
        if (!filter_var($url, FILTER_VALIDATE_URL) || !is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment'])) {
            throw new RuntimeException('Backup contains an invalid canonical site URL.');
        }
        $validated['site_url'] = $url;
    }
    if (array_key_exists('article_site_url_ttl_seconds', $settings)) {
        $validated['article_site_url_ttl_seconds'] = app_clamp((int) $settings['article_site_url_ttl_seconds'], 300, 86400);
    }
    return $validated;
}

function app_backup_apply_app_settings(array|string $settings): void
{
    if (is_string($settings)) {
        $raw = @file_get_contents($settings);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        $settings = is_array($decoded) ? $decoded : app_backup_parse_legacy_settings($settings);
    }
    $settings = app_backup_validate_app_settings($settings);
    if (!is_array($settings)) throw new RuntimeException('澶囦唤涓殑搴旂敤閰嶇疆鏃犳晥');
    $config = app_config();
    foreach ($settings as $key => $value) $config['app'][$key] = $value;
    $configPath = dirname(__DIR__) . '/config/config.php';
    if (!is_file($configPath) || !is_writable($configPath)) throw new RuntimeException('config/config.php 涓嶅彲鍐欙紝鏃犳硶鎭㈠搴旂敤閰嶇疆');
    $temporary = $configPath . '.restore-' . bin2hex(random_bytes(4));
    if (@file_put_contents($temporary, "<?php\n\nreturn " . var_export($config, true) . ";\n", LOCK_EX) === false || !@rename($temporary, $configPath)) {
        @unlink($temporary);
        throw new RuntimeException('鎭㈠搴旂敤閰嶇疆澶辫触');
    }
}

function app_backup_add_uploads_to_archive(ZipArchive $zip): void
{
    $uploadRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\');
    if (!is_dir($uploadRoot)) return;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploadRoot, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->isLink()) continue;
        $rawRelative = substr($file->getPathname(), strlen($uploadRoot) + 1);
        if (app_backup_upload_path_is_ignored($rawRelative)) continue;
        $relative = app_backup_validate_upload_path($rawRelative);
        if (!$zip->addFile($file->getPathname(), 'uploads/' . $relative)) throw new RuntimeException('鏃犳硶鍐欏叆涓婁紶鏂囦欢: ' . $relative);
    }
}

function app_backup_create_archive(string $zipPath, string $password): array
{
    $working = rtrim(sys_get_temp_dir(), '/\\') . '/personal-backup-' . bin2hex(random_bytes(8));
    if (!mkdir($working, 0700, true)) throw new RuntimeException('鏃犳硶鍒涘缓澶囦唤涓存椂鐩綍');
    $zip = null;
    try {
        $databaseStats = app_backup_dump_database($working . '/database.sql');
        $encryptedSql = app_backup_encrypt_file($working . '/database.sql', $password);
        $app = app_config()['app'];
        $safeSettings = [];
        foreach (['production', 'timezone', 'session_name', 'admin_path_suffix', 'setup_key', 'analytics_key', 'site_url', 'article_site_url_ttl_seconds'] as $key) if (array_key_exists($key, $app)) $safeSettings[$key] = $app[$key];
        $settingsPath = $working . '/app-settings.json';
        if (@file_put_contents($settingsPath, "<?php\n\nreturn " . var_export($safeSettings, true) . ";\n", LOCK_EX) === false) throw new RuntimeException('鏃犳硶鍒涘缓搴旂敤閰嶇疆澶囦唤');
        $settingsJson = json_encode($safeSettings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (@file_put_contents($settingsPath, $settingsJson, LOCK_EX) === false) throw new RuntimeException('Unable to create encrypted app settings.');
        $encryptedSettings = app_backup_encrypt_file($settingsPath, $password);
        $manifest = ['format' => 'personal-website-portable-backup', 'version' => 1, 'generatedAt' => date(DATE_ATOM), 'schema' => '011', 'database' => $databaseStats, 'encryption' => ['algorithm' => 'AES-256-GCM', 'kdf' => 'PBKDF2-HMAC-SHA256', 'files' => ['database.sql.enc' => $encryptedSql['meta'], 'config/app-settings.php.enc' => $encryptedSettings['meta']], 'note' => 'The database and application settings are encrypted; uploads retain their original paths.'], 'manifest' => app_admin_backup_manifest()];
        $manifest = ['format' => 'personal-website-portable-backup', 'version' => 2, 'generatedAt' => date(DATE_ATOM), 'schema' => '011', 'database' => $databaseStats, 'encryption' => ['algorithm' => 'AES-256-GCM', 'kdf' => 'PBKDF2-HMAC-SHA256', 'files' => ['database.sql.enc' => $encryptedSql['meta'], 'config/app-settings.json.enc' => $encryptedSettings['meta']], 'note' => 'The database and application settings are encrypted; uploads retain their original paths.'], 'manifest' => app_admin_backup_manifest()];
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('Unable to create the backup archive.');
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        $zip->addFromString('database.sql.enc', $encryptedSql['cipher']);
        $zip->addFromString('config/app-settings.json.enc', $encryptedSettings['cipher']);
        $zip->addFromString('README.txt', "personal-website portable backup\n\nThis archive contains the database and uploads. The database and app settings are encrypted with the password entered during export. Keep the password safe; it cannot be recovered.\n");
        app_backup_add_uploads_to_archive($zip);
        $zip->setArchiveComment('personal-website portable backup; database and app settings are encrypted');
        $zip->close();
        $zip = null;
        return $databaseStats;
    } finally {
        if ($zip instanceof ZipArchive) $zip->close();
        app_backup_remove_tree($working);
    }
}

function app_backup_validate_sql_statement(string $statement, array $schema): void
{
    if (in_array($statement, ["SET NAMES utf8mb4", "SET time_zone = '+08:00'", 'SET FOREIGN_KEY_CHECKS = 0', 'SET FOREIGN_KEY_CHECKS = 1'], true)) return;
    if (preg_match('/^DELETE FROM `([A-Za-z0-9_]+)`$/D', $statement, $match)) {
        if (!isset($schema[$match[1]])) throw new RuntimeException('Backup references an unknown database table.');
        return;
    }
    if (!preg_match('/^INSERT INTO `([A-Za-z0-9_]+)` \(/', $statement, $match)) throw new RuntimeException('Backup contains an unsupported SQL statement.');
    $table = $match[1];
    if (!isset($schema[$table])) throw new RuntimeException('Backup references an unknown database table.');
    $marker = ') VALUES (';
    $markerPosition = strpos($statement, $marker, strlen($match[0]));
    if ($markerPosition === false || substr($statement, -1) !== ')') throw new RuntimeException('Backup contains an invalid INSERT statement.');
    $columnsRaw = substr($statement, strlen($match[0]), $markerPosition - strlen($match[0]));
    $valuesRaw = substr($statement, $markerPosition + strlen($marker), -1);
    $columns = array_map('trim', explode(',', $columnsRaw));
    $values = array_map('trim', explode(',', $valuesRaw));
    if (count($columns) === 0 || count($columns) !== count($values)) throw new RuntimeException('Backup contains mismatched SQL columns and values.');
    foreach ($columns as $column) {
        if (!preg_match('/^`([A-Za-z0-9_]+)`$/D', $column, $columnMatch) || !isset($schema[$table][$columnMatch[1]])) {
            throw new RuntimeException('Backup contains an unknown database column.');
        }
    }
    foreach ($values as $value) {
        if (!preg_match('/^(?:NULL|\'\'|0x[0-9a-f]*|CONVERT\(0x[0-9a-f]* USING utf8mb4\)|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)$/iD', $value)) {
            throw new RuntimeException('Backup contains an unsafe SQL value.');
        }
    }
}

function app_backup_execute_sql(string $path): array
{
    $handle = @fopen($path, 'rb');
    if (!$handle) throw new RuntimeException('Unable to read the database backup.');
    $database = app_db();
    $statements = 0;
    $schema = [];
    foreach ($database->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $tableName) {
        $table = (string) $tableName;
        $schema[$table] = [];
        foreach ($database->query('SHOW COLUMNS FROM ' . app_backup_identifier($table))->fetchAll() as $column) {
            $schema[$table][(string) $column['Field']] = true;
        }
    }
    try {
        $database->beginTransaction();
        while (($line = fgets($handle)) !== false) {
            $statement = trim($line);
            if ($statement === '') continue;
            if (substr($statement, -1) === ';') $statement = substr($statement, 0, -1);
            if ($statement === '') continue;
            app_backup_validate_sql_statement($statement, $schema);
            $database->exec($statement);
            $statements++;
        }
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    } finally {
        fclose($handle);
    }
    return ['statements' => $statements];
}

function app_admin_backup_export(): void
{
    app_require_schema_010();
    app_require_schema_011();
    $body = app_body();
    $password = app_backup_require_password($body['password'] ?? '');
    if (!class_exists('ZipArchive')) app_error(503, '涓绘満鏈惎鐢?PHP ZipArchive 鎵╁睍', 'ZIP_EXTENSION_REQUIRED');
    $zipPath = rtrim(sys_get_temp_dir(), '/\\') . '/personal-download-' . bin2hex(random_bytes(8)) . '.zip';
    try {
        app_backup_create_archive($zipPath, $password);
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="personal-website-backup-' . date('Ymd-His') . '.zip"');
        header('Cache-Control: no-store');
        header('Content-Length: ' . (string) filesize($zipPath));
        readfile($zipPath);
        @unlink($zipPath);
        exit;
    } catch (Throwable $error) {
        error_log('Backup export failed: ' . $error->getMessage());
        app_error(500, 'Backup failed. Check ZipArchive, OpenSSL, and available disk space.', 'BACKUP_EXPORT_FAILED');
    } finally {
        @unlink($zipPath);
    }
}

function app_admin_backup_import(): void
{
    $password = app_backup_require_password($_POST['password'] ?? '');
    if (!class_exists('ZipArchive')) app_error(503, '涓绘満鏈惎鐢?PHP ZipArchive 鎵╁睍', 'ZIP_EXTENSION_REQUIRED');
    $file = $_FILES['backup'] ?? null;
    if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) app_error(400, '璇烽€夋嫨鏈夋晥鐨勫浠?ZIP 鏂囦欢', 'BACKUP_FILE_REQUIRED');
    // Reject oversized compressed archives before opening them. The expanded
    // size is checked below as well, but this protects PHP memory/disk usage
    // when upload limits on the host are configured too generously.
    $compressedSize = (int) ($file['size'] ?? 0);
    if ($compressedSize <= 0 || $compressedSize > APP_BACKUP_MAX_ARCHIVE_BYTES) {
        app_error(413, 'Backup ZIP exceeds the 512MB limit', 'BACKUP_FILE_TOO_LARGE');
    }
    $working = rtrim(sys_get_temp_dir(), '/\\') . '/personal-restore-' . bin2hex(random_bytes(8));
    if (!mkdir($working, 0700, true)) app_error(500, '鏃犳硶鍒涘缓鎭㈠涓存椂鐩綍', 'RESTORE_TEMP_FAILED');
    $zip = new ZipArchive();
    $oldUploads = '';
    $newUploads = '';
    $configPath = dirname(__DIR__) . '/config/config.php';
    $configBefore = $working . '/config-before.php';
    try {
        if (is_file($configPath) && !@copy($configPath, $configBefore)) throw new RuntimeException('鏃犳硶鏆傚瓨褰撳墠搴旂敤閰嶇疆');
        if ($zip->open((string) $file['tmp_name'], ZipArchive::CHECKCONS) !== true) throw new RuntimeException('澶囦唤 ZIP 鎹熷潖');
        if ($zip->numFiles > 100000) throw new RuntimeException('澶囦唤鏂囦欢鏁伴噺瓒呰繃闄愬埗');
        if ($zip->numFiles > APP_BACKUP_MAX_FILES) throw new RuntimeException('Backup contains too many files.');
        $manifest = null;
        $totalBytes = 0;
        $seenEntries = [];
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $rawName = str_replace('\\', '/', (string) $zip->getNameIndex($index));
            if (str_ends_with($rawName, '/')) continue;
            $name = app_backup_safe_relative($rawName);
            if (app_backup_upload_path_is_ignored(str_starts_with($name, 'uploads/') ? substr($name, 8) : $name)) continue;
            if (str_starts_with($name, 'uploads/')) app_backup_validate_upload_path(substr($name, 8));
            if ($name === 'config/app-settings.json.enc') $name = 'config/app-settings.php.enc';
            if (isset($seenEntries[$name])) throw new RuntimeException('Backup ZIP contains duplicate paths');
            $seenEntries[$name] = true;
            $stat = $zip->statIndex($index);
            $totalBytes += (int) ($stat['size'] ?? 0);
            if ($totalBytes > APP_BACKUP_MAX_ARCHIVE_BYTES) throw new RuntimeException('Backup expands beyond the 512MB limit.');
            if ($totalBytes > 2 * 1024 * 1024 * 1024) throw new RuntimeException('澶囦唤瑙ｅ帇澶у皬瓒呰繃 2GB 闄愬埗');
            if ($name === 'manifest.json') {
                $manifest = json_decode((string) $zip->getFromIndex($index), true);
                continue;
            }
            if (!in_array($name, ['database.sql.enc', 'config/app-settings.php.enc', 'README.txt'], true) && !str_starts_with($name, 'uploads/')) throw new RuntimeException('澶囦唤鍖呭惈涓嶅厑璁哥殑鏂囦欢');
            if (str_starts_with($name, 'uploads/') && preg_match('/\.(?:php[0-9]?|phtml|phar)$/i', $name)) throw new RuntimeException('Backup contains an executable upload.');
            $target = $working . '/' . $name;
            $stream = $zip->getStream($zip->getNameIndex($index));
            if (!is_resource($stream)) throw new RuntimeException('鏃犳硶璇诲彇澶囦唤鏂囦欢');
            app_backup_copy_stream($stream, $target);
            fclose($stream);
        }
        $zip->close();
        if (!is_array($manifest) || ($manifest['format'] ?? '') !== 'personal-website-portable-backup') throw new RuntimeException('Unsupported website backup archive.');
        $backupVersion = (int) ($manifest['version'] ?? 0);
        if (!in_array($backupVersion, [1, 2], true)) throw new RuntimeException('Unsupported website backup version.');
        $encryption = $manifest['encryption']['files'] ?? [];
        if (isset($encryption['config/app-settings.json.enc']) && !isset($encryption['config/app-settings.php.enc'])) {
            $encryption['config/app-settings.php.enc'] = $encryption['config/app-settings.json.enc'];
        }
        if ($backupVersion === 2 && !isset($encryption['config/app-settings.json.enc'])) throw new RuntimeException('Backup settings metadata is missing.');
        if (!isset($encryption['database.sql.enc'], $encryption['config/app-settings.php.enc'])) throw new RuntimeException('澶囦唤缂哄皯鍔犲瘑鏁版嵁');
        app_backup_decrypt_file($working . '/database.sql.enc', $password, $encryption['database.sql.enc'], $working . '/database.sql');
        app_backup_decrypt_file($working . '/config/app-settings.php.enc', $password, $encryption['config/app-settings.php.enc'], $working . '/app-settings.php');
        app_backup_apply_app_settings($working . '/app-settings.php');
        $uploadRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\');
        $newUploads = $uploadRoot . '.restore-' . bin2hex(random_bytes(6));
        if (is_dir($newUploads)) app_backup_remove_tree($newUploads);
        if (!mkdir($newUploads, 0755, true) && !is_dir($newUploads)) throw new RuntimeException('鏃犳硶鍒涘缓鏂扮殑 uploads 鐩綍');
        if (is_dir($working . '/uploads')) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($working . '/uploads', FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $entry) {
                $rawRelative = substr($entry->getPathname(), strlen($working . '/uploads') + 1);
                if (app_backup_upload_path_is_ignored($rawRelative)) continue;
                $relative = $entry->isDir() ? app_backup_safe_relative($rawRelative) : app_backup_validate_upload_path($rawRelative);
                $target = $newUploads . '/' . str_replace('/', DIRECTORY_SEPARATOR, $relative);
                if ($entry->isDir()) { if (!is_dir($target) && !mkdir($target, 0755, true) && !is_dir($target)) throw new RuntimeException('鏃犳硶鍒涘缓涓婁紶鐩綍'); }
                elseif ($entry->isFile() && !$entry->isLink()) { $input = fopen($entry->getPathname(), 'rb'); app_backup_copy_stream($input, $target); fclose($input); @chmod($target, 0644); }
            }
        }
        app_backup_install_upload_protection($newUploads);
        $oldUploads = $uploadRoot . '.before-restore-' . bin2hex(random_bytes(6));
        if (is_dir($uploadRoot) && !@rename($uploadRoot, $oldUploads)) throw new RuntimeException('鏃犳硶鏆傚瓨鍘?uploads 鐩綍');
        if (is_dir($newUploads) && !@rename($newUploads, $uploadRoot)) { if ($oldUploads !== '' && is_dir($oldUploads)) @rename($oldUploads, $uploadRoot); throw new RuntimeException('鏃犳硶鍒囨崲鏂扮殑 uploads 鐩綍'); }
        app_backup_execute_sql($working . '/database.sql');
        if ($oldUploads !== '' && is_dir($oldUploads)) app_backup_remove_tree($oldUploads);
        app_backup_remove_tree($working);
        app_destroy_session_state();
        app_json(['success' => true, 'message' => 'Backup restored. Please sign in again.', 'database' => $manifest['database'] ?? null]);
    } catch (Throwable $error) {
        if ($zip->status === ZipArchive::ER_OK) @$zip->close();
        if ($newUploads !== '' && is_dir($newUploads)) app_backup_remove_tree($newUploads);
        $currentUploadRoot = rtrim((string) app_config()['app']['upload_dir'], '/\\');
        if ($oldUploads !== '' && is_dir($oldUploads)) {
            if (is_dir($currentUploadRoot)) app_backup_remove_tree($currentUploadRoot);
            @rename($oldUploads, $currentUploadRoot);
        }
        if (is_file($configBefore)) @copy($configBefore, $configPath);
        app_backup_remove_tree($working);
        error_log('Backup import failed: ' . $error->getMessage());
        app_error(400, 'Backup import failed. Check the archive format, password, and available storage.', 'BACKUP_IMPORT_FAILED');
    } finally {
        app_backup_remove_tree($working);
    }
}

function app_projects(bool $featuredOnly = false): array
{
    $sql = 'SELECT * FROM projects' . ($featuredOnly ? ' WHERE featured = 1' : '') . ' ORDER BY display_order ASC, id DESC';
    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'], 'name' => $row['name'], 'description' => $row['description'],
            'coverImage' => $row['cover_image'], 'techStack' => $row['tech_stack'], 'githubUrl' => $row['github_url'],
            'demoUrl' => $row['demo_url'], 'stars' => (int) $row['stars'], 'featured' => (bool) $row['featured'],
            'displayOrder' => (int) $row['display_order'], 'createdAt' => app_now_iso($row['created_at']), 'updatedAt' => app_now_iso($row['updated_at']),
        ];
    }, app_db()->query($sql)->fetchAll());
}

function app_skills(): array
{
    return array_map(function ($row) {
        return ['id' => (int) $row['id'], 'name' => $row['name'], 'category' => $row['category'], 'proficiency' => (int) $row['proficiency'], 'icon' => $row['icon'], 'displayOrder' => (int) $row['display_order']];
    }, app_db()->query('SELECT * FROM skills ORDER BY category ASC, display_order ASC, id ASC')->fetchAll());
}

function app_feature_cards(bool $public = false): array
{
    $sql = 'SELECT * FROM feature_cards' . ($public ? ' WHERE enabled = 1' : '') . ' ORDER BY display_order ASC, id ASC';
    $english = strtolower((string) ($_GET['lang'] ?? 'zh')) === 'en';
    return array_map(function ($row) use ($english, $public) {
        return [
            'id' => (int) $row['id'],
            'title' => $public && $english && $row['title_en'] !== '' ? $row['title_en'] : $row['title'],
            'titleEn' => $row['title_en'],
            'description' => $public && $english && $row['description_en'] !== '' ? $row['description_en'] : $row['description'],
            'descriptionEn' => $row['description_en'], 'icon' => $row['icon'], 'gradient' => $row['gradient'],
            'displayOrder' => (int) $row['display_order'], 'enabled' => (bool) $row['enabled'],
        ];
    }, app_db()->query($sql)->fetchAll());
}

function app_theme_preset(string $preset): string
{
    $allowed = ['purple-pink', 'blue-cyan', 'green-teal', 'orange-red', 'dark-purple', 'minimal'];
    return in_array($preset, $allowed, true) ? $preset : 'purple-pink';
}

function app_theme(): array
{
    $row = app_db()->query('SELECT * FROM themes WHERE id = 1')->fetch();
    if (!$row) return ['preset' => 'purple-pink'];
    $custom = [
        'primary' => $row['primary_color'], 'secondary' => $row['secondary_color'], 'accent' => $row['accent_color'],
        'background' => $row['background'], 'backgroundStyle' => $row['background_style'], 'backgroundImage' => $row['background_image'],
        'backgroundSize' => $row['background_size'], 'backgroundPosition' => $row['background_position'], 'backgroundRepeat' => $row['background_repeat'],
        'cardBg' => $row['card_bg'], 'textPrimary' => $row['text_primary'], 'textSecondary' => $row['text_secondary'],
    ];
    if ($row['preset_key'] !== 'custom') return ['preset' => app_theme_preset((string) $row['preset_key'])];
    return ['custom' => $custom];
}

function app_live2d(): array
{
    $settings = app_db()->query('SELECT * FROM live2d_settings WHERE id = 1')->fetch();
    if (!$settings || !$settings['enabled']) return ['enabled' => false, 'models' => []];
    $models = array_map(function ($row) {
        return app_live2d_model_payload($row);
    }, app_db()->query('SELECT * FROM live2d_models WHERE active = 1 ORDER BY id ASC LIMIT 1')->fetchAll());
    return [
        'enabled' => count($models) > 0,
        'settings' => [
            'position' => $settings['position'], 'size' => (int) $settings['size'], 'primaryColor' => $settings['primary_color'],
            'transitionType' => $settings['transition_type'], 'transitionDuration' => (int) $settings['transition_duration'],
            'menuAlign' => $settings['menu_align'], 'showSleepButton' => (bool) $settings['show_sleep_button'], 'showAboutButton' => (bool) $settings['show_about_button'],
        ],
        'models' => $models,
    ];
}

function app_upload_settings(): array
{
    $row = app_db()->query('SELECT * FROM upload_settings WHERE id = 1')->fetch();
    return [
        'articleImageMaxMB' => (int) $row['article_image_max_mb'], 'themeBackgroundMaxMB' => (int) $row['theme_background_max_mb'],
        'avatarImageMaxMB' => (int) $row['avatar_image_max_mb'], 'imageMaxDimension' => (int) $row['image_max_dimension'],
        'imageMaxPixels' => (int) $row['image_max_pixels'], 'avatarMaxDimension' => (int) $row['avatar_max_dimension'],
        'avatarMaxPixels' => (int) $row['avatar_max_pixels'], 'avatarMinDimension' => (int) $row['avatar_min_dimension'],
        'articleSiteZipMaxMB' => (int) ($row['article_site_zip_max_mb'] ?? 12),
        'articleSiteTotalMB' => (int) ($row['article_site_total_mb'] ?? 40),
        'articleSiteFileCount' => (int) ($row['article_site_file_count'] ?? 400),
    ];
}

function app_inspect_image(string $path): array
{
    if (!function_exists('getimagesize')) {
        app_error(500, '涓绘満缂哄皯鍥剧墖妫€娴嬭兘鍔涳紝璇峰惎鐢?PHP GD 鎵╁睍', 'IMAGE_INSPECTION_UNAVAILABLE');
    }

    $dimensions = @getimagesize($path);
    if (!$dimensions) app_error(400, '鍥剧墖鍐呭鏃犳晥', 'INVALID_IMAGE');

    $mime = '';
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detected = $finfo->file($path);
        if (is_string($detected)) $mime = $detected;
    }
    if ($mime === '' && isset($dimensions['mime']) && is_string($dimensions['mime'])) {
        $mime = $dimensions['mime'];
    }

    return [$mime, $dimensions];
}

function app_responsive_image_widths(string $kind): array
{
    if ($kind === 'avatar') return [96, 256];
    if ($kind === 'theme') return [640, 1280, 1920];
    return [320, 640, 960, 1280];
}

function app_image_gd_source(string $path, string $mime)
{
    $readers = [
        'image/jpeg' => 'imagecreatefromjpeg',
        'image/png' => 'imagecreatefrompng',
        'image/webp' => 'imagecreatefromwebp',
    ];
    $reader = $readers[$mime] ?? null;
    if ($reader === null || !function_exists($reader)) return false;
    return @$reader($path);
}

function app_image_gd_write($image, string $path, string $mime): bool
{
    if ($mime === 'image/jpeg' && function_exists('imagejpeg')) return @imagejpeg($image, $path, 82);
    if ($mime === 'image/png' && function_exists('imagepng')) return @imagepng($image, $path, 6);
    if ($mime === 'image/webp' && function_exists('imagewebp')) return @imagewebp($image, $path, 80);
    return false;
}

function app_generate_responsive_image_variants(string $sourcePath, string $basePath, string $extension, string $mime, array $dimensions, array $requestedWidths): array
{
    $sourceWidth = (int) ($dimensions[0] ?? 0);
    $sourceHeight = (int) ($dimensions[1] ?? 0);
    if ($mime === 'image/gif' || $sourceWidth < 2 || $sourceHeight < 2 || $sourceWidth * $sourceHeight > 16000000) return [];

    $widths = array_values(array_filter(array_unique(array_map('intval', $requestedWidths)), function (int $width) use ($sourceWidth): bool {
        return $width >= 64 && $width < $sourceWidth;
    }));
    sort($widths, SORT_NUMERIC);
    if (count($widths) === 0) return [];

    $source = app_image_gd_source($sourcePath, $mime);
    if ($source === false) return [];
    $createdPaths = [];
    try {
        foreach ($widths as $width) {
            $height = max(1, (int) round($sourceHeight * ($width / $sourceWidth)));
            $variant = imagecreatetruecolor($width, $height);
            if ($variant === false) throw new RuntimeException('Unable to allocate responsive image');
            if ($mime === 'image/png' || $mime === 'image/webp') {
                imagealphablending($variant, false);
                imagesavealpha($variant, true);
                $transparent = imagecolorallocatealpha($variant, 0, 0, 0, 127);
                imagefilledrectangle($variant, 0, 0, $width, $height, $transparent);
            }
            $copied = imagecopyresampled($variant, $source, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight);
            $path = $basePath . '@' . $width . 'w.' . $extension;
            $written = $copied && app_image_gd_write($variant, $path, $mime);
            imagedestroy($variant);
            if (!$written) {
                @unlink($path);
                throw new RuntimeException('Unable to encode responsive image');
            }
            @chmod($path, 0644);
            $createdPaths[] = $path;
        }
    } catch (Throwable $error) {
        foreach ($createdPaths as $path) @unlink($path);
        error_log('Responsive image generation skipped: ' . $error->getMessage());
        return [];
    } finally {
        imagedestroy($source);
    }
    return $widths;
}

function app_delete_responsive_image_family(string $sourcePath): bool
{
    $deleted = !is_file($sourcePath) || @unlink($sourcePath);
    if (preg_match('/^(.*)@responsive-[0-9-]+(\.[^.]+)$/i', $sourcePath, $match)) {
        foreach (glob($match[1] . '@*w' . $match[2]) ?: [] as $variantPath) {
            if (is_file($variantPath) && !@unlink($variantPath)) $deleted = false;
        }
    }
    return $deleted;
}

function app_upload_image(string $kind): array
{
    if (empty($_FILES['file']) || !is_array($_FILES['file'])) app_error(400, '璇烽€夋嫨瑕佷笂浼犵殑鍥剧墖', 'FILE_REQUIRED');
    $uploadError = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) app_error(413, '鍥剧墖瓒呰繃涓绘満 PHP 涓婁紶闄愬埗', 'PHP_UPLOAD_TOO_LARGE');
        if ($uploadError === UPLOAD_ERR_PARTIAL) app_error(400, '鍥剧墖鍙笂浼犱簡涓€閮ㄥ垎锛岃閲嶈瘯', 'UPLOAD_PARTIAL');
        if ($uploadError === UPLOAD_ERR_NO_FILE) app_error(400, '璇烽€夋嫨瑕佷笂浼犵殑鍥剧墖', 'FILE_REQUIRED');
        error_log('Image upload rejected by PHP with code ' . $uploadError);
        app_error(500, '涓绘満鏃犳硶鎺ユ敹涓婁紶鏂囦欢锛岃妫€鏌ヤ复鏃剁洰褰曞拰纾佺洏绌洪棿', 'PHP_UPLOAD_FAILED');
    }
    if (!is_uploaded_file((string) $_FILES['file']['tmp_name'])) app_error(400, '涓婁紶鏂囦欢鏃犳晥', 'UPLOAD_INVALID');
    $settings = app_upload_settings();
    $limits = ['article' => $settings['articleImageMaxMB'], 'theme' => $settings['themeBackgroundMaxMB'], 'avatar' => $settings['avatarImageMaxMB']];
    $limit = ($limits[$kind] ?? 2) * 1024 * 1024;
    if ((int) $_FILES['file']['size'] > $limit) app_error(413, '鍥剧墖瓒呰繃涓婁紶澶у皬闄愬埗', 'FILE_TOO_LARGE');

    [$mime, $dimensions] = app_inspect_image($_FILES['file']['tmp_name']);
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
    if (!isset($types[$mime])) app_error(400, '浠呮敮鎸?JPG銆丳NG銆丟IF 鍜?WebP 鍥剧墖', 'UNSUPPORTED_FILE');
    $maxDimension = $kind === 'avatar' ? $settings['avatarMaxDimension'] : $settings['imageMaxDimension'];
    $maxPixels = $kind === 'avatar' ? $settings['avatarMaxPixels'] : $settings['imageMaxPixels'];
    if ($dimensions[0] > $maxDimension || $dimensions[1] > $maxDimension || $dimensions[0] * $dimensions[1] > $maxPixels) app_error(400, '鍥剧墖灏哄瓒呰繃闄愬埗', 'IMAGE_TOO_LARGE');
    if ($kind === 'avatar' && min($dimensions[0], $dimensions[1]) < $settings['avatarMinDimension']) app_error(400, '澶村儚灏哄澶皬', 'IMAGE_TOO_SMALL');

    $config = app_config()['app'];
    $folder = $kind === 'article' ? 'articles' : ($kind === 'theme' ? 'theme' : 'avatars');
    $relative = $folder . '/' . date('Y/m');
    $directory = rtrim($config['upload_dir'], '/\\') . '/' . $relative;
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) app_error(500, '鏃犳硶鍒涘缓涓婁紶鐩綍', 'UPLOAD_DIR_FAILED');
    $baseName = date('YmdHis') . '-' . bin2hex(random_bytes(12));
    $name = $baseName . '.' . $types[$mime];
    $target = $directory . '/' . $name;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $target)) app_error(500, '淇濆瓨鍥剧墖澶辫触', 'UPLOAD_FAILED');
    @chmod($target, 0644);

    $widths = app_generate_responsive_image_variants(
        $target,
        $directory . '/' . $baseName,
        $types[$mime],
        $mime,
        $dimensions,
        app_responsive_image_widths($kind)
    );
    if (count($widths) > 0) {
        $responsiveName = $baseName . '@responsive-' . implode('-', $widths) . '.' . $types[$mime];
        $responsiveTarget = $directory . '/' . $responsiveName;
        if (@rename($target, $responsiveTarget)) {
            $name = $responsiveName;
            $target = $responsiveTarget;
        } else {
            foreach ($widths as $width) @unlink($directory . '/' . $baseName . '@' . $width . 'w.' . $types[$mime]);
            $widths = [];
        }
    }

    return [
        'name' => $name,
        'url' => rtrim($config['upload_url'], '/') . '/' . $relative . '/' . $name,
        'size' => (int) $_FILES['file']['size'],
        'responsiveWidths' => $widths,
    ];
}

function app_list_images(string $folder): array
{
    $config = app_config()['app'];
    $root = rtrim($config['upload_dir'], '/\\') . '/' . $folder;
    if (!is_dir($root)) return [];
    $items = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if (!$file->isFile() || !preg_match('/\.(?:jpe?g|png|gif|webp)$/i', $file->getFilename())) continue;
        if (preg_match('/@[0-9]+w\.(?:jpe?g|png|webp)$/i', $file->getFilename())) continue;
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen(rtrim($config['upload_dir'], '/\\')) + 1));
        $items[] = ['name' => $file->getFilename(), 'url' => rtrim($config['upload_url'], '/') . '/' . $relative, 'size' => $file->getSize(), 'updatedAt' => date(DATE_ATOM, $file->getMTime())];
    }
    usort($items, function ($a, $b) { return strcmp($b['updatedAt'], $a['updatedAt']); });
    return $items;
}

function app_upload_path_from_url(string $url): ?string
{
    $config = app_config()['app'];
    $prefix = rtrim((string) $config['upload_url'], '/') . '/';
    if (strpos($url, $prefix) !== 0) return null;
    $relative = ltrim(substr($url, strlen($prefix)), '/');
    if ($relative === '' || strpos($relative, '..') !== false || strpos($relative, "\0") !== false) return null;
    return rtrim((string) $config['upload_dir'], '/\\') . '/' . str_replace('/', DIRECTORY_SEPARATOR, $relative);
}

function app_cleanup_upload_assets(string $kind): array
{
    $folder = $kind === 'theme_background' ? 'theme' : ($kind === 'article_image' ? 'articles' : '');
    if ($folder === '') app_error(400, '涓嶆敮鎸佺殑娓呯悊绫诲瀷', 'INVALID_CLEANUP_KIND');
    $references = '';
    if ($folder === 'articles') {
        foreach (app_db()->query('SELECT cover_image, content FROM articles')->fetchAll() as $row) $references .= "\n" . (string) $row['cover_image'] . "\n" . (string) $row['content'];
        foreach (app_db()->query('SELECT cover_image FROM projects')->fetchAll(PDO::FETCH_COLUMN) as $url) $references .= "\n" . (string) $url;
    } else {
        $row = app_db()->query('SELECT background, background_image FROM themes WHERE id = 1')->fetch() ?: [];
        $references = (string) ($row['background'] ?? '') . "\n" . (string) ($row['background_image'] ?? '');
    }

    $config = app_config()['app'];
    $root = rtrim((string) $config['upload_dir'], '/\\') . '/' . $folder;
    if (!is_dir($root)) return ['removed' => 0, 'reclaimedBytes' => 0];
    $removed = 0;
    $reclaimed = 0;
    $cutoff = time() - 3600;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $file) {
        if ($file->isDir()) {
            @rmdir($file->getPathname());
            continue;
        }
        if (!$file->isFile() || $file->getMTime() > $cutoff) continue;
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen(rtrim((string) $config['upload_dir'], '/\\')) + 1));
        $url = rtrim((string) $config['upload_url'], '/') . '/' . $relative;
        if (strpos($references, $url) !== false) continue;
        if (preg_match('/^(.*)@[0-9]+w(\.[^.]+)$/i', $url, $variantMatch)
            && strpos($references, $variantMatch[1] . '@responsive-') !== false) continue;
        $size = $file->getSize();
        if (@unlink($file->getPathname())) { $removed++; $reclaimed += $size; }
    }
    return ['removed' => $removed, 'reclaimedBytes' => $reclaimed];
}

function app_delete_theme_background(string $name): array
{
    $name = basename(str_replace('\\', '/', $name));
    if ($name === '' || !preg_match('/\.(?:jpe?g|png|gif|webp)$/i', $name)) app_error(400, '鑳屾櫙鍥剧墖鍚嶇О鏃犳晥', 'INVALID_IMAGE_NAME');
    $config = app_config()['app'];
    $root = rtrim((string) $config['upload_dir'], '/\\') . '/theme';
    $target = null;
    $url = '';
    if (is_dir($root)) {
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $file) {
            if (!$file->isFile() || !hash_equals($file->getFilename(), $name)) continue;
            $target = $file->getPathname();
            $relative = str_replace('\\', '/', substr($target, strlen(rtrim((string) $config['upload_dir'], '/\\')) + 1));
            $url = rtrim((string) $config['upload_url'], '/') . '/' . $relative;
            break;
        }
    }
    if ($target === null) app_error(404, 'Background image not found.', 'NOT_FOUND');

    $statement = app_db()->prepare("UPDATE themes SET background_image = '' WHERE id = 1 AND background_image = ?");
    $statement->execute([$url]);
    $deleted = app_delete_responsive_image_family($target);
    app_public_cache_clear();
    if (!$deleted) return ['success' => false, 'warning' => '涓婚寮曠敤宸叉竻闄わ紝浣嗘枃浠跺垹闄ゅけ璐ワ紝璇锋鏌?uploads/theme 鏉冮檺'];
    return ['success' => true];
}

function app_handle_login(): void
{
    $body = app_body();
    $username = trim((string) ($body['username'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    app_audit_login_attempt($username);
    if (!app_security_peer_rate_limit_allow('admin-login', 60)) app_error(429, '鐧诲綍灏濊瘯杩囦簬棰戠箒锛岃绋嶅悗鍐嶈瘯', 'LOGIN_RATE_LIMITED');
    $clientHash = app_security_client_hash('admin-login');
    $database = app_db();
    $database->beginTransaction();
    try {
        $database->prepare('INSERT IGNORE INTO admin_login_attempts (client_hash, failed_attempts, locked_until, updated_at) VALUES (?, 0, NULL, NOW())')->execute([$clientHash]);
        $attemptStatement = $database->prepare('SELECT failed_attempts, locked_until FROM admin_login_attempts WHERE client_hash = ? FOR UPDATE');
        $attemptStatement->execute([$clientHash]);
        $attempt = $attemptStatement->fetch() ?: ['failed_attempts' => 0, 'locked_until' => null];
        $currentlyLocked = !empty($attempt['locked_until']) && strtotime((string) $attempt['locked_until']) > time();
        if ($currentlyLocked) {
            $database->commit();
            app_security_maybe_cleanup();
            app_error(429, 'Too many failed sign-in attempts. This IP is blocked for 24 hours.', 'LOGIN_LOCKED');
        }

        $admin = false;
        if ($username !== '' && strlen($username) <= 100) {
            $statement = $database->prepare('SELECT * FROM admin_account WHERE username = ? LIMIT 1');
            $statement->execute([$username]);
            $admin = $statement->fetch();
        }
        $dummyHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $passwordValid = strlen($password) <= 1024 && password_verify($password, $admin ? $admin['password_hash'] : $dummyHash);
        if (!$currentlyLocked && !empty($attempt['locked_until'])) {
            // A previous 24-hour ban has expired. Start a fresh failure
            // window before evaluating this request.
            $attempt['failed_attempts'] = 0;
            $database->prepare('UPDATE admin_login_attempts SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE client_hash = ?')->execute([$clientHash]);
        }

        if (!$admin || !$passwordValid || $currentlyLocked) {
            if (!$currentlyLocked) {
                $attempts = ((int) $attempt['failed_attempts']) + 1;
                // Five failed administrator attempts from the same client IP
                // trigger a server-side 24-hour ban. The hashed client key is
                // stored in admin_login_attempts, so the raw address is never
                // persisted and the check cannot be bypassed in the browser.
                $lockedUntil = $attempts >= 5 ? date('Y-m-d H:i:s', time() + 86400) : null;
                $update = $database->prepare('UPDATE admin_login_attempts SET failed_attempts = ?, locked_until = ?, updated_at = NOW() WHERE client_hash = ?');
                $update->execute([$attempts, $lockedUntil, $clientHash]);
                $currentlyLocked = $lockedUntil !== null;
            }
            $database->commit();
            app_security_maybe_cleanup();
            usleep(350000);
            app_error($currentlyLocked ? 429 : 401, $currentlyLocked ? 'Too many failed sign-in attempts. This IP is blocked for 24 hours.' : 'Invalid username or password.', $currentlyLocked ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS');
        }

        $database->prepare('DELETE FROM admin_login_attempts WHERE client_hash = ?')->execute([$clientHash]);
        $database->prepare('UPDATE admin_account SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?')->execute([$admin['id']]);
        $database->commit();
        app_security_maybe_cleanup();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    session_regenerate_id(true);
    // Keep administrator and public-account identities mutually exclusive in
    // the shared session cookie. This prevents analytics/session confusion
    // when an admin signs in after browsing as a public user.
    unset($_SESSION['user_id'], $_SESSION['user_email'], $_SESSION['user_session_version'], $_SESSION['user_created_at'], $_SESSION['user_last_seen_at']);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['admin_session_version'] = (int) $admin['session_version'];
    $_SESSION['admin_created_at'] = time();
    $_SESSION['admin_last_seen_at'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    app_json(['success' => true, 'username' => $admin['username'], 'csrfToken' => $_SESSION['csrf_token']]);
}

function app_article_unlock_token(array $row): string
{
    return hash('sha256', (string) ($row['access_password_hash'] ?? '') . '|' . (!empty($row['is_locked']) ? '1' : '0'));
}

function app_handle_article_unlock(int $id): void
{
    // Re-validate whichever authenticated identity is present. Do not trust
    // a stale admin_id/user_id field in a replayed session cookie.
    $authenticatedSession = false;
    if (!empty($_SESSION['user_id'])) {
        app_require_schema_014();
        app_user_required();
        $authenticatedSession = true;
    } elseif (!empty($_SESSION['admin_id'])) {
        app_admin_required();
        $authenticatedSession = true;
    }
    $body = app_body();
    $password = (string) ($body['password'] ?? '');
    if (!app_security_peer_rate_limit_allow('article-unlock-' . $id, 120)) app_error(429, '瀵嗙爜灏濊瘯杩囦簬棰戠箒锛岃绋嶅悗鍐嶈瘯', 'ARTICLE_PASSWORD_RATE_LIMITED');
    $clientHash = app_security_client_hash('article-unlock');
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare('SELECT * FROM articles WHERE id = ? AND published = 1');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) {
            $database->rollBack();
            app_error(404, 'Article not found.', 'NOT_FOUND');
        }
        if (!empty($row['login_required']) && !$authenticatedSession) {
            $database->rollBack();
            app_error(401, '请先登录后再解锁文章。', 'USER_UNAUTHENTICATED');
        }

        $database->prepare('INSERT IGNORE INTO article_unlock_attempts (article_id, client_hash, failed_attempts, locked_until, updated_at) VALUES (?, ?, 0, NULL, NOW())')->execute([$id, $clientHash]);
        $attemptStatement = $database->prepare('SELECT failed_attempts, locked_until FROM article_unlock_attempts WHERE article_id = ? AND client_hash = ? FOR UPDATE');
        $attemptStatement->execute([$id, $clientHash]);
        $attempt = $attemptStatement->fetch() ?: ['failed_attempts' => 0, 'locked_until' => null];
        $currentlyLocked = !empty($attempt['locked_until']) && strtotime((string) $attempt['locked_until']) > time();
        $passwordValid = strlen($password) <= 512
            && !empty($row['access_password_hash'])
            && password_verify($password, $row['access_password_hash']);

        if ($currentlyLocked || !$passwordValid) {
            if (!$currentlyLocked) {
                $attempts = ((int) $attempt['failed_attempts']) + 1;
                $lockedUntil = $attempts >= 5 ? date('Y-m-d H:i:s', time() + 900) : null;
                $update = $database->prepare('UPDATE article_unlock_attempts SET failed_attempts = ?, locked_until = ?, updated_at = NOW() WHERE article_id = ? AND client_hash = ?');
                $update->execute([$attempts >= 5 ? 0 : $attempts, $lockedUntil, $id, $clientHash]);
                $currentlyLocked = $lockedUntil !== null;
            }
            $database->commit();
            app_security_maybe_cleanup();
            app_error($currentlyLocked ? 429 : 403, $currentlyLocked ? 'Too many incorrect passwords. Try again in 15 minutes.' : 'Incorrect article password.', $currentlyLocked ? 'ARTICLE_PASSWORD_LOCKED' : 'INVALID_ARTICLE_PASSWORD');
        }

        $database->prepare('DELETE FROM article_unlock_attempts WHERE article_id = ? AND client_hash = ?')->execute([$id, $clientHash]);
        $database->commit();
        app_security_maybe_cleanup();
        $_SESSION['article_unlocks'][$id] = app_article_unlock_token($row);
        header('Cache-Control: no-store');
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        $article = app_article_row($row, true);
        $article['requiresPassword'] = false;
        $article['navigation'] = app_article_navigation((int) $row['id']);
        app_json($article);
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
}

function app_save_article(?int $id): void
{
    app_require_schema_011();
    $before = null;
    if ($id !== null) {
        $existing = app_db()->prepare('SELECT * FROM articles WHERE id = ?');
        $existing->execute([$id]);
        $before = $existing->fetch() ?: null;
        if ($before === null) app_error(404, 'Article not found.', 'NOT_FOUND');
    }
    $body = app_body();
    $title = trim((string) ($body['title'] ?? ''));
    $content = (string) ($body['content'] ?? '');
    $contentType = strtolower(trim((string) ($body['contentType'] ?? 'markdown'))) === 'static' ? 'static' : 'markdown';
    $siteKey = $contentType === 'static' ? trim((string) ($body['staticSiteKey'] ?? '')) : '';
    $siteName = $contentType === 'static' ? basename(str_replace('\\', '/', trim((string) ($body['staticSiteName'] ?? '')))) : '';
    if ($title === '') app_error(400, '鏍囬涓嶈兘涓虹┖', 'VALIDATION_FAILED');
    if ($contentType === 'markdown' && trim($content) === '') app_error(400, 'Markdown 姝ｆ枃涓嶈兘涓虹┖', 'VALIDATION_FAILED');
    if ($contentType === 'static' && !app_article_site_exists($siteKey)) app_error(400, '璇峰厛涓婁紶鍖呭惈 index.html 鐨勯潤鎬佸墠绔?ZIP', 'ARTICLE_SITE_REQUIRED');
    if ($contentType === 'static') $content = '';
    $locked = app_bool($body['isLocked'] ?? false);
    $loginRequired = app_bool($body['loginRequired'] ?? false);
    $password = (string) ($body['accessPassword'] ?? '');
    $hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null;
    $values = [
        $title, trim((string) ($body['summary'] ?? '')), $content, trim((string) ($body['coverImage'] ?? '')),
        trim((string) ($body['category'] ?? '')), trim((string) ($body['tags'] ?? '')),
        (function_exists('mb_substr') ? mb_substr(trim((string) ($body['seriesName'] ?? '')), 0, 120) : substr(trim((string) ($body['seriesName'] ?? '')), 0, 120)), app_int($body['seriesOrder'] ?? 0),
        array_key_exists('featured', $body) ? (app_bool($body['featured']) ? 1 : 0) : null,
        array_key_exists('displayOrder', $body) ? app_int($body['displayOrder']) : null,
        app_bool($body['published'] ?? false) ? 1 : 0,
        $contentType, $siteKey !== '' ? $siteKey : null, $siteName !== '' ? $siteName : null, $locked ? 1 : 0, $loginRequired ? 1 : 0,
    ];
    $oldSiteKey = '';
    if ($id === null) {
        if ($locked && $hash === null) app_error(400, '鍔犻攣鏂囩珷蹇呴』璁剧疆璁块棶瀵嗙爜', 'PASSWORD_REQUIRED');
        $statement = app_db()->prepare('INSERT INTO articles (title, summary, content, cover_image, category, tags, series_name, series_order, featured, display_order, published, content_type, static_site_key, static_site_name, is_locked, login_required, access_password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
        $values[8] = $values[8] ?? 0;
        $values[9] = $values[9] ?? 0;
        $statement->execute(array_merge($values, [$hash]));
        $id = (int) app_db()->lastInsertId();
        $status = 201;
    } else {
        $oldSiteKey = (string) ($before['static_site_key'] ?? '');
        if (!$locked) $hash = null;
        elseif ($hash === null) $hash = $before['access_password_hash'];
        $statement = app_db()->prepare('UPDATE articles SET title=?, summary=?, content=?, cover_image=?, category=?, tags=?, series_name=?, series_order=?, featured=COALESCE(?,featured), display_order=COALESCE(?,display_order), published=?, content_type=?, static_site_key=?, static_site_name=?, is_locked=?, login_required=?, access_password_hash=?, updated_at=NOW() WHERE id=?');
        $statement->execute(array_merge($values, [$hash, $id]));
        $status = 200;
    }
    $statement = app_db()->prepare('SELECT * FROM articles WHERE id = ?');
    $statement->execute([$id]);
    $after = $statement->fetch() ?: null;
    if ($oldSiteKey !== '' && $oldSiteKey !== $siteKey) app_article_site_delete_if_unreferenced($oldSiteKey);
    app_public_cache_clear();
    app_audit_set_change('article', $id, $before, $after, $before === null ? 'CREATE article' : 'UPDATE article');
    app_json(app_article_row($after ?: [], true, true), $status);
}

function app_delete_article(int $id): void
{
    app_require_schema_011();
    $statement = app_db()->prepare('SELECT * FROM articles WHERE id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, 'Article not found.', 'NOT_FOUND');
    app_db()->prepare('DELETE FROM articles WHERE id = ?')->execute([$id]);
    app_article_site_delete_if_unreferenced((string) ($row['static_site_key'] ?? ''));
    app_public_cache_clear();
    app_audit_set_change('article', $id, $row, null, 'DELETE article');
    app_json(['success' => true]);
}

/** Apply a single bulk action to up to 100 articles, auditing every item. */
function app_bulk_articles_v2(): void
{
    app_require_schema_013();
    $body = app_body();
    $ids = $body['ids'] ?? $body['articleIds'] ?? [];
    if (!is_array($ids)) app_error(400, 'ids must be an array.', 'INVALID_ARTICLE_IDS');
    $ids = array_values(array_unique(array_filter(array_map(static fn($value): int => (int) $value, $ids), static fn(int $value): bool => $value > 0)));
    if (count($ids) < 1 || count($ids) > 100) app_error(400, '请选择 1 至 100 篇文章。', 'INVALID_ARTICLE_IDS');
    $action = strtolower(trim((string) ($body['action'] ?? '')));
    $aliases = ['login_required' => 'login-required', 'set-login-required' => 'login-required', 'set-public' => 'public', 'set-published' => 'publish', 'set-unpublished' => 'unpublish'];
    $action = $aliases[$action] ?? $action;
    if (!in_array($action, ['login-required', 'public', 'publish', 'unpublish', 'delete'], true)) app_error(400, 'Unsupported bulk article action.', 'INVALID_ARTICLE_ACTION');
    if ($action === 'delete' && !app_bool($body['confirm'] ?? false)) app_error(400, '请确认批量删除，此操作不可撤销。', 'DELETE_CONFIRMATION_REQUIRED');
    $database = app_db();
    $database->beginTransaction();
    $audits = [];
    try {
        $select = $database->prepare('SELECT * FROM articles WHERE id = ? FOR UPDATE');
        foreach ($ids as $id) {
            $select->execute([$id]);
            $before = $select->fetch();
            if (!$before) continue;
            if ($action === 'delete') {
                $database->prepare('DELETE FROM articles WHERE id = ?')->execute([$id]);
                app_article_site_delete_if_unreferenced((string) ($before['static_site_key'] ?? ''));
                $audits[] = [$id, $before, null, 'DELETE article'];
            } else {
                $column = in_array($action, ['login-required', 'public'], true) ? 'login_required' : 'published';
                $value = in_array($action, ['login-required', 'publish'], true) ? 1 : 0;
                $database->prepare("UPDATE articles SET $column = ?, updated_at = NOW() WHERE id = ?")->execute([$value, $id]);
                $afterStatement = $database->prepare('SELECT * FROM articles WHERE id = ?');
                $afterStatement->execute([$id]);
                $after = $afterStatement->fetch() ?: null;
                $audits[] = [$id, $before, $after, 'UPDATE article'];
            }
        }
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    foreach ($audits as [$id, $before, $after, $auditAction]) {
        app_audit_set_change('article', $id, $before, $after, $auditAction);
        // Persist each item immediately so one bulk request remains fully traceable.
        app_audit_insert(200, true);
    }
    app_public_cache_clear();
    app_json(['success' => true, 'action' => $action, 'processed' => count($audits), 'requested' => count($ids)]);
}

function app_generic_save(string $resource, ?int $id): void
{
    $before = null;
    if ($id !== null && in_array($resource, ['projects', 'skills', 'feature_cards'], true)) {
        $existing = app_db()->prepare("SELECT * FROM `$resource` WHERE id = ?");
        $existing->execute([$id]);
        $before = $existing->fetch() ?: null;
        if ($before === null) app_error(404, 'Resource not found.', 'NOT_FOUND');
    }
    $body = app_body();
    $now = date('Y-m-d H:i:s');
    if ($resource === 'projects') {
        if (trim((string) ($body['name'] ?? '')) === '') app_error(400, '椤圭洰鍚嶇О涓嶈兘涓虹┖');
        $columns = ['name','description','cover_image','tech_stack','github_url','demo_url','stars','featured','display_order'];
        $values = [trim($body['name']), trim((string)($body['description']??'')), trim((string)($body['coverImage']??'')), trim((string)($body['techStack']??'')), trim((string)($body['githubUrl']??'')), trim((string)($body['demoUrl']??'')), app_int($body['stars']??0), app_bool($body['featured']??false)?1:0, app_int($body['displayOrder']??0)];
        if ($id === null) { $sql='INSERT INTO projects ('.implode(',',$columns).',created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?, ?, ?)'; $values[]=$now; $values[]=$now; }
        else { $sql='UPDATE projects SET name=?,description=?,cover_image=?,tech_stack=?,github_url=?,demo_url=?,stars=?,featured=?,display_order=?,updated_at=? WHERE id=?'; $values[]=$now; $values[]=$id; }
    } elseif ($resource === 'skills') {
        if (trim((string) ($body['name'] ?? '')) === '') app_error(400, 'Skill name is required.');
        $values=[trim($body['name']),trim((string)($body['category']??'')),app_clamp(app_int($body['proficiency']??0),0,100),trim((string)($body['icon']??'')),app_int($body['displayOrder']??0)];
        if ($id===null) $sql='INSERT INTO skills (name,category,proficiency,icon,display_order) VALUES (?,?,?,?,?)';
        else { $sql='UPDATE skills SET name=?,category=?,proficiency=?,icon=?,display_order=? WHERE id=?'; $values[]=$id; }
    } else {
        if (trim((string) ($body['title'] ?? '')) === '') app_error(400, '鍗＄墖鏍囬涓嶈兘涓虹┖');
        $values=[trim($body['title']),trim((string)($body['titleEn']??'')),trim((string)($body['description']??'')),trim((string)($body['descriptionEn']??'')),trim((string)($body['icon']??'Code')),trim((string)($body['gradient']??'from-indigo-500 to-purple-500')),app_int($body['displayOrder']??0),app_bool($body['enabled']??true)?1:0];
        if ($id===null) $sql='INSERT INTO feature_cards (title,title_en,description,description_en,icon,gradient,display_order,enabled) VALUES (?,?,?,?,?,?,?,?)';
        else { $sql='UPDATE feature_cards SET title=?,title_en=?,description=?,description_en=?,icon=?,gradient=?,display_order=?,enabled=? WHERE id=?'; $values[]=$id; }
    }
    app_db()->prepare($sql)->execute($values);
    $savedId = $id ?? (int) app_db()->lastInsertId();
    $afterStatement = app_db()->prepare("SELECT * FROM `$resource` WHERE id = ?");
    $afterStatement->execute([$savedId]);
    $after = $afterStatement->fetch() ?: null;
    app_public_cache_clear();
    $label = $resource === 'feature_cards' ? 'feature_card' : rtrim($resource, 's');
    app_audit_set_change($label, $savedId, $before, $after, $before === null ? 'CREATE ' . $label : 'UPDATE ' . $label);
    app_json(['success'=>true,'id'=>$savedId], $id===null?201:200);
}

function app_generic_delete(string $resource, int $id): void
{
    if (!in_array($resource, ['projects', 'skills', 'feature_cards'], true)) app_error(400, 'Resource not supported.', 'INVALID_RESOURCE');
    $statement = app_db()->prepare("SELECT * FROM `$resource` WHERE id = ?");
    $statement->execute([$id]);
    $before = $statement->fetch();
    if (!$before) app_error(404, 'Resource not found.', 'NOT_FOUND');
    app_db()->prepare("DELETE FROM `$resource` WHERE id = ?")->execute([$id]);
    app_public_cache_clear();
    $label = $resource === 'feature_cards' ? 'feature_card' : rtrim($resource, 's');
    app_audit_set_change($label, $id, $before, null, 'DELETE ' . $label);
    app_json(['success' => true]);
}

function app_public_site_url(): string
{
    $configured = trim((string) (app_config()['app']['site_url'] ?? ''));
    $configuredScheme = strtolower((string) parse_url($configured, PHP_URL_SCHEME));
    if ($configured !== '' && in_array($configuredScheme, ['http', 'https'], true) && filter_var($configured, FILTER_VALIDATE_URL)) return rtrim($configured, '/');

    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    if (!preg_match('/^[a-z0-9.-]+(?::\d{1,5})?$/', $host)) $host = 'localhost';
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    return ($https ? 'https://' : 'http://') . $host;
}

function app_public_text_response(string $body, string $contentType, int $maxAge = 3600): void
{
    $etag = '"' . hash('sha256', $body) . '"';
    header('Content-Type: ' . $contentType);
    if ($maxAge < 0) header('Cache-Control: no-store');
    else header('Cache-Control: public, max-age=' . max(0, $maxAge) . ', stale-while-revalidate=300');
    header('ETag: ' . $etag);
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'HEAD') echo $body;
    exit;
}

function app_public_robots(): void
{
    $siteUrl = app_public_site_url();
    $body = "User-agent: *\n"
        . "Allow: /\n"
        . "Disallow: /api/admin/\n"
        . "Disallow: /api/auth/\n"
        . "Disallow: /app/\n"
        . "Disallow: /config/\n"
        . "Disallow: /migrations/\n"
        . "Disallow: /uploads/article-sites/\n\n"
        . 'Sitemap: ' . $siteUrl . "/sitemap.xml\n";
    app_public_text_response($body, 'text/plain; charset=utf-8', 3600);
}

function app_public_sitemap(): void
{
    $siteUrl = app_public_site_url();
    $escape = function (string $value): string {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    };
    $entries = [
        ['path' => '/', 'priority' => '1.0'],
        ['path' => '/blog', 'priority' => '0.9'],
        ['path' => '/projects', 'priority' => '0.8'],
        ['path' => '/friends', 'priority' => '0.6'],
        ['path' => '/monitor', 'priority' => '0.4'],
    ];
    $articles = app_db()->query('SELECT id, updated_at FROM articles WHERE published=1 ORDER BY updated_at DESC')->fetchAll();
    foreach ($articles as $article) {
        $entries[] = [
            'path' => '/blog/' . (int) $article['id'],
            'priority' => '0.8',
            'lastmod' => !empty($article['updated_at']) ? date('Y-m-d', strtotime((string) $article['updated_at'])) : '',
        ];
    }

    $body = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        . "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
    foreach ($entries as $entry) {
        $body .= "  <url>\n    <loc>" . $escape($siteUrl . $entry['path']) . "</loc>\n";
        if (!empty($entry['lastmod'])) $body .= '    <lastmod>' . $escape((string) $entry['lastmod']) . "</lastmod>\n";
        $body .= '    <priority>' . $entry['priority'] . "</priority>\n  </url>\n";
    }
    $body .= "</urlset>\n";
    app_public_text_response($body, 'application/xml; charset=utf-8', 3600);
}

function app_handle_request(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: SAMEORIGIN');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    // Only advertise HSTS when this request is already HTTPS; this keeps local
    // HTTP development and shared-host health checks usable.
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
        || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    if ($isHttps) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $methodOverride = strtoupper((string) ($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? ''));
    if ($method === 'POST' && $methodOverride === 'DELETE') $method = 'DELETE';
    $route = trim((string) ($_GET['route'] ?? ''), '/');
    if ($route === '') {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
        $route = preg_replace('#^.*?/api/?#', '', $path);
        $route = trim((string) $route, '/');
    }
    $route = preg_replace('#^(?:api/)+#', '', $route);
    app_audit_request_start($route, $method);
    app_audit_register_shutdown();
    $isAdminRoute = strpos($route, 'admin/') === 0;
    $isAdminAuthRoute = $route === 'auth/login' || $route === 'auth/logout';
    $isUserAuthRoute = in_array($route, ['auth/user-register', 'auth/user-login', 'auth/user-logout', 'auth/user-session'], true);
    if ($isAdminRoute || $isAdminAuthRoute) app_admin_entry_required();
    if ($isAdminRoute || $isAdminAuthRoute) {
        header('Cache-Control: no-store');
        header('Pragma: no-cache');
    }
    $needsSession = strpos($route, 'admin/') === 0
        || strpos($route, 'auth/') === 0
        || $route === 'public/analytics/visit'
        || preg_match('#^public/articles/\d+(?:/unlock)?$#', $route);
    if ($needsSession) app_start_session();

    try {
        if (in_array($method, ['GET', 'HEAD'], true) && $route === 'robots.txt') app_public_robots();
        if (in_array($method, ['GET', 'HEAD'], true) && $route === 'sitemap.xml') app_public_sitemap();
        if (in_array($method, ['GET', 'HEAD'], true) && $route === 'feed.xml') app_public_feed('rss');
        if (in_array($method, ['GET', 'HEAD'], true) && $route === 'atom.xml') app_public_feed('atom');
        if ($method === 'GET' && $route === 'health') {
            app_db()->query('SELECT 1');
            app_db()->query('SELECT session_version FROM admin_account LIMIT 1');
            app_db()->query('SELECT 1 FROM admin_login_attempts LIMIT 1');
            app_db()->query('SELECT 1 FROM friend_links LIMIT 1');
            app_db()->query('SELECT target_type, target_id, target_title FROM guest_messages LIMIT 1');
            app_db()->query('SELECT transferred_bytes FROM site_visits LIMIT 1');
            app_db()->query('SELECT 1 FROM site_analytics_totals LIMIT 1');
            app_require_schema_010();
            app_require_schema_011();
            app_require_schema_012();
            app_require_schema_013();
            app_require_schema_014();
            app_json(['status' => 'ok', 'database' => 'ok', 'schema' => '014']);
        }
        if ($method === 'POST' && $route === 'auth/login') app_handle_login();
        if ($method === 'POST' && $route === 'auth/logout') {
            if (!empty($_SESSION['admin_id'])) app_csrf_required();
            app_audit_logout();
            app_destroy_session_state();
            app_json(['success' => true]);
        }
        if ($method === 'POST' && $route === 'auth/user-register') { app_require_schema_014(); app_user_register(); }
        if ($method === 'POST' && $route === 'auth/user-login') { app_require_schema_014(); app_user_login(); }
        if ($method === 'POST' && $route === 'auth/user-logout') { app_require_schema_014(); app_user_logout(); }
        if ($method === 'GET' && $route === 'auth/user-session') { app_require_schema_014(); app_json(app_user_session_payload()); }

        if ($method === 'GET' && $route === 'public/profile') {
            $language = strtolower((string) ($_GET['lang'] ?? 'zh')) === 'en' ? 'en' : 'zh';
            app_json_cached(app_public_cache_remember('profile-' . $language, 20, function (): array { return app_profile(true); }), 30, 120);
        }
        if ($method === 'GET' && $route === 'public/stats') {
            $profile=app_profile(true); $projects=(int)app_db()->query('SELECT COUNT(*) FROM projects')->fetchColumn(); $articles=(int)app_db()->query('SELECT COUNT(*) FROM articles WHERE published=1')->fetchColumn(); $stars=(int)app_db()->query('SELECT COALESCE(SUM(stars),0) FROM projects')->fetchColumn();
            app_json(['coffeeCount'=>$profile['coffeeCount'],'projectCount'=>$projects,'articleCount'=>$articles,'starsCount'=>$profile['starsCount'] ?: $stars]);
        }
        if ($method === 'GET' && $route === 'public/home') {
            app_require_schema_011();
            $language = strtolower((string) ($_GET['lang'] ?? 'zh')) === 'en' ? 'en' : 'zh';
            $payload = app_public_cache_remember('home-' . $language, 20, function (): array {
                $articlePage=$_GET['page']??null; $articleSize=$_GET['size']??null; $_GET['page']=0; $_GET['size']=3; $articleResult=app_articles(false); if($articlePage===null)unset($_GET['page']);else $_GET['page']=$articlePage; if($articleSize===null)unset($_GET['size']);else $_GET['size']=$articleSize;
                $profile=app_profile(true); $allProjects=app_projects(false); $projects=array_values(array_filter($allProjects, function(array $project): bool { return !empty($project['featured']); })); $skills=app_skills(); $cards=app_feature_cards(true); $stars=array_sum(array_column($allProjects,'stars'));
                return ['profile'=>$profile,'articles'=>$articleResult['content'],'projects'=>$projects,'skills'=>$skills,'featureCards'=>$cards,'stats'=>['coffeeCount'=>$profile['coffeeCount'],'projectCount'=>count($allProjects),'articleCount'=>$articleResult['totalElements'],'starsCount'=>$profile['starsCount'] ?: $stars]];
            });
            app_json_cached($payload, 30, 120);
        }
        if ($method === 'GET' && $route === 'public/articles/archive') {
            app_require_schema_011();
            $rawYear = trim((string) ($_GET['year'] ?? ''));
            $year = 0;
            if ($rawYear !== '') {
                $maximumYear = (int) date('Y') + 1;
                if (!preg_match('/^\d{4}$/', $rawYear) || (int) $rawYear < 1970 || (int) $rawYear > $maximumYear) {
                    app_error(400, 'Year must be between 1970 and ' . $maximumYear . '.', 'INVALID_YEAR');
                }
                $year = (int) $rawYear;
            }
            app_json_cached(app_public_cache_remember('article-archive-' . $year, 60, function () use ($year): array { return app_article_archive($year); }), 60, 300);
        }
        if ($method === 'GET' && $route === 'public/articles/series') {
            app_require_schema_011();
            app_json_cached(app_public_cache_remember('article-series', 60, function (): array { return app_article_series(); }), 60, 300);
        }
        if ($method === 'GET' && $route === 'public/articles/popular') {
            app_require_schema_011();
            $limit = app_clamp(app_int($_GET['limit'] ?? 6, 6), 1, 20);
            app_json_cached(app_public_cache_remember('article-popular-' . $limit, 15, function (): array { return app_discovery_articles('popular'); }), 15, 60);
        }
        if ($method === 'GET' && $route === 'public/articles/featured') {
            app_require_schema_011();
            $limit = app_clamp(app_int($_GET['limit'] ?? 6, 6), 1, 20);
            app_json_cached(app_public_cache_remember('article-featured-' . $limit, 60, function (): array { return app_discovery_articles('featured'); }), 60, 300);
        }
        if ($method === 'GET' && $route === 'public/discovery') {
            app_require_schema_011();
            $limit = app_clamp(app_int($_GET['limit'] ?? 6, 6), 1, 20);
            app_json_cached(app_public_cache_remember('article-discovery-' . $limit, 15, function () use ($limit): array {
                return ['featured' => app_discovery_articles('featured', $limit), 'popular' => app_discovery_articles('popular', $limit), 'series' => app_article_series(3)];
            }), 15, 60);
        }
        if ($method === 'GET' && $route === 'public/articles') { app_require_schema_011(); app_json(app_articles(false)); }
        if (in_array($method, ['GET', 'HEAD'], true)
            && preg_match('#^public/article-sites/(\d+)/([a-f0-9-]{32,64})/(\d+)/(\d+)/([a-f0-9]{64})(?:/(.*))?$#i', $route, $match)) {
            app_article_site_serve((int) $match[1], $match[2], (int) $match[3], (int) $match[4], strtolower($match[5]), (string) ($match[6] ?? ''));
        }
        if ($method === 'GET' && preg_match('#^public/articles/(\d+)$#', $route, $match)) {
            app_require_schema_014();
            $statement=app_db()->prepare('SELECT * FROM articles WHERE id=? AND published=1'); $statement->execute([(int)$match[1]]); $row=$statement->fetch(); if(!$row)app_error(404, 'Article not found.', 'NOT_FOUND');
            // Presence of a user session is not enough for gated content: a
            // locked/revoked account must lose access even if its old cookie
            // remains valid. Public articles stay readable as a guest when a
            // stale optional user session is present.
            if (!empty($row['login_required'])) {
                if (!empty($_SESSION['user_id'])) app_user_required();
                elseif (!empty($_SESSION['admin_id'])) app_admin_required();
            }
            $isAuthenticated = !empty($_SESSION['user_id']) || !empty($_SESSION['admin_id']);
            if (!empty($row['login_required']) && !$isAuthenticated) {
                header('Cache-Control: no-store');
                $article = app_article_row($row, false);
                $article['requiresLogin'] = true;
                $article['loginRequired'] = true;
                app_json($article);
            }
            $unlockValue = $_SESSION['article_unlocks'][(int) $row['id']] ?? '';
            $unlocked = is_string($unlockValue) && hash_equals(app_article_unlock_token($row), $unlockValue);
            header('Cache-Control: no-store');
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close(); if($row['is_locked']&&!$unlocked){$article=app_article_row($row,false);$article['requiresPassword']=true;app_json($article);} app_db()->prepare('UPDATE articles SET views=views+1 WHERE id=?')->execute([$row['id']]); $row['views']++;
            $article=app_article_row($row,true);$article['requiresPassword']=false;$article['adminAuthenticated']=!empty($_SESSION['admin_id']);$article['navigation']=app_article_navigation((int) $row['id']);app_json($article);
        }
        if ($method === 'POST' && preg_match('#^public/articles/(\d+)/unlock$#', $route, $match)) {
            if (!empty($_SESSION['user_id']) || !empty($_SESSION['admin_id'])) app_require_schema_014();
            app_handle_article_unlock((int) $match[1]);
        }
        if ($method === 'GET' && $route === 'public/categories') app_json(app_db()->query("SELECT DISTINCT category FROM articles WHERE published=1 AND category<>'' ORDER BY category")->fetchAll(PDO::FETCH_COLUMN));
        if ($method === 'GET' && $route === 'public/tags') { $tags=[];foreach(app_db()->query("SELECT tags FROM articles WHERE published=1 AND tags<>''")->fetchAll(PDO::FETCH_COLUMN) as $list){foreach(explode(',',$list) as $tag){$tag=trim($tag);if($tag!=='')$tags[$tag]=true;}}$result=array_keys($tags);sort($result,SORT_NATURAL|SORT_FLAG_CASE);app_json($result); }
        if ($method === 'GET' && $route === 'public/projects') app_json(app_projects(false));
        if ($method === 'GET' && $route === 'public/projects/featured') app_json(app_projects(true));
        if ($method === 'GET' && $route === 'public/skills') app_json(app_skills());
        if ($method === 'GET' && $route === 'public/feature-cards') app_json(app_feature_cards(true));
        if ($method === 'GET' && $route === 'public/theme') app_json_cached(app_public_cache_remember('theme', 20, function (): array { return app_theme(); }), 30, 120);
        if ($method === 'GET' && $route === 'public/theme/background-images') app_json(app_list_images('theme'));
        if ($method === 'GET' && $route === 'public/live2d-model') {
            header('Cache-Control: public, max-age=60, stale-while-revalidate=300');
            app_json(app_live2d());
        }
        if ($method === 'POST' && $route === 'public/analytics/visit') app_json(app_analytics_record_visit(), 201);
        if ($method === 'GET' && $route === 'public/site-monitor') app_json_cached(app_analytics_public_monitor(), 30, 120);
        if ($method === 'GET' && $route === 'public/friends') app_json_cached(app_public_friend_links(), 60, 300);
        if ($method === 'GET' && $route === 'public/guest-message-targets') app_json_cached(app_public_guest_message_targets(), 30, 120);
        if ($method === 'GET' && $route === 'public/guest-messages') app_json(app_public_guest_messages());
        if ($method === 'GET' && preg_match('#^public/guest-messages/(\d+)$#', $route, $match)) app_json(app_public_guest_message((int) $match[1]));
        if ($method === 'POST' && $route === 'public/guest-messages') app_json(app_create_guest_message(), 201);
        if ($method === 'GET' && $route === 'public/search') {
            $q = trim((string) ($_GET['q'] ?? ''));
            if (function_exists('mb_substr')) $q = mb_substr($q, 0, 80);
            else $q = substr($q, 0, 80);
            if ($q === '') app_json([]);
            $type = strtolower(trim((string) ($_GET['type'] ?? 'all')));
            if (!in_array($type, ['all', 'article', 'project', 'skill', 'message'], true)) $type = 'all';
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';
            $results = [];
            if (in_array($type, ['all', 'article'], true)) {
                $statement = app_db()->prepare('SELECT id, title, summary FROM articles WHERE published = 1 AND (title LIKE ? OR summary LIKE ? OR category LIKE ? OR tags LIKE ? OR (login_required = 0 AND content LIKE ?)) ORDER BY created_at DESC, id DESC LIMIT 20');
                $statement->execute([$like, $like, $like, $like, $like]);
                foreach ($statement->fetchAll() as $row) $results[] = ['type' => 'article', 'id' => (int) $row['id'], 'title' => $row['title'], 'description' => $row['summary'], 'url' => '/blog/' . $row['id']];
            }
            if (in_array($type, ['all', 'project'], true)) {
                $statement = app_db()->prepare('SELECT id, name, description FROM projects WHERE name LIKE ? OR description LIKE ? OR tech_stack LIKE ? ORDER BY display_order ASC, id DESC LIMIT 20');
                $statement->execute([$like, $like, $like]);
                foreach ($statement->fetchAll() as $row) $results[] = ['type' => 'project', 'id' => (int) $row['id'], 'title' => $row['name'], 'description' => $row['description'], 'url' => '/projects'];
            }
            if (in_array($type, ['all', 'skill'], true)) {
                $statement = app_db()->prepare('SELECT id, name, category FROM skills WHERE name LIKE ? OR category LIKE ? ORDER BY display_order ASC, id DESC LIMIT 20');
                $statement->execute([$like, $like]);
                foreach ($statement->fetchAll() as $row) $results[] = ['type' => 'skill', 'id' => (int) $row['id'], 'title' => $row['name'], 'description' => $row['category'], 'url' => '/#skills'];
            }
            if (in_array($type, ['all', 'message'], true)) {
                $statement = app_db()->prepare("SELECT id, nickname, content, target_title FROM guest_messages WHERE status = 'visible' AND deleted_at IS NULL AND (nickname LIKE ? OR content LIKE ? OR target_title LIKE ?) ORDER BY created_at DESC, id DESC LIMIT 20");
                $statement->execute([$like, $like, $like]);
                foreach ($statement->fetchAll() as $row) $results[] = ['type' => 'message', 'id' => (int) $row['id'], 'title' => $row['nickname'], 'description' => $row['content'], 'url' => '/friends#message-' . (int) $row['id']];
            }
            app_json(array_slice($results, 0, 60));
        }

        if (strpos($route, 'admin/') === 0) {
            app_admin_required();
            header('Cache-Control: no-store');
            if (!in_array($method, ['GET','HEAD','OPTIONS'], true)) app_csrf_required();
        }
        if ($method === 'GET' && $route === 'admin/session') app_json(['authenticated'=>true,'username'=>$_SESSION['admin_username'],'csrfToken'=>app_ensure_csrf()]);
        if ($method === 'GET' && $route === 'admin/dashboard-stats') app_json(array_merge(['articleCount'=>(int)app_db()->query('SELECT COUNT(*) FROM articles')->fetchColumn(),'publishedArticleCount'=>(int)app_db()->query('SELECT COUNT(*) FROM articles WHERE published=1')->fetchColumn(),'projectCount'=>(int)app_db()->query('SELECT COUNT(*) FROM projects')->fetchColumn(),'skillCount'=>(int)app_db()->query('SELECT COUNT(*) FROM skills')->fetchColumn(),'totalViews'=>(int)app_db()->query('SELECT COALESCE(SUM(views),0) FROM articles')->fetchColumn()], app_analytics_dashboard_summary()));
        if ($method === 'GET' && $route === 'admin/analytics') { app_require_schema_013(); app_json(app_analytics_report()); }
        if ($method === 'GET' && in_array($route, ['admin/users', 'admin/user-accounts'], true)) { app_json(app_admin_users()); }
        if ($method === 'PUT' && preg_match('#^admin/(?:users|user-accounts)/(\\d+)$#', $route, $match)) app_admin_user_update((int) $match[1]);
        if ($method === 'DELETE' && preg_match('#^admin/(?:users|user-accounts)/(\\d+)$#', $route, $match)) app_admin_user_delete((int) $match[1]);
        if ($method === 'GET' && $route === 'admin/audit-logs') { app_require_schema_012(); app_json(app_audit_logs()); }
        if ($method === 'GET' && $route === 'admin/backup-manifest') app_json(app_admin_backup_manifest());
        if ($method === 'GET' && $route === 'admin/health') { app_require_schema_010(); app_require_schema_011(); app_require_schema_012(); app_require_schema_013(); app_require_schema_014(); app_json(['status' => 'ok', 'database' => 'ok', 'schema' => '014', 'manifest' => app_admin_backup_manifest()]); }
        if ($method === 'POST' && $route === 'admin/backup-export') app_admin_backup_export();
        if ($method === 'POST' && $route === 'admin/backup-import') app_admin_backup_import();
        if ($method === 'GET' && $route === 'admin/friends') app_json(app_admin_friend_links());
        if ($method === 'POST' && $route === 'admin/friends') app_json(app_save_friend_link(null), 201);
        if (preg_match('#^admin/friends/(\d+)$#', $route, $match)) {
            if ($method === 'PUT') app_json(app_save_friend_link((int) $match[1]));
            if ($method === 'DELETE') app_json(app_delete_friend_link((int) $match[1]));
        }
        if ($method === 'GET' && $route === 'admin/guest-messages') app_json(app_admin_guest_messages());
        if ($method === 'PUT' && preg_match('#^admin/guest-messages/(\d+)/status$#', $route, $match)) app_json(app_update_guest_message_status((int) $match[1]));
        if ($method === 'DELETE' && preg_match('#^admin/guest-messages/(\d+)$#', $route, $match)) app_json(app_delete_guest_message((int) $match[1]));
        if ($method === 'GET' && $route === 'admin/articles') { app_require_schema_013(); app_json(app_articles(true)); }
        if ($method === 'GET' && $route === 'admin/article-series') {
            app_require_schema_011();
            $statement = app_db()->query("SELECT series_name AS name, COUNT(*) AS article_count FROM articles WHERE TRIM(series_name) <> '' GROUP BY series_name ORDER BY series_name ASC LIMIT 200");
            app_json(array_map(static function (array $row): array {
                return ['name' => (string) $row['name'], 'articleCount' => (int) $row['article_count']];
            }, $statement->fetchAll()));
        }
        if ($method === 'POST' && $route === 'admin/articles') { app_require_schema_013(); app_save_article(null); }
        if ($method === 'POST' && in_array($route, ['admin/articles/bulk', 'admin/articles/batch'], true)) app_bulk_articles_v2();
        if (preg_match('#^admin/articles/(\d+)$#',$route,$match)) {
            $id=(int)$match[1];
            if($method==='GET'){app_require_schema_013();$statement=app_db()->prepare('SELECT * FROM articles WHERE id=?');$statement->execute([$id]);$article=$statement->fetch();if(!$article)app_error(404, 'Article not found.', 'NOT_FOUND');app_json(app_article_row($article,true,true));}
            if($method==='PUT'){app_require_schema_013();app_save_article($id);}
            if($method==='DELETE')app_delete_article($id);
        }
        if ($method === 'POST' && $route === 'admin/article-sites') {
            try {
                app_json(app_article_site_upload(), 201);
            } catch (InvalidArgumentException $error) {
                app_error(400, $error->getMessage(), 'ARTICLE_SITE_INVALID');
            } catch (RuntimeException $error) {
                error_log($error->__toString());
                app_error(500, $error->getMessage(), 'ARTICLE_SITE_UNAVAILABLE');
            }
        }
        if ($method === 'GET' && $route === 'admin/article-images') app_json(app_list_images('articles'));
        if ($method === 'POST' && $route === 'admin/article-images') app_json(app_upload_image('article'),201);
        if ($method === 'POST' && $route === 'admin/upload-assets/cleanup') app_json(app_cleanup_upload_assets((string) ($_GET['kind'] ?? '')));
        if ($method === 'GET' && $route === 'admin/projects') app_json(app_projects(false));
        if ($method === 'GET' && $route === 'admin/skills') app_json(app_skills());
        if ($method === 'GET' && $route === 'admin/feature-cards') app_json(app_feature_cards(false));
        foreach(['projects','skills','feature-cards'] as $resource){$dbResource=$resource==='feature-cards'?'feature_cards':$resource;if($method==='POST'&&$route==='admin/'.$resource)app_generic_save($dbResource,null);if(preg_match('#^admin/'.preg_quote($resource,'#').'/(\d+)$#',$route,$match)){if($method==='PUT')app_generic_save($dbResource,(int)$match[1]);if($method==='DELETE')app_generic_delete($dbResource,(int)$match[1]);}}
        if ($method === 'GET' && $route === 'admin/profile') app_json(app_profile(false));
        if ($method === 'PUT' && $route === 'admin/profile') { $b=app_body();$s=app_db()->prepare('UPDATE site_profile SET nickname=?,avatar=?,bio=?,bio_en=?,location=?,website=?,github=?,twitter=?,linkedin=?,email_public=?,tags=?,tags_en=?,welcome_text=?,welcome_text_en=?,cta_title=?,cta_title_en=?,cta_description=?,cta_description_en=?,coffee_count=?,stars_count=?,updated_at=NOW() WHERE id=1');$s->execute([trim((string)($b['nickname']??'')),trim((string)($b['avatar']??'')),(string)($b['bio']??''),(string)($b['bioEn']??''),trim((string)($b['location']??'')),trim((string)($b['website']??'')),trim((string)($b['github']??'')),trim((string)($b['twitter']??'')),trim((string)($b['linkedin']??'')),trim((string)($b['emailPublic']??'')),trim((string)($b['tags']??'')),trim((string)($b['tagsEn']??'')),trim((string)($b['welcomeText']??'')),trim((string)($b['welcomeTextEn']??'')),trim((string)($b['ctaTitle']??'')),trim((string)($b['ctaTitleEn']??'')),trim((string)($b['ctaDescription']??'')),trim((string)($b['ctaDescriptionEn']??'')),app_int($b['coffeeCount']??0),app_int($b['starsCount']??0)]);app_public_cache_clear();app_json(app_profile(false)); }
        if ($method === 'POST' && $route === 'admin/profile/avatar') {
            $image=app_upload_image('avatar');
            $previousAvatar=(string)(app_db()->query('SELECT avatar FROM site_profile WHERE id=1')->fetchColumn() ?: '');
            try {
                app_db()->prepare('UPDATE site_profile SET avatar=?,updated_at=NOW() WHERE id=1')->execute([$image['url']]);
            } catch (Throwable $error) {
                $path = app_upload_path_from_url((string) $image['url']);
                if ($path !== null) app_delete_responsive_image_family($path);
                throw $error;
            }
            $previousPath=app_upload_path_from_url($previousAvatar);
            if($previousPath!==null && $previousAvatar!==$image['url']) app_delete_responsive_image_family($previousPath);
            app_public_cache_clear();
            app_json(['avatar'=>$image['url']]);
        }
        if ($method === 'PUT' && $route === 'admin/account/password') {
            $b=app_body(); $current=(string)($b['currentPassword']??''); $new=(string)($b['newPassword']??'');
            if(strlen($new)<10 || strlen($new)>128) app_error(400, 'New password must contain 10 to 128 characters.');
            $database=app_db(); $database->beginTransaction();
            try {
                $s=$database->prepare('SELECT * FROM admin_account WHERE id=? FOR UPDATE');$s->execute([$_SESSION['admin_id']]);$admin=$s->fetch();
                if(!$admin || strlen($current)>1024 || !password_verify($current,$admin['password_hash'])) { $database->rollBack(); app_error(400, 'Current password is incorrect.'); }
                $database->prepare('UPDATE admin_account SET password_hash=?,session_version=session_version+1,updated_at=NOW() WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$admin['id']]);
                $database->commit();
            } catch (Throwable $error) { if($database->inTransaction())$database->rollBack(); throw $error; }
            app_json(['message'=>'瀵嗙爜淇敼鎴愬姛锛岃閲嶆柊鐧诲綍']);
        }
        if ($method === 'GET' && $route === 'admin/security-settings') app_json(app_admin_security_settings());
        if ($method === 'PUT' && $route === 'admin/security-settings') app_json(app_update_admin_security_settings());
        if ($method === 'GET' && $route === 'admin/upload-settings') app_json(app_upload_settings());
        if ($method === 'PUT' && $route === 'admin/upload-settings') { $b=app_body();$s=app_db()->prepare('UPDATE upload_settings SET article_image_max_mb=?,theme_background_max_mb=?,avatar_image_max_mb=?,image_max_dimension=?,image_max_pixels=?,avatar_max_dimension=?,avatar_max_pixels=?,avatar_min_dimension=?,article_site_zip_max_mb=?,article_site_total_mb=?,article_site_file_count=? WHERE id=1');$s->execute([app_clamp(app_int($b['articleImageMaxMB']??5),1,10),app_clamp(app_int($b['themeBackgroundMaxMB']??5),1,10),app_clamp(app_int($b['avatarImageMaxMB']??2),1,5),app_clamp(app_int($b['imageMaxDimension']??8192),512,12000),app_clamp(app_int($b['imageMaxPixels']??40000000),1000000,80000000),app_clamp(app_int($b['avatarMaxDimension']??4096),128,8000),app_clamp(app_int($b['avatarMaxPixels']??16000000),500000,40000000),app_clamp(app_int($b['avatarMinDimension']??64),32,1024),app_clamp(app_int($b['articleSiteZipMaxMB']??12),1,20),app_clamp(app_int($b['articleSiteTotalMB']??40),5,100),app_clamp(app_int($b['articleSiteFileCount']??400),10,1000)]);app_json(app_upload_settings()); }
        if ($method === 'GET' && $route === 'admin/live2d') app_json(app_live2d_admin_state());
        if ($method === 'POST' && $route === 'admin/live2d/import') app_json(app_live2d_import_bundle(), 201);
        if ($method === 'PUT' && $route === 'admin/live2d/settings') app_json(app_live2d_update_settings());
        if ($method === 'PUT' && preg_match('#^admin/live2d/models/(\d+)$#', $route, $match)) app_json(app_live2d_update_model((int) $match[1]));
        if ($method === 'PUT' && preg_match('#^admin/live2d/models/(\d+)/activate$#', $route, $match)) app_json(app_live2d_activate_model((int) $match[1]));
        if ($method === 'DELETE' && preg_match('#^admin/live2d/models/(\d+)$#', $route, $match)) app_json(app_live2d_delete_model((int) $match[1]));
        if ($method === 'POST' && $route === 'admin/theme') { $b=app_body();if(isset($b['custom'])&&is_array($b['custom'])){$c=$b['custom'];$s=app_db()->prepare("UPDATE themes SET preset_key='custom',primary_color=?,secondary_color=?,accent_color=?,background=?,background_style=?,background_image=?,background_size=?,background_position=?,background_repeat=?,card_bg=?,text_primary=?,text_secondary=? WHERE id=1");$s->execute([(string)($c['primary']??'#6366f1'),(string)($c['secondary']??'#a855f7'),(string)($c['accent']??'#ec4899'),(string)($c['background']??''),(string)($c['backgroundStyle']??'gradient'),(string)($c['backgroundImage']??''),(string)($c['backgroundSize']??'cover'),(string)($c['backgroundPosition']??'center'),(string)($c['backgroundRepeat']??'no-repeat'),(string)($c['cardBg']??''),(string)($c['textPrimary']??''),(string)($c['textSecondary']??'')]);}else{$preset=app_theme_preset((string)preg_replace('/[^a-z0-9_-]/i','',(string)($b['preset']??'purple-pink')));app_db()->prepare('UPDATE themes SET preset_key=? WHERE id=1')->execute([$preset]);}app_public_cache_clear();app_json(app_theme()); }
        if ($method === 'GET' && $route === 'admin/theme/background-images') app_json(app_list_images('theme'));
        if ($method === 'POST' && $route === 'admin/theme/background-image') app_json(app_upload_image('theme'),201);
        if ($method === 'DELETE' && preg_match('#^admin/theme/background-image/([^/]+)$#',$route,$match)) app_json(app_delete_theme_background(rawurldecode($match[1])));
        app_error(404, 'API endpoint not found.', 'NOT_FOUND');
    } catch (PDOException $error) {
        error_log($error->__toString());
        app_error(500, '鏁版嵁搴撴搷浣滃け璐ワ紝璇锋鏌ラ厤缃拰鏁版嵁搴撹〃', 'DATABASE_ERROR');
    } catch (Throwable $error) {
        error_log($error->__toString());
        app_error(500, 'Internal server error.', 'INTERNAL_ERROR');
    }
}
