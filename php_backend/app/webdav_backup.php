<?php

declare(strict_types=1);

const APP_WEBDAV_MIN_SCHEDULE_MINUTES = 5;
const APP_WEBDAV_MAX_SCHEDULE_MINUTES = 10080;
const APP_WEBDAV_MAX_RETENTION = 100;

final class AppWebDavException extends RuntimeException
{
    public function __construct(
        public readonly string $phase,
        string $message,
        public readonly int $httpStatus = 0,
        public readonly string $hint = '',
    ) {
        parent::__construct($message);
    }
}

function app_webdav_error_details(Throwable $error, string $operation): array
{
    if ($error instanceof AppWebDavException) {
        return ['operation' => $operation, 'phase' => $error->phase, 'httpStatus' => $error->httpStatus, 'reason' => $error->getMessage(), 'hint' => $error->hint];
    }
    return ['operation' => $operation, 'phase' => 'server', 'httpStatus' => 0, 'reason' => $error->getMessage(), 'hint' => '请查看 PHP error_log；如果没有更具体信息，请确认 PHP cURL、OpenSSL 和 HTTPS 出站访问已启用。'];
}

function app_webdav_fail(Throwable $error, string $operation): void
{
    $details = app_webdav_error_details($error, $operation);
    error_log('WebDAV ' . $operation . ' failed: ' . json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    app_error(502, 'WebDAV ' . $operation . '失败：' . $details['reason'], 'WEBDAV_' . strtoupper($operation) . '_FAILED', $details);
}

function app_schema_020_ready(): bool
{
    try {
        return (int) app_db()->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'webdav_backup_settings'")->fetchColumn() === 1;
    } catch (Throwable $error) { return false; }
}

function app_schema_021_ready(): bool
{
    try {
        return (int) app_db()->query("SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'webdav_backup_settings' AND COLUMN_NAME IN ('progress_percent','progress_stage','progress_bytes','progress_total')")->fetchColumn() === 4;
    } catch (Throwable $error) { return false; }
}

function app_require_schema_021(): void
{
    if (!app_schema_021_ready()) app_error(503, 'Please import migrations/021_webdav_progress.sql first.', 'MIGRATION_REQUIRED');
}

function app_require_schema_020(): void
{
    if (!app_schema_020_ready()) app_error(503, 'Please import migrations/020_webdav_backup.sql first.', 'MIGRATION_REQUIRED');
}

function app_webdav_crypto_key(): string
{
    return hash('sha256', 'webdav-password-v2|' . (string) (app_config()['app']['setup_key'] ?? ''), true);
}

function app_webdav_encrypt(string $value): string
{
    if ($value === '') return '';
    if (!function_exists('openssl_encrypt')) throw new RuntimeException('OpenSSL is required for WebDAV secrets.');
    $iv = random_bytes(12); $tag = '';
    $cipher = openssl_encrypt($value, 'aes-256-gcm', app_webdav_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag, 'webdav-password-v2', 16);
    if (!is_string($cipher) || $cipher === '' || $tag === '') throw new RuntimeException('Unable to encrypt WebDAV secret.');
    return 'v2.' . base64_encode($iv) . '.' . base64_encode($tag) . '.' . base64_encode($cipher);
}

function app_webdav_decrypt(string $value): string
{
    if ($value === '' || !function_exists('openssl_decrypt')) return '';
    $parts = explode('.', $value);
    if (count($parts) !== 4 || $parts[0] !== 'v2') return '';
    $iv = base64_decode($parts[1], true); $tag = base64_decode($parts[2], true); $cipher = base64_decode($parts[3], true);
    if ($iv === false || $tag === false || $cipher === false) return '';
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', app_webdav_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag, 'webdav-password-v2');
    return is_string($plain) ? $plain : '';
}

function app_webdav_settings_ensure(): array
{
    app_require_schema_021();
    $row = app_db()->query('SELECT * FROM webdav_backup_settings WHERE id=1')->fetch();
    if (!$row) { app_db()->exec('INSERT INTO webdav_backup_settings (id, updated_at) VALUES (1,NOW())'); $row = app_db()->query('SELECT * FROM webdav_backup_settings WHERE id=1')->fetch(); }
    return is_array($row) ? $row : [];
}

function app_webdav_validate_endpoint(string $value): string
{
    $value = rtrim(trim($value), '/'); $parts = parse_url($value);
    if ($value === '' || !is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || empty($parts['host']) || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment'])) app_error(400, 'WebDAV 地址必须是 HTTPS 地址，不能带账号密码或查询参数。', 'WEBDAV_ENDPOINT_INVALID');
    if (filter_var($parts['host'], FILTER_VALIDATE_IP) !== false && !filter_var($parts['host'], FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) app_error(400, 'WebDAV 地址不能指向内网 IP。', 'WEBDAV_ENDPOINT_PRIVATE');
    return $value;
}

function app_webdav_validate_path(string $value): string
{
    $value = trim(str_replace('\\', '/', $value), '/');
    if ($value === '') app_error(400, 'WebDAV 目录不能为空。', 'WEBDAV_PATH_REQUIRED');
    foreach (explode('/', $value) as $part) if ($part === '' || $part === '.' || $part === '..' || strlen($part) > 100 || preg_match('/[^A-Za-z0-9._-]/', $part)) app_error(400, 'WebDAV 目录包含非法字符。', 'WEBDAV_PATH_INVALID');
    return $value;
}

function app_webdav_settings_public(array $row, string $cronToken = ''): array
{
    return ['enabled' => !empty($row['enabled']), 'endpointUrl' => (string) ($row['endpoint_url'] ?? ''), 'remotePath' => (string) ($row['remote_path'] ?? 'personal-website'), 'username' => (string) ($row['username'] ?? ''), 'webdavPasswordConfigured' => app_webdav_decrypt((string) ($row['password_encrypted'] ?? '')) !== '', 'backupPasswordConfigured' => app_webdav_decrypt((string) ($row['backup_password_encrypted'] ?? '')) !== '', 'scheduleMinutes' => max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) ($row['schedule_minutes'] ?? 1440)), 'retentionCount' => min(APP_WEBDAV_MAX_RETENTION, max(1, (int) ($row['retention_count'] ?? 7))), 'cronToken' => $cronToken, 'lastRunAt' => app_now_iso($row['last_run_at'] ?? null), 'nextRunAt' => app_now_iso($row['next_run_at'] ?? null), 'lastStatus' => (string) ($row['last_status'] ?? 'never'), 'lastError' => (string) ($row['last_error'] ?? ''), 'lastRemoteName' => (string) ($row['last_remote_name'] ?? ''), 'progressPercent' => (int) ($row['progress_percent'] ?? 0), 'progressStage' => (string) ($row['progress_stage'] ?? ''), 'progressBytes' => (int) ($row['progress_bytes'] ?? 0), 'progressTotal' => (int) ($row['progress_total'] ?? 0)];
}

function app_webdav_set_progress(int $percent, string $stage, int $bytes = 0, int $total = 0): void
{
    app_db()->prepare('UPDATE webdav_backup_settings SET progress_percent=?, progress_stage=?, progress_bytes=?, progress_total=?, updated_at=NOW() WHERE id=1')->execute([max(0, min(100, $percent)), substr($stage, 0, 64), max(0, $bytes), max(0, $total)]);
}

function app_webdav_save_settings(): array
{
    $body = app_body(); $current = app_webdav_settings_ensure(); $enabled = app_bool($body['enabled'] ?? false);
    $endpointInput = trim((string) ($body['endpointUrl'] ?? $current['endpoint_url'] ?? '')); $endpoint = $endpointInput === '' && !$enabled ? '' : app_webdav_validate_endpoint($endpointInput);
    $remotePath = app_webdav_validate_path((string) ($body['remotePath'] ?? $current['remote_path'] ?? 'personal-website'));
    $username = trim((string) ($body['username'] ?? $current['username'] ?? '')); $davPassword = (string) ($body['webdavPassword'] ?? ''); $backupPassword = (string) ($body['backupPassword'] ?? '');
    if ($enabled && ($username === '' || strlen($username) > 255)) app_error(400, 'WebDAV 用户名不能为空。', 'WEBDAV_USERNAME_INVALID');
    if ($davPassword !== '' && strlen($davPassword) > 2048) app_error(400, 'WebDAV 密码过长。', 'WEBDAV_PASSWORD_INVALID');
    if ($backupPassword !== '' && (strlen($backupPassword) < 12 || strlen($backupPassword) > 256)) app_error(400, '备份密码必须为 12 至 256 个字符。', 'BACKUP_PASSWORD_INVALID');
    $davEncrypted = $davPassword !== '' ? app_webdav_encrypt($davPassword) : (string) ($current['password_encrypted'] ?? '');
    $backupEncrypted = $backupPassword !== '' ? app_webdav_encrypt($backupPassword) : (string) ($current['backup_password_encrypted'] ?? '');
    if ($enabled && (app_webdav_decrypt($davEncrypted) === '' || app_webdav_decrypt($backupEncrypted) === '')) app_error(400, '启用自动备份前必须配置 WebDAV 密码和备份密码。', 'WEBDAV_PASSWORD_REQUIRED');
    $schedule = app_clamp(app_int($body['scheduleMinutes'] ?? ($current['schedule_minutes'] ?? 1440)), APP_WEBDAV_MIN_SCHEDULE_MINUTES, APP_WEBDAV_MAX_SCHEDULE_MINUTES); $retention = app_clamp(app_int($body['retentionCount'] ?? ($current['retention_count'] ?? 7)), 1, APP_WEBDAV_MAX_RETENTION);
    $cronToken = app_webdav_decrypt((string) ($current['cron_token_encrypted'] ?? '')); if ($cronToken === '' || !empty($body['regenerateCronToken'])) $cronToken = bin2hex(random_bytes(24));
    $nextRun = $enabled ? date('Y-m-d H:i:s', time() + $schedule * 60) : null;
    app_db()->prepare('UPDATE webdav_backup_settings SET enabled=?, endpoint_url=?, remote_path=?, username=?, password_encrypted=?, backup_password_encrypted=?, cron_token_encrypted=?, schedule_minutes=?, retention_count=?, next_run_at=?, last_error="", updated_at=NOW(), updated_by=? WHERE id=1')->execute([$enabled ? 1 : 0, $endpoint, $remotePath, $username, $davEncrypted, $backupEncrypted, app_webdav_encrypt($cronToken), $schedule, $retention, $nextRun, (int) ($_SESSION['admin_id'] ?? 0)]);
    return app_webdav_settings_public(app_webdav_settings_ensure(), $cronToken);
}

function app_webdav_base_url(array $settings): string
{
    return rtrim((string) $settings['endpoint_url'], '/') . '/' . implode('/', array_map('rawurlencode', explode('/', (string) $settings['remote_path'])));
}

function app_webdav_collection_url(array $settings): string
{
    return rtrim(app_webdav_base_url($settings), '/') . '/';
}

function app_webdav_ensure_collection(array $settings): void
{
    $probe = app_webdav_request($settings, 'PROPFIND', app_webdav_collection_url($settings), ['Depth: 0', 'Content-Type: application/xml'], null, null, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>', 'directory_probe');
    if (in_array($probe['status'], [200, 207], true)) return;
    if ($probe['status'] !== 404) throw new AppWebDavException('directory_probe', '远程目录检测返回 HTTP ' . $probe['status'], $probe['status'], '检查远程目录路径、账号权限以及 WebDAV 服务是否支持 PROPFIND。');
    $response = app_webdav_request($settings, 'MKCOL', app_webdav_collection_url($settings), [], null, null, null, 'directory_create');
    if (in_array($response['status'], [200, 201, 204, 405], true)) return;
    if ($response['status'] === 409) throw new AppWebDavException('directory_create', '远程目录的上级目录不存在。', 409, '先在 WebDAV 服务端手动创建上级目录，再把后台远程目录填写为已存在的目录。');
    throw new AppWebDavException('directory_create', 'WebDAV 创建远程目录失败，HTTP ' . $response['status'], $response['status'], '确认账号拥有创建目录权限；部分服务禁止 MKCOL，请先手动创建目录。');
}

function app_webdav_request(array $settings, string $method, string $url, array $headers = [], ?string $uploadPath = null, ?string $downloadPath = null, ?string $body = null, string $phase = 'request', ?callable $progressCallback = null): array
{
    if (!function_exists('curl_init')) throw new AppWebDavException('environment', 'PHP 未启用 cURL 扩展。', 0, '在虚拟主机 PHP 扩展中启用 cURL，然后重载 PHP-FPM。');
    $username = (string) ($settings['username'] ?? ''); $password = app_webdav_decrypt((string) ($settings['password_encrypted'] ?? '')); if ($username === '' || $password === '') throw new RuntimeException('WebDAV credentials are not configured.');
    $curl = curl_init($url); if ($curl === false) throw new AppWebDavException($phase, '无法初始化 cURL。', 0, '检查 PHP cURL 扩展和主机 PHP 配置。'); $upload = null; $download = null;
    $options = [CURLOPT_RETURNTRANSFER => $downloadPath === null, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60, CURLOPT_USERPWD => $username . ':' . $password, CURLOPT_HTTPAUTH => CURLAUTH_ANY, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => array_merge(['User-Agent: PersonalWebsiteWebDAV/1.0'], $headers), CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];
    if ($body !== null) $options[CURLOPT_POSTFIELDS] = $body;
    if ($uploadPath !== null) { $upload = @fopen($uploadPath, 'rb'); if (!$upload) throw new AppWebDavException($phase, '无法读取本地备份文件。', 0, '检查临时目录权限和服务器剩余磁盘空间。'); $options[CURLOPT_UPLOAD] = true; $options[CURLOPT_INFILE] = $upload; $options[CURLOPT_INFILESIZE] = filesize($uploadPath); }
    if ($downloadPath !== null) { $download = @fopen($downloadPath, 'wb'); if (!$download) throw new AppWebDavException($phase, '无法创建远程备份临时文件。', 0, '检查 PHP 临时目录权限和服务器剩余磁盘空间。'); $options[CURLOPT_FILE] = $download; $options[CURLOPT_RETURNTRANSFER] = false; }
    if ($progressCallback !== null && defined('CURLOPT_XFERINFOFUNCTION')) { $options[CURLOPT_NOPROGRESS] = false; $options[CURLOPT_XFERINFOFUNCTION] = static function ($resource, float $downloadSize, float $downloaded, float $uploadSize, float $uploaded) use ($progressCallback): int { $progressCallback((int) $uploaded, (int) $uploadSize); return 0; }; }
    curl_setopt_array($curl, $options); $raw = curl_exec($curl); $error = curl_error($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl); if (is_resource($upload)) fclose($upload); if (is_resource($download)) fclose($download); if ($raw === false) throw new AppWebDavException($phase, 'WebDAV 网络请求失败：' . ($error ?: 'unknown error'), $status, '检查域名解析、HTTPS 证书、服务器出站网络和 WebDAV 地址。');
    return ['status' => $status, 'body' => (string) $raw];
}

function app_webdav_test(): array
{
    $settings = app_webdav_settings_ensure(); if (app_webdav_decrypt((string) ($settings['password_encrypted'] ?? '')) === '') app_error(400, '请先保存 WebDAV 密码。', 'WEBDAV_PASSWORD_REQUIRED'); app_webdav_ensure_collection($settings);
    $response = app_webdav_request($settings, 'PROPFIND', app_webdav_collection_url($settings), ['Depth: 0', 'Content-Type: application/xml'], null, null, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>', 'directory_verify');
    if ($response['status'] === 404) throw new AppWebDavException('directory_verify', '远程目录不存在或账号无权访问。', 404, '检查 WebDAV 目录路径和账号权限。'); if (!in_array($response['status'], [200, 207], true)) throw new AppWebDavException('directory_verify', 'WebDAV 返回 HTTP ' . $response['status'], $response['status'], '检查服务端是否支持 PROPFIND，并确认地址指向 WebDAV 目录。'); return ['success' => true, 'message' => 'WebDAV 连接成功。', 'diagnostics' => ['phase' => 'directory_verify', 'httpStatus' => $response['status'], 'reason' => '目录可访问且 WebDAV 响应正常。', 'hint' => '可以继续执行上传测试或立即备份。']];
}

function app_webdav_list_remote(): array
{
    $settings = app_webdav_settings_ensure(); $response = app_webdav_request($settings, 'PROPFIND', app_webdav_collection_url($settings), ['Depth: 1', 'Content-Type: application/xml'], null, null, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>', 'list'); if (!in_array($response['status'], [200, 207], true)) throw new AppWebDavException('list', '读取远程备份列表返回 HTTP ' . $response['status'], $response['status'], '检查远程目录读取权限和 WebDAV PROPFIND 支持。');
    preg_match_all('/<(?:[A-Za-z0-9_-]+:)?href[^>]*>(.*?)<\/(?:[A-Za-z0-9_-]+:)?href>/si', $response['body'], $matches); $items = [];
    foreach ($matches[1] ?? [] as $href) { $path = parse_url(html_entity_decode((string) $href, ENT_QUOTES, 'UTF-8'), PHP_URL_PATH); $name = rawurldecode(basename((string) $path)); if (preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) $items[] = ['name' => $name]; }
    usort($items, static fn(array $a, array $b): int => strcmp($b['name'], $a['name'])); return array_slice($items, 0, 200);
}

function app_webdav_upload(array $settings, string $path): string
{
    $site = substr(hash('sha256', strtolower((string) (app_config()['app']['site_url'] ?? ($_SERVER['HTTP_HOST'] ?? 'personal-website')))), 0, 12); $name = 'personal-website-' . $site . '-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.zip';
    $total = (int) filesize($path);
    $response = app_webdav_request($settings, 'PUT', app_webdav_base_url($settings) . '/' . rawurlencode($name), ['Content-Type: application/zip'], $path, null, null, 'upload', static function (int $uploaded, int $remoteTotal) use ($total): void { $size = $remoteTotal > 0 ? $remoteTotal : $total; $percent = $size > 0 ? 35 + (int) floor(($uploaded / $size) * 60) : 35; app_webdav_set_progress($percent, '正在上传到 WebDAV', $uploaded, $size); });
    if (!in_array($response['status'], [200, 201, 204], true)) throw new AppWebDavException('upload', 'WebDAV 上传失败，HTTP ' . $response['status'], $response['status'], '检查远程目录写入权限、配额、单文件大小限制和 WebDAV PUT 支持。'); return $name;
}

function app_webdav_delete_remote(array $settings, string $name): void
{
    if (!preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) throw new RuntimeException('Invalid remote backup name.');
    $response = app_webdav_request($settings, 'DELETE', app_webdav_base_url($settings) . '/' . rawurlencode($name), [], null, null, null, 'retention_delete');
    if (!in_array($response['status'], [200, 202, 204, 404], true)) throw new AppWebDavException('retention_delete', 'WebDAV 删除旧备份失败，HTTP ' . $response['status'], $response['status'], '检查远程目录删除权限；当前备份可能已经上传成功。');
}

function app_webdav_prune_remote(array $settings, int $retention): void
{
    $site = substr(hash('sha256', strtolower((string) (app_config()['app']['site_url'] ?? ($_SERVER['HTTP_HOST'] ?? 'personal-website')))), 0, 12);
    $items = array_values(array_filter(app_webdav_list_remote(), static fn(array $item): bool => str_starts_with($item['name'], 'personal-website-' . $site . '-')));
    foreach (array_slice($items, max(0, $retention)) as $item) app_webdav_delete_remote($settings, $item['name']);
}

function app_webdav_run_backup(bool $force = false): array
{
    $settings = app_webdav_settings_ensure(); if (!$force && empty($settings['enabled'])) return ['success' => false, 'skipped' => true]; if ((string) ($settings['last_status'] ?? '') === 'running') throw new AppWebDavException('schedule', '已有一个 WebDAV 备份正在执行。', 409, '等待当前任务完成后再重试。'); $password = app_webdav_decrypt((string) ($settings['backup_password_encrypted'] ?? '')); if ($password === '') throw new RuntimeException('请先配置 WebDAV 备份密码。'); $path = rtrim(sys_get_temp_dir(), '/\\') . '/webdav-backup-' . bin2hex(random_bytes(8)) . '.zip';
    app_db()->exec('UPDATE webdav_backup_settings SET last_status="running", last_error="", progress_percent=0, progress_stage="准备备份", progress_bytes=0, progress_total=0, updated_at=NOW() WHERE id=1');
    try { app_webdav_ensure_collection($settings); app_webdav_set_progress(10, '正在生成数据库和文件归档'); $stats = app_backup_create_archive($path, $password); app_webdav_set_progress(35, '准备上传到 WebDAV', 0, (int) filesize($path)); $name = app_webdav_upload($settings, $path); app_webdav_set_progress(96, '正在校验远程保存结果', (int) filesize($path), (int) filesize($path)); app_webdav_prune_remote($settings, (int) $settings['retention_count']); $next = date('Y-m-d H:i:s', time() + max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) $settings['schedule_minutes']) * 60); app_db()->prepare('UPDATE webdav_backup_settings SET last_run_at=NOW(), next_run_at=?, last_status="success", last_error="", last_remote_name=?, progress_percent=100, progress_stage="保存成功", progress_bytes=progress_total, updated_at=NOW() WHERE id=1')->execute([$next, $name]); return ['success' => true, 'remoteName' => $name, 'database' => $stats]; }
    catch (Throwable $error) { $next = date('Y-m-d H:i:s', time() + max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) $settings['schedule_minutes']) * 60); app_db()->prepare('UPDATE webdav_backup_settings SET last_run_at=NOW(), next_run_at=?, last_status="error", last_error=?, progress_percent=100, progress_stage="保存失败", updated_at=NOW() WHERE id=1')->execute([$next, substr($error->getMessage(), 0, 1000)]); throw $error; }
    finally { @unlink($path); }
}

function app_webdav_maybe_run_due(): void
{
    try { $settings = app_webdav_settings_ensure(); if ((string) ($settings['last_status'] ?? '') === 'running') return; if (!empty($settings['enabled']) && !empty($settings['next_run_at']) && strtotime((string) $settings['next_run_at']) <= time()) app_webdav_run_backup(false); } catch (Throwable $error) { error_log('WebDAV scheduled backup failed: ' . $error->getMessage()); }
}

function app_webdav_cron(): void
{
    $settings = app_webdav_settings_ensure(); $token = (string) ($_GET['token'] ?? ($_SERVER['HTTP_X_WEBDAV_CRON_TOKEN'] ?? '')); $expected = app_webdav_decrypt((string) ($settings['cron_token_encrypted'] ?? '')); if ($token === '' || $expected === '' || !hash_equals($expected, $token)) app_error(403, 'WebDAV cron token invalid.', 'WEBDAV_CRON_TOKEN_INVALID'); app_webdav_maybe_run_due(); app_json(['success' => true, 'status' => app_webdav_settings_public(app_webdav_settings_ensure())['lastStatus']]);
}

function app_webdav_restore_remote(): void
{
    $body = app_body(); $name = (string) ($body['name'] ?? ''); $password = (string) ($body['password'] ?? ''); if (!preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) app_error(400, '远程备份文件名无效。', 'WEBDAV_BACKUP_NAME_INVALID'); if (strlen($password) < 12 || strlen($password) > 256) app_error(400, '备份密码必须为 12 至 256 个字符。', 'BACKUP_PASSWORD_INVALID');
    $settings = app_webdav_settings_ensure(); $path = rtrim(sys_get_temp_dir(), '/\\') . '/webdav-restore-' . bin2hex(random_bytes(8)) . '.zip'; register_shutdown_function(static function () use ($path): void { @unlink($path); }); $response = app_webdav_request($settings, 'GET', app_webdav_base_url($settings) . '/' . rawurlencode($name), [], null, $path, null, 'download'); if ($response['status'] !== 200 || !is_file($path) || filesize($path) <= 0) app_error(502, '无法从 WebDAV 读取备份。', 'WEBDAV_BACKUP_DOWNLOAD_FAILED', ['operation' => 'download', 'phase' => 'download', 'httpStatus' => $response['status'], 'reason' => '远程备份文件读取失败。', 'hint' => '检查远程文件是否存在、账号是否有读取权限。']); $_POST['password'] = $password; $_FILES['backup'] = ['error' => UPLOAD_ERR_OK, 'size' => filesize($path), 'tmp_name' => $path, 'name' => $name, 'type' => 'application/zip']; app_admin_backup_import();
}
