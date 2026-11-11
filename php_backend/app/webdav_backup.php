<?php

declare(strict_types=1);

const APP_WEBDAV_MIN_SCHEDULE_MINUTES = 5;
const APP_WEBDAV_MAX_SCHEDULE_MINUTES = 10080;
const APP_WEBDAV_MAX_RETENTION = 100;

function app_schema_020_ready(): bool
{
    try {
        return (int) app_db()->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'webdav_backup_settings'")->fetchColumn() === 1;
    } catch (Throwable $error) { return false; }
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
    app_require_schema_020();
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
    return ['enabled' => !empty($row['enabled']), 'endpointUrl' => (string) ($row['endpoint_url'] ?? ''), 'remotePath' => (string) ($row['remote_path'] ?? 'personal-website'), 'username' => (string) ($row['username'] ?? ''), 'webdavPasswordConfigured' => app_webdav_decrypt((string) ($row['password_encrypted'] ?? '')) !== '', 'backupPasswordConfigured' => app_webdav_decrypt((string) ($row['backup_password_encrypted'] ?? '')) !== '', 'scheduleMinutes' => max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) ($row['schedule_minutes'] ?? 1440)), 'retentionCount' => min(APP_WEBDAV_MAX_RETENTION, max(1, (int) ($row['retention_count'] ?? 7))), 'cronToken' => $cronToken, 'lastRunAt' => app_now_iso($row['last_run_at'] ?? null), 'nextRunAt' => app_now_iso($row['next_run_at'] ?? null), 'lastStatus' => (string) ($row['last_status'] ?? 'never'), 'lastError' => (string) ($row['last_error'] ?? ''), 'lastRemoteName' => (string) ($row['last_remote_name'] ?? '')];
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

function app_webdav_ensure_collection(array $settings): void
{
    $response = app_webdav_request($settings, 'MKCOL', app_webdav_base_url($settings));
    if (in_array($response['status'], [200, 201, 204, 405], true)) return;
    if ($response['status'] === 409) throw new RuntimeException('WebDAV 远程目录的上级目录不存在。');
    throw new RuntimeException('WebDAV 创建远程目录失败，HTTP ' . $response['status']);
}

function app_webdav_request(array $settings, string $method, string $url, array $headers = [], ?string $uploadPath = null, ?string $downloadPath = null, ?string $body = null): array
{
    if (!function_exists('curl_init')) throw new RuntimeException('WebDAV requires the PHP cURL extension.');
    $username = (string) ($settings['username'] ?? ''); $password = app_webdav_decrypt((string) ($settings['password_encrypted'] ?? '')); if ($username === '' || $password === '') throw new RuntimeException('WebDAV credentials are not configured.');
    $curl = curl_init($url); $upload = null; $download = null;
    $options = [CURLOPT_RETURNTRANSFER => $downloadPath === null, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60, CURLOPT_USERPWD => $username . ':' . $password, CURLOPT_HTTPAUTH => CURLAUTH_BASIC, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => array_merge(['User-Agent: PersonalWebsiteWebDAV/1.0'], $headers), CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];
    if ($body !== null) $options[CURLOPT_POSTFIELDS] = $body;
    if ($uploadPath !== null) { $upload = @fopen($uploadPath, 'rb'); if (!$upload) throw new RuntimeException('无法读取备份文件。'); $options[CURLOPT_UPLOAD] = true; $options[CURLOPT_INFILE] = $upload; $options[CURLOPT_INFILESIZE] = filesize($uploadPath); }
    if ($downloadPath !== null) { $download = @fopen($downloadPath, 'wb'); if (!$download) throw new RuntimeException('无法创建远程备份临时文件。'); $options[CURLOPT_FILE] = $download; $options[CURLOPT_RETURNTRANSFER] = false; }
    curl_setopt_array($curl, $options); $raw = curl_exec($curl); $error = curl_error($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); curl_close($curl); if (is_resource($upload)) fclose($upload); if (is_resource($download)) fclose($download); if ($raw === false) throw new RuntimeException('WebDAV 请求失败：' . ($error ?: 'unknown error'));
    return ['status' => $status, 'body' => (string) $raw];
}

function app_webdav_test(): array
{
    $settings = app_webdav_settings_ensure(); if (app_webdav_decrypt((string) ($settings['password_encrypted'] ?? '')) === '') app_error(400, '请先保存 WebDAV 密码。', 'WEBDAV_PASSWORD_REQUIRED'); app_webdav_ensure_collection($settings);
    $response = app_webdav_request($settings, 'PROPFIND', app_webdav_base_url($settings), ['Depth: 0', 'Content-Type: application/xml'], null, null, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>');
    if ($response['status'] === 404) throw new RuntimeException('远程目录不存在或账号无权访问。'); if (!in_array($response['status'], [200, 207, 301, 302], true)) throw new RuntimeException('WebDAV 返回 HTTP ' . $response['status']); return ['success' => true, 'message' => 'WebDAV 连接成功。'];
}

function app_webdav_list_remote(): array
{
    $settings = app_webdav_settings_ensure(); $response = app_webdav_request($settings, 'PROPFIND', app_webdav_base_url($settings), ['Depth: 1', 'Content-Type: application/xml'], null, null, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>'); if (!in_array($response['status'], [200, 207], true)) throw new RuntimeException('WebDAV 返回 HTTP ' . $response['status']);
    preg_match_all('/<(?:[A-Za-z0-9_-]+:)?href[^>]*>(.*?)<\/(?:[A-Za-z0-9_-]+:)?href>/si', $response['body'], $matches); $items = [];
    foreach ($matches[1] ?? [] as $href) { $path = parse_url(html_entity_decode((string) $href, ENT_QUOTES, 'UTF-8'), PHP_URL_PATH); $name = rawurldecode(basename((string) $path)); if (preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) $items[] = ['name' => $name]; }
    usort($items, static fn(array $a, array $b): int => strcmp($b['name'], $a['name'])); return array_slice($items, 0, 200);
}

function app_webdav_upload(array $settings, string $path): string
{
    $site = substr(hash('sha256', strtolower((string) (app_config()['app']['site_url'] ?? ($_SERVER['HTTP_HOST'] ?? 'personal-website')))), 0, 12); $name = 'personal-website-' . $site . '-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.zip';
    $response = app_webdav_request($settings, 'PUT', app_webdav_base_url($settings) . '/' . rawurlencode($name), ['Content-Type: application/zip'], $path); if (!in_array($response['status'], [200, 201, 204], true)) throw new RuntimeException('WebDAV 上传失败，HTTP ' . $response['status']); return $name;
}

function app_webdav_delete_remote(array $settings, string $name): void
{
    if (!preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) throw new RuntimeException('Invalid remote backup name.');
    $response = app_webdav_request($settings, 'DELETE', app_webdav_base_url($settings) . '/' . rawurlencode($name));
    if (!in_array($response['status'], [200, 202, 204, 404], true)) throw new RuntimeException('WebDAV 删除失败，HTTP ' . $response['status']);
}

function app_webdav_prune_remote(array $settings, int $retention): void
{
    $site = substr(hash('sha256', strtolower((string) (app_config()['app']['site_url'] ?? ($_SERVER['HTTP_HOST'] ?? 'personal-website')))), 0, 12);
    $items = array_values(array_filter(app_webdav_list_remote(), static fn(array $item): bool => str_starts_with($item['name'], 'personal-website-' . $site . '-')));
    foreach (array_slice($items, max(0, $retention)) as $item) app_webdav_delete_remote($settings, $item['name']);
}

function app_webdav_run_backup(bool $force = false): array
{
    $settings = app_webdav_settings_ensure(); if (!$force && empty($settings['enabled'])) return ['success' => false, 'skipped' => true]; $password = app_webdav_decrypt((string) ($settings['backup_password_encrypted'] ?? '')); if ($password === '') throw new RuntimeException('请先配置 WebDAV 备份密码。'); $path = rtrim(sys_get_temp_dir(), '/\\') . '/webdav-backup-' . bin2hex(random_bytes(8)) . '.zip';
    try { app_webdav_ensure_collection($settings); $stats = app_backup_create_archive($path, $password); $name = app_webdav_upload($settings, $path); app_webdav_prune_remote($settings, (int) $settings['retention_count']); $next = date('Y-m-d H:i:s', time() + max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) $settings['schedule_minutes']) * 60); app_db()->prepare('UPDATE webdav_backup_settings SET last_run_at=NOW(), next_run_at=?, last_status="success", last_error="", last_remote_name=?, updated_at=NOW() WHERE id=1')->execute([$next, $name]); return ['success' => true, 'remoteName' => $name, 'database' => $stats]; }
    catch (Throwable $error) { $next = date('Y-m-d H:i:s', time() + max(APP_WEBDAV_MIN_SCHEDULE_MINUTES, (int) $settings['schedule_minutes']) * 60); app_db()->prepare('UPDATE webdav_backup_settings SET last_run_at=NOW(), next_run_at=?, last_status="error", last_error=?, updated_at=NOW() WHERE id=1')->execute([$next, substr($error->getMessage(), 0, 1000)]); throw $error; }
    finally { @unlink($path); }
}

function app_webdav_maybe_run_due(): void
{
    try { $settings = app_webdav_settings_ensure(); if (!empty($settings['enabled']) && !empty($settings['next_run_at']) && strtotime((string) $settings['next_run_at']) <= time()) app_webdav_run_backup(false); } catch (Throwable $error) { error_log('WebDAV scheduled backup failed: ' . $error->getMessage()); }
}

function app_webdav_cron(): void
{
    $settings = app_webdav_settings_ensure(); $token = (string) ($_GET['token'] ?? ($_SERVER['HTTP_X_WEBDAV_CRON_TOKEN'] ?? '')); $expected = app_webdav_decrypt((string) ($settings['cron_token_encrypted'] ?? '')); if ($token === '' || $expected === '' || !hash_equals($expected, $token)) app_error(403, 'WebDAV cron token invalid.', 'WEBDAV_CRON_TOKEN_INVALID'); app_webdav_maybe_run_due(); app_json(['success' => true, 'status' => app_webdav_settings_public(app_webdav_settings_ensure())['lastStatus']]);
}

function app_webdav_restore_remote(): void
{
    $body = app_body(); $name = (string) ($body['name'] ?? ''); $password = (string) ($body['password'] ?? ''); if (!preg_match('/^personal-website-[A-Za-z0-9_-]+-\d{8}-\d{6}-[a-f0-9]{8}\.zip$/i', $name)) app_error(400, '远程备份文件名无效。', 'WEBDAV_BACKUP_NAME_INVALID'); if (strlen($password) < 12 || strlen($password) > 256) app_error(400, '备份密码必须为 12 至 256 个字符。', 'BACKUP_PASSWORD_INVALID');
    $settings = app_webdav_settings_ensure(); $path = rtrim(sys_get_temp_dir(), '/\\') . '/webdav-restore-' . bin2hex(random_bytes(8)) . '.zip'; register_shutdown_function(static function () use ($path): void { @unlink($path); }); $response = app_webdav_request($settings, 'GET', app_webdav_base_url($settings) . '/' . rawurlencode($name), [], null, $path); if ($response['status'] !== 200 || !is_file($path) || filesize($path) <= 0) app_error(400, '无法从 WebDAV 读取备份。', 'WEBDAV_BACKUP_DOWNLOAD_FAILED'); $_POST['password'] = $password; $_FILES['backup'] = ['error' => UPLOAD_ERR_OK, 'size' => filesize($path), 'tmp_name' => $path, 'name' => $name, 'type' => 'application/zip']; app_admin_backup_import();
}
