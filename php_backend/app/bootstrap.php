<?php

declare(strict_types=1);

require_once __DIR__ . '/live2d.php';
require_once __DIR__ . '/analytics.php';
require_once __DIR__ . '/article_sites.php';

function app_config(): array
{
    static $config;
    if ($config !== null) return $config;

    $path = dirname(__DIR__) . '/config/config.php';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => '缺少 config/config.php，请从 config.example.php 复制并填写数据库配置。', 'code' => 'CONFIG_MISSING'], JSON_UNESCAPED_UNICODE);
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

function app_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function app_error(int $status, string $message, string $code = 'REQUEST_FAILED'): void
{
    app_json(['message' => $message, 'code' => $code], $status);
}

function app_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) app_error(400, '请求 JSON 格式错误', 'INVALID_JSON');
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
    $reserved = ['api', 'assets', 'blog', 'projects', 'search', 'uploads'];
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
        app_error(400, '后台地址后缀必须为 8 到 64 位字母、数字、连字符或下划线，且不能使用公开页面名称', 'INVALID_ADMIN_PATH');
    }

    $statement = app_db()->prepare('SELECT password_hash FROM admin_account WHERE id = ?');
    $statement->execute([$_SESSION['admin_id']]);
    $admin = $statement->fetch();
    if (!$admin || !password_verify((string) ($body['currentPassword'] ?? ''), $admin['password_hash'])) {
        app_error(400, '当前管理员密码不正确', 'INVALID_CURRENT_PASSWORD');
    }

    app_site_settings_ensure();
    $statement = app_db()->prepare('UPDATE site_settings SET admin_path_suffix = ?, updated_at = NOW() WHERE id = 1');
    $statement->execute([$suffix]);
    return ['adminPathSuffix' => $suffix, 'loginPath' => '/' . $suffix . '/login'];
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
    if (empty($_SESSION['admin_id'])) app_error(401, '请先登录', 'UNAUTHENTICATED');
}

function app_csrf_required(): void
{
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        app_error(403, 'CSRF 校验失败，请刷新后台后重试', 'CSRF_FAILED');
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
    if (!$row) app_error(500, '个人资料尚未初始化', 'PROFILE_MISSING');
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
        'views' => (int) $row['views'], 'published' => (bool) $row['published'], 'isLocked' => (bool) $row['is_locked'],
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
    $sql = "SELECT * FROM articles WHERE $condition ORDER BY created_at DESC LIMIT $size OFFSET " . ($page * $size);
    $statement = app_db()->prepare($sql);
    $statement->execute($params);
    $rows = array_map(function ($row) use ($admin) { return app_article_row($row, $admin, $admin); }, $statement->fetchAll());
    return app_page($rows, $total, $size, $page);
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
        app_error(500, '主机缺少图片检测能力，请启用 PHP GD 扩展', 'IMAGE_INSPECTION_UNAVAILABLE');
    }

    $dimensions = @getimagesize($path);
    if (!$dimensions) app_error(400, '图片内容无效', 'INVALID_IMAGE');

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

function app_upload_image(string $kind): array
{
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) app_error(400, '请选择要上传的图片', 'FILE_REQUIRED');
    $settings = app_upload_settings();
    $limits = ['article' => $settings['articleImageMaxMB'], 'theme' => $settings['themeBackgroundMaxMB'], 'avatar' => $settings['avatarImageMaxMB']];
    $limit = ($limits[$kind] ?? 2) * 1024 * 1024;
    if ((int) $_FILES['file']['size'] > $limit) app_error(413, '图片超过上传大小限制', 'FILE_TOO_LARGE');

    [$mime, $dimensions] = app_inspect_image($_FILES['file']['tmp_name']);
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
    if (!isset($types[$mime])) app_error(400, '仅支持 JPG、PNG、GIF 和 WebP 图片', 'UNSUPPORTED_FILE');
    $maxDimension = $kind === 'avatar' ? $settings['avatarMaxDimension'] : $settings['imageMaxDimension'];
    $maxPixels = $kind === 'avatar' ? $settings['avatarMaxPixels'] : $settings['imageMaxPixels'];
    if ($dimensions[0] > $maxDimension || $dimensions[1] > $maxDimension || $dimensions[0] * $dimensions[1] > $maxPixels) app_error(400, '图片尺寸超过限制', 'IMAGE_TOO_LARGE');
    if ($kind === 'avatar' && min($dimensions[0], $dimensions[1]) < $settings['avatarMinDimension']) app_error(400, '头像尺寸太小', 'IMAGE_TOO_SMALL');

    $config = app_config()['app'];
    $folder = $kind === 'article' ? 'articles' : ($kind === 'theme' ? 'theme' : 'avatars');
    $relative = $folder . '/' . date('Y/m');
    $directory = rtrim($config['upload_dir'], '/\\') . '/' . $relative;
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) app_error(500, '无法创建上传目录', 'UPLOAD_DIR_FAILED');
    $name = date('YmdHis') . '-' . bin2hex(random_bytes(12)) . '.' . $types[$mime];
    $target = $directory . '/' . $name;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $target)) app_error(500, '保存图片失败', 'UPLOAD_FAILED');
    @chmod($target, 0644);
    return ['name' => $name, 'url' => rtrim($config['upload_url'], '/') . '/' . $relative . '/' . $name, 'size' => (int) $_FILES['file']['size']];
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
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen(rtrim($config['upload_dir'], '/\\')) + 1));
        $items[] = ['name' => $file->getFilename(), 'url' => rtrim($config['upload_url'], '/') . '/' . $relative, 'size' => $file->getSize(), 'updatedAt' => date(DATE_ATOM, $file->getMTime())];
    }
    usort($items, function ($a, $b) { return strcmp($b['updatedAt'], $a['updatedAt']); });
    return $items;
}

function app_handle_login(): void
{
    $body = app_body();
    $username = trim((string) ($body['username'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $statement = app_db()->prepare('SELECT * FROM admin_account WHERE username = ? LIMIT 1');
    $statement->execute([$username]);
    $admin = $statement->fetch();
    if ($admin && $admin['locked_until'] && strtotime($admin['locked_until']) > time()) app_error(429, '登录失败次数过多，请稍后再试', 'LOGIN_LOCKED');
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        if ($admin) {
            $attempts = (int) $admin['failed_login_attempts'] + 1;
            $locked = $attempts >= 5 ? date('Y-m-d H:i:s', time() + 600) : null;
            $update = app_db()->prepare('UPDATE admin_account SET failed_login_attempts = ?, locked_until = ?, updated_at = NOW() WHERE id = ?');
            $update->execute([$attempts >= 5 ? 0 : $attempts, $locked, $admin['id']]);
        }
        usleep(350000);
        app_error(401, '用户名或密码错误', 'INVALID_CREDENTIALS');
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    app_db()->prepare('UPDATE admin_account SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?')->execute([$admin['id']]);
    app_json(['success' => true, 'username' => $admin['username'], 'csrfToken' => $_SESSION['csrf_token']]);
}

function app_save_article(?int $id): void
{
    $body = app_body();
    $title = trim((string) ($body['title'] ?? ''));
    $content = (string) ($body['content'] ?? '');
    $contentType = strtolower(trim((string) ($body['contentType'] ?? 'markdown'))) === 'static' ? 'static' : 'markdown';
    $siteKey = $contentType === 'static' ? trim((string) ($body['staticSiteKey'] ?? '')) : '';
    $siteName = $contentType === 'static' ? basename(str_replace('\\', '/', trim((string) ($body['staticSiteName'] ?? '')))) : '';
    if ($title === '') app_error(400, '标题不能为空', 'VALIDATION_FAILED');
    if ($contentType === 'markdown' && trim($content) === '') app_error(400, 'Markdown 正文不能为空', 'VALIDATION_FAILED');
    if ($contentType === 'static' && !app_article_site_exists($siteKey)) app_error(400, '请先上传包含 index.html 的静态前端 ZIP', 'ARTICLE_SITE_REQUIRED');
    if ($contentType === 'static') $content = '';
    $locked = app_bool($body['isLocked'] ?? false);
    $password = (string) ($body['accessPassword'] ?? '');
    $hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null;
    $values = [
        $title, trim((string) ($body['summary'] ?? '')), $content, trim((string) ($body['coverImage'] ?? '')),
        trim((string) ($body['category'] ?? '')), trim((string) ($body['tags'] ?? '')), app_bool($body['published'] ?? false) ? 1 : 0,
        $contentType, $siteKey !== '' ? $siteKey : null, $siteName !== '' ? $siteName : null, $locked ? 1 : 0,
    ];
    $oldSiteKey = '';
    if ($id === null) {
        if ($locked && $hash === null) app_error(400, '加锁文章必须设置访问密码', 'PASSWORD_REQUIRED');
        $statement = app_db()->prepare('INSERT INTO articles (title, summary, content, cover_image, category, tags, published, content_type, static_site_key, static_site_name, is_locked, access_password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
        $statement->execute(array_merge($values, [$hash]));
        $id = (int) app_db()->lastInsertId();
        $status = 201;
    } else {
        $existing = app_db()->prepare('SELECT access_password_hash, static_site_key FROM articles WHERE id = ?');
        $existing->execute([$id]);
        $old = $existing->fetch();
        if (!$old) app_error(404, '文章不存在', 'NOT_FOUND');
        $oldSiteKey = (string) ($old['static_site_key'] ?? '');
        if (!$locked) $hash = null;
        elseif ($hash === null) $hash = $old['access_password_hash'];
        $statement = app_db()->prepare('UPDATE articles SET title=?, summary=?, content=?, cover_image=?, category=?, tags=?, published=?, content_type=?, static_site_key=?, static_site_name=?, is_locked=?, access_password_hash=?, updated_at=NOW() WHERE id=?');
        $statement->execute(array_merge($values, [$hash, $id]));
        $status = 200;
    }
    $statement = app_db()->prepare('SELECT * FROM articles WHERE id = ?');
    $statement->execute([$id]);
    if ($oldSiteKey !== '' && $oldSiteKey !== $siteKey) app_article_site_delete_if_unreferenced($oldSiteKey);
    app_json(app_article_row($statement->fetch(), true, true), $status);
}

function app_delete_article(int $id): void
{
    $statement = app_db()->prepare('SELECT static_site_key FROM articles WHERE id = ?');
    $statement->execute([$id]);
    $row = $statement->fetch();
    if (!$row) app_error(404, '文章不存在', 'NOT_FOUND');
    app_db()->prepare('DELETE FROM articles WHERE id = ?')->execute([$id]);
    app_article_site_delete_if_unreferenced((string) ($row['static_site_key'] ?? ''));
    app_json(['success' => true]);
}

function app_generic_save(string $resource, ?int $id): void
{
    $body = app_body();
    $now = date('Y-m-d H:i:s');
    if ($resource === 'projects') {
        if (trim((string) ($body['name'] ?? '')) === '') app_error(400, '项目名称不能为空');
        $columns = ['name','description','cover_image','tech_stack','github_url','demo_url','stars','featured','display_order'];
        $values = [trim($body['name']), trim((string)($body['description']??'')), trim((string)($body['coverImage']??'')), trim((string)($body['techStack']??'')), trim((string)($body['githubUrl']??'')), trim((string)($body['demoUrl']??'')), app_int($body['stars']??0), app_bool($body['featured']??false)?1:0, app_int($body['displayOrder']??0)];
        if ($id === null) { $sql='INSERT INTO projects ('.implode(',',$columns).',created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?, ?, ?)'; $values[]=$now; $values[]=$now; }
        else { $sql='UPDATE projects SET name=?,description=?,cover_image=?,tech_stack=?,github_url=?,demo_url=?,stars=?,featured=?,display_order=?,updated_at=? WHERE id=?'; $values[]=$now; $values[]=$id; }
    } elseif ($resource === 'skills') {
        if (trim((string) ($body['name'] ?? '')) === '') app_error(400, '技能名称不能为空');
        $values=[trim($body['name']),trim((string)($body['category']??'')),app_clamp(app_int($body['proficiency']??0),0,100),trim((string)($body['icon']??'')),app_int($body['displayOrder']??0)];
        if ($id===null) $sql='INSERT INTO skills (name,category,proficiency,icon,display_order) VALUES (?,?,?,?,?)';
        else { $sql='UPDATE skills SET name=?,category=?,proficiency=?,icon=?,display_order=? WHERE id=?'; $values[]=$id; }
    } else {
        if (trim((string) ($body['title'] ?? '')) === '') app_error(400, '卡片标题不能为空');
        $values=[trim($body['title']),trim((string)($body['titleEn']??'')),trim((string)($body['description']??'')),trim((string)($body['descriptionEn']??'')),trim((string)($body['icon']??'Code')),trim((string)($body['gradient']??'from-indigo-500 to-purple-500')),app_int($body['displayOrder']??0),app_bool($body['enabled']??true)?1:0];
        if ($id===null) $sql='INSERT INTO feature_cards (title,title_en,description,description_en,icon,gradient,display_order,enabled) VALUES (?,?,?,?,?,?,?,?)';
        else { $sql='UPDATE feature_cards SET title=?,title_en=?,description=?,description_en=?,icon=?,gradient=?,display_order=?,enabled=? WHERE id=?'; $values[]=$id; }
    }
    app_db()->prepare($sql)->execute($values);
    app_json(['success'=>true,'id'=>$id ?? (int) app_db()->lastInsertId()], $id===null?201:200);
}

function app_handle_request(): void
{
    header('X-Content-Type-Options: nosniff');
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
    $isAdminRoute = strpos($route, 'admin/') === 0;
    $isAdminAuthRoute = $route === 'auth/login' || $route === 'auth/logout';
    if ($isAdminRoute || $isAdminAuthRoute) app_admin_entry_required();
    $needsSession = strpos($route, 'admin/') === 0
        || strpos($route, 'auth/') === 0
        || preg_match('#^public/articles/\d+(?:/unlock)?$#', $route);
    if ($needsSession) app_start_session();

    try {
        if ($method === 'GET' && $route === 'health') {
            app_db()->query('SELECT 1');
            app_json(['status' => 'ok', 'database' => 'ok']);
        }
        if ($method === 'POST' && $route === 'auth/login') app_handle_login();
        if ($method === 'POST' && $route === 'auth/logout') {
            if (!empty($_SESSION['admin_id'])) app_csrf_required();
            $_SESSION = [];
            if (ini_get('session.use_cookies')) { $params=session_get_cookie_params(); setcookie(session_name(), '', time()-42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']); }
            session_destroy();
            app_json(['success' => true]);
        }

        if ($method === 'GET' && $route === 'public/profile') app_json(app_profile(true));
        if ($method === 'GET' && $route === 'public/stats') {
            $profile=app_profile(true); $projects=(int)app_db()->query('SELECT COUNT(*) FROM projects')->fetchColumn(); $articles=(int)app_db()->query('SELECT COUNT(*) FROM articles WHERE published=1')->fetchColumn(); $stars=(int)app_db()->query('SELECT COALESCE(SUM(stars),0) FROM projects')->fetchColumn();
            app_json(['coffeeCount'=>$profile['coffeeCount'],'projectCount'=>$projects,'articleCount'=>$articles,'starsCount'=>$profile['starsCount'] ?: $stars]);
        }
        if ($method === 'GET' && $route === 'public/home') {
            $articlePage=$_GET['page']??null; $articleSize=$_GET['size']??null; $_GET['page']=0; $_GET['size']=3; $articles=app_articles(false)['content']; if($articlePage===null)unset($_GET['page']);else $_GET['page']=$articlePage; if($articleSize===null)unset($_GET['size']);else $_GET['size']=$articleSize;
            $profile=app_profile(true); $projects=app_projects(true); $skills=app_skills(); $cards=app_feature_cards(true); $articleCount=(int)app_db()->query('SELECT COUNT(*) FROM articles WHERE published=1')->fetchColumn(); $projectCount=(int)app_db()->query('SELECT COUNT(*) FROM projects')->fetchColumn(); $stars=(int)app_db()->query('SELECT COALESCE(SUM(stars),0) FROM projects')->fetchColumn();
            app_json(['profile'=>$profile,'articles'=>$articles,'projects'=>$projects,'skills'=>$skills,'featureCards'=>$cards,'stats'=>['coffeeCount'=>$profile['coffeeCount'],'projectCount'=>$projectCount,'articleCount'=>$articleCount,'starsCount'=>$profile['starsCount'] ?: $stars]]);
        }
        if ($method === 'GET' && $route === 'public/articles') app_json(app_articles(false));
        if (in_array($method, ['GET', 'HEAD'], true)
            && preg_match('#^public/article-sites/(\d+)/([a-f0-9-]{32,64})/(\d+)/(\d+)/([a-f0-9]{64})(?:/(.*))?$#i', $route, $match)) {
            app_article_site_serve((int) $match[1], $match[2], (int) $match[3], (int) $match[4], strtolower($match[5]), (string) ($match[6] ?? ''));
        }
        if ($method === 'GET' && preg_match('#^public/articles/(\d+)$#', $route, $match)) {
            $statement=app_db()->prepare('SELECT * FROM articles WHERE id=? AND published=1'); $statement->execute([(int)$match[1]]); $row=$statement->fetch(); if(!$row)app_error(404,'文章不存在','NOT_FOUND');
            $unlocked=!empty($_SESSION['article_unlocks'][(int)$row['id']]); if($row['is_locked']&&!$unlocked){$article=app_article_row($row,false);$article['requiresPassword']=true;app_json($article);} app_db()->prepare('UPDATE articles SET views=views+1 WHERE id=?')->execute([$row['id']]); $row['views']++;
            $article=app_article_row($row,true);$article['requiresPassword']=false;app_json($article);
        }
        if ($method === 'POST' && preg_match('#^public/articles/(\d+)/unlock$#', $route, $match)) {
            $statement=app_db()->prepare('SELECT * FROM articles WHERE id=? AND published=1');$statement->execute([(int)$match[1]]);$row=$statement->fetch();if(!$row)app_error(404,'文章不存在');$body=app_body();if(!$row['access_password_hash']||!password_verify((string)($body['password']??''),$row['access_password_hash']))app_error(403,'文章访问密码错误','INVALID_ARTICLE_PASSWORD');$_SESSION['article_unlocks'][(int)$row['id']]=true;app_json(app_article_row($row,true));
        }
        if ($method === 'GET' && $route === 'public/categories') app_json(app_db()->query("SELECT DISTINCT category FROM articles WHERE published=1 AND category<>'' ORDER BY category")->fetchAll(PDO::FETCH_COLUMN));
        if ($method === 'GET' && $route === 'public/tags') { $tags=[];foreach(app_db()->query("SELECT tags FROM articles WHERE published=1 AND tags<>''")->fetchAll(PDO::FETCH_COLUMN) as $list){foreach(explode(',',$list) as $tag){$tag=trim($tag);if($tag!=='')$tags[$tag]=true;}}$result=array_keys($tags);sort($result,SORT_NATURAL|SORT_FLAG_CASE);app_json($result); }
        if ($method === 'GET' && $route === 'public/projects') app_json(app_projects(false));
        if ($method === 'GET' && $route === 'public/projects/featured') app_json(app_projects(true));
        if ($method === 'GET' && $route === 'public/skills') app_json(app_skills());
        if ($method === 'GET' && $route === 'public/feature-cards') app_json(app_feature_cards(true));
        if ($method === 'GET' && $route === 'public/theme') app_json(app_theme());
        if ($method === 'GET' && $route === 'public/theme/background-images') app_json(app_list_images('theme'));
        if ($method === 'GET' && $route === 'public/live2d-model') {
            header('Cache-Control: public, max-age=60, stale-while-revalidate=300');
            app_json(app_live2d());
        }
        if ($method === 'POST' && $route === 'public/analytics/visit') app_json(app_analytics_record_visit(), 201);
        if ($method === 'GET' && $route === 'public/search') {
            $q=trim((string)($_GET['q']??''));if($q==='')app_json([]);$like="%$q%";$results=[];$s=app_db()->prepare('SELECT id,title,summary FROM articles WHERE published=1 AND (title LIKE ? OR summary LIKE ?) ORDER BY created_at DESC LIMIT 20');$s->execute([$like,$like]);foreach($s->fetchAll() as $row)$results[]=['type'=>'article','id'=>(int)$row['id'],'title'=>$row['title'],'description'=>$row['summary'],'url'=>'/blog/'.$row['id']];$s=app_db()->prepare('SELECT id,name,description FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 20');$s->execute([$like,$like]);foreach($s->fetchAll() as $row)$results[]=['type'=>'project','id'=>(int)$row['id'],'title'=>$row['name'],'description'=>$row['description'],'url'=>'/projects'];$s=app_db()->prepare('SELECT id,name,category FROM skills WHERE name LIKE ? OR category LIKE ? LIMIT 20');$s->execute([$like,$like]);foreach($s->fetchAll() as $row)$results[]=['type'=>'skill','id'=>(int)$row['id'],'title'=>$row['name'],'description'=>$row['category'],'url'=>'/#skills'];app_json($results);
        }

        if (strpos($route, 'admin/') === 0) {
            app_admin_required();
            header('Cache-Control: no-store');
            if (!in_array($method, ['GET','HEAD','OPTIONS'], true)) app_csrf_required();
        }
        if ($method === 'GET' && $route === 'admin/session') app_json(['authenticated'=>true,'username'=>$_SESSION['admin_username'],'csrfToken'=>app_ensure_csrf()]);
        if ($method === 'GET' && $route === 'admin/dashboard-stats') app_json(array_merge(['articleCount'=>(int)app_db()->query('SELECT COUNT(*) FROM articles')->fetchColumn(),'publishedArticleCount'=>(int)app_db()->query('SELECT COUNT(*) FROM articles WHERE published=1')->fetchColumn(),'projectCount'=>(int)app_db()->query('SELECT COUNT(*) FROM projects')->fetchColumn(),'skillCount'=>(int)app_db()->query('SELECT COUNT(*) FROM skills')->fetchColumn(),'totalViews'=>(int)app_db()->query('SELECT COALESCE(SUM(views),0) FROM articles')->fetchColumn()], app_analytics_dashboard_summary()));
        if ($method === 'GET' && $route === 'admin/analytics') app_json(app_analytics_report());
        if ($method === 'GET' && $route === 'admin/articles') app_json(app_articles(true));
        if ($method === 'POST' && $route === 'admin/articles') app_save_article(null);
        if (preg_match('#^admin/articles/(\d+)$#',$route,$match)) { $id=(int)$match[1];if($method==='PUT')app_save_article($id);if($method==='DELETE')app_delete_article($id); }
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
        if ($method === 'POST' && $route === 'admin/upload-assets/cleanup') app_json(['removed'=>0]);
        if ($method === 'GET' && $route === 'admin/projects') app_json(app_projects(false));
        if ($method === 'GET' && $route === 'admin/skills') app_json(app_skills());
        if ($method === 'GET' && $route === 'admin/feature-cards') app_json(app_feature_cards(false));
        foreach(['projects','skills','feature-cards'] as $resource){$dbResource=$resource==='feature-cards'?'feature_cards':$resource;if($method==='POST'&&$route==='admin/'.$resource)app_generic_save($dbResource,null);if(preg_match('#^admin/'.preg_quote($resource,'#').'/(\d+)$#',$route,$match)){if($method==='PUT')app_generic_save($dbResource,(int)$match[1]);if($method==='DELETE'){app_db()->prepare("DELETE FROM $dbResource WHERE id=?")->execute([(int)$match[1]]);app_json(['success'=>true]);}}}
        if ($method === 'GET' && $route === 'admin/profile') app_json(app_profile(false));
        if ($method === 'PUT' && $route === 'admin/profile') { $b=app_body();$s=app_db()->prepare('UPDATE site_profile SET nickname=?,avatar=?,bio=?,bio_en=?,location=?,website=?,github=?,twitter=?,linkedin=?,email_public=?,tags=?,tags_en=?,welcome_text=?,welcome_text_en=?,cta_title=?,cta_title_en=?,cta_description=?,cta_description_en=?,coffee_count=?,stars_count=?,updated_at=NOW() WHERE id=1');$s->execute([trim((string)($b['nickname']??'')),trim((string)($b['avatar']??'')),(string)($b['bio']??''),(string)($b['bioEn']??''),trim((string)($b['location']??'')),trim((string)($b['website']??'')),trim((string)($b['github']??'')),trim((string)($b['twitter']??'')),trim((string)($b['linkedin']??'')),trim((string)($b['emailPublic']??'')),trim((string)($b['tags']??'')),trim((string)($b['tagsEn']??'')),trim((string)($b['welcomeText']??'')),trim((string)($b['welcomeTextEn']??'')),trim((string)($b['ctaTitle']??'')),trim((string)($b['ctaTitleEn']??'')),trim((string)($b['ctaDescription']??'')),trim((string)($b['ctaDescriptionEn']??'')),app_int($b['coffeeCount']??0),app_int($b['starsCount']??0)]);app_json(app_profile(false)); }
        if ($method === 'POST' && $route === 'admin/profile/avatar') { $image=app_upload_image('avatar');app_db()->prepare('UPDATE site_profile SET avatar=?,updated_at=NOW() WHERE id=1')->execute([$image['url']]);app_json(['avatar'=>$image['url']]); }
        if ($method === 'PUT' && $route === 'admin/account/password') { $b=app_body();$s=app_db()->prepare('SELECT * FROM admin_account WHERE id=?');$s->execute([$_SESSION['admin_id']]);$admin=$s->fetch();$new=(string)($b['newPassword']??'');if(!$admin||!password_verify((string)($b['currentPassword']??''),$admin['password_hash']))app_error(400,'当前密码不正确');if(strlen($new)<10)app_error(400,'新密码至少需要 10 位');app_db()->prepare('UPDATE admin_account SET password_hash=?,updated_at=NOW() WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$admin['id']]);app_json(['message'=>'密码修改成功']); }
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
        if ($method === 'POST' && $route === 'admin/theme') { $b=app_body();if(isset($b['custom'])&&is_array($b['custom'])){$c=$b['custom'];$s=app_db()->prepare("UPDATE themes SET preset_key='custom',primary_color=?,secondary_color=?,accent_color=?,background=?,background_style=?,background_image=?,background_size=?,background_position=?,background_repeat=?,card_bg=?,text_primary=?,text_secondary=? WHERE id=1");$s->execute([(string)($c['primary']??'#6366f1'),(string)($c['secondary']??'#a855f7'),(string)($c['accent']??'#ec4899'),(string)($c['background']??''),(string)($c['backgroundStyle']??'gradient'),(string)($c['backgroundImage']??''),(string)($c['backgroundSize']??'cover'),(string)($c['backgroundPosition']??'center'),(string)($c['backgroundRepeat']??'no-repeat'),(string)($c['cardBg']??''),(string)($c['textPrimary']??''),(string)($c['textSecondary']??'')]);}else{$preset=app_theme_preset((string)preg_replace('/[^a-z0-9_-]/i','',(string)($b['preset']??'purple-pink')));app_db()->prepare('UPDATE themes SET preset_key=? WHERE id=1')->execute([$preset]);}app_json(app_theme()); }
        if ($method === 'GET' && $route === 'admin/theme/background-images') app_json(app_list_images('theme'));
        if ($method === 'POST' && $route === 'admin/theme/background-image') app_json(app_upload_image('theme'),201);
        if ($method === 'DELETE' && preg_match('#^admin/theme/background-image/([^/]+)$#',$route,$match)) { $name=basename(rawurldecode($match[1]));$root=rtrim(app_config()['app']['upload_dir'],'/\\').'/theme';$deleted=false;if(is_dir($root)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS)) as $file){if($file->isFile()&&hash_equals($file->getFilename(),$name)){$deleted=@unlink($file->getPathname());break;}}}app_json(['success'=>$deleted]); }
        app_error(404, '接口不存在', 'NOT_FOUND');
    } catch (PDOException $error) {
        error_log($error->__toString());
        app_error(500, '数据库操作失败，请检查配置和数据库表', 'DATABASE_ERROR');
    } catch (Throwable $error) {
        error_log($error->__toString());
        app_error(500, '服务器内部错误', 'INTERNAL_ERROR');
    }
}
