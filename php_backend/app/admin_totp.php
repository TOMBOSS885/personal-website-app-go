<?php

declare(strict_types=1);

const APP_ADMIN_TOTP_PERIOD = 30;
const APP_ADMIN_TOTP_DIGITS = 6;
const APP_ADMIN_TOTP_PENDING_TTL = 300;
const APP_ADMIN_TOTP_MAX_PENDING_ATTEMPTS = 5;

function app_schema_019_ready(): bool
{
    try {
        $columns = app_db()->query(
            "SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_account'
               AND COLUMN_NAME IN ('totp_secret_encrypted','totp_enabled','totp_last_counter','totp_confirmed_at')"
        )->fetchColumn();
        return (int) $columns === 4;
    } catch (Throwable $error) {
        error_log('Schema 019 check failed: ' . $error->getMessage());
        return false;
    }
}

function app_require_schema_019(): void
{
    if (!app_schema_019_ready()) {
        app_error(503, '请先导入 migrations/019_admin_totp.sql。', 'MIGRATION_REQUIRED');
    }
}

function app_admin_totp_encryption_key(): string
{
    $config = app_config();
    $material = (string) ($config['app']['setup_key'] ?? '') . '|' . (string) ($config['database']['name'] ?? '');
    return hash('sha256', 'admin-totp-secret|' . $material, true);
}

function app_admin_totp_encrypt_secret(string $secret): string
{
    if (!function_exists('openssl_encrypt')) {
        throw new RuntimeException('OpenSSL is required for administrator two-factor authentication.');
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($secret, 'aes-256-gcm', app_admin_totp_encryption_key(), OPENSSL_RAW_DATA, $iv, $tag, 'admin-totp-v1', 16);
    if ($cipher === false || strlen($tag) !== 16) {
        throw new RuntimeException('Unable to encrypt the administrator two-factor secret.');
    }
    return 'v1.' . base64_encode($iv) . '.' . base64_encode($tag) . '.' . base64_encode($cipher);
}

function app_admin_totp_decrypt_secret(string $payload): string
{
    if (!function_exists('openssl_decrypt')) {
        throw new RuntimeException('OpenSSL is required for administrator two-factor authentication.');
    }
    $parts = explode('.', $payload);
    if (count($parts) !== 4 || $parts[0] !== 'v1') {
        throw new RuntimeException('The administrator two-factor secret has an invalid format.');
    }
    $iv = base64_decode($parts[1], true);
    $tag = base64_decode($parts[2], true);
    $cipher = base64_decode($parts[3], true);
    if ($iv === false || strlen($iv) !== 12 || $tag === false || strlen($tag) !== 16 || $cipher === false) {
        throw new RuntimeException('The administrator two-factor secret is damaged.');
    }
    $secret = openssl_decrypt($cipher, 'aes-256-gcm', app_admin_totp_encryption_key(), OPENSSL_RAW_DATA, $iv, $tag, 'admin-totp-v1');
    if (!is_string($secret) || $secret === '') {
        throw new RuntimeException('Unable to decrypt the administrator two-factor secret. Check setup_key.');
    }
    return $secret;
}

function app_admin_totp_base32_encode(string $binary): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $buffer = 0;
    $bits = 0;
    $encoded = '';
    $length = strlen($binary);
    for ($index = 0; $index < $length; $index++) {
        $buffer = ($buffer << 8) | ord($binary[$index]);
        $bits += 8;
        while ($bits >= 5) {
            $bits -= 5;
            $encoded .= $alphabet[($buffer >> $bits) & 31];
            $buffer &= (1 << $bits) - 1;
        }
    }
    if ($bits > 0) $encoded .= $alphabet[($buffer << (5 - $bits)) & 31];
    return $encoded;
}

function app_admin_totp_base32_decode(string $encoded): string
{
    $alphabet = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));
    $encoded = strtoupper(preg_replace('/[\s=-]+/', '', $encoded) ?? '');
    if ($encoded === '') throw new InvalidArgumentException('The two-factor secret is empty.');
    $buffer = 0;
    $bits = 0;
    $binary = '';
    foreach (str_split($encoded) as $character) {
        if (!isset($alphabet[$character])) throw new InvalidArgumentException('The two-factor secret is invalid.');
        $buffer = ($buffer << 5) | $alphabet[$character];
        $bits += 5;
        if ($bits >= 8) {
            $bits -= 8;
            $binary .= chr(($buffer >> $bits) & 255);
            $buffer &= (1 << $bits) - 1;
        }
    }
    return $binary;
}

function app_admin_totp_code(string $base32Secret, int $counter): string
{
    $secret = app_admin_totp_base32_decode($base32Secret);
    $counterBytes = pack('N2', ($counter >> 32) & 0xffffffff, $counter & 0xffffffff);
    $digest = hash_hmac('sha1', $counterBytes, $secret, true);
    $offset = ord($digest[19]) & 0x0f;
    $number = ((ord($digest[$offset]) & 0x7f) << 24)
        | ((ord($digest[$offset + 1]) & 0xff) << 16)
        | ((ord($digest[$offset + 2]) & 0xff) << 8)
        | (ord($digest[$offset + 3]) & 0xff);
    return str_pad((string) ($number % (10 ** APP_ADMIN_TOTP_DIGITS)), APP_ADMIN_TOTP_DIGITS, '0', STR_PAD_LEFT);
}

/**
 * Returns the accepted RFC 6238 counter, or null when the code is invalid or
 * has already been accepted. A one-period clock-skew window is supported.
 */
function app_admin_totp_verify(string $secret, string $code, ?int $lastCounter = null, ?int $timestamp = null): ?int
{
    $code = trim($code);
    if (!preg_match('/^\d{' . APP_ADMIN_TOTP_DIGITS . '}$/D', $code)) return null;
    $counter = intdiv($timestamp ?? time(), APP_ADMIN_TOTP_PERIOD);
    for ($offset = -1; $offset <= 1; $offset++) {
        $candidate = $counter + $offset;
        if ($candidate < 0 || ($lastCounter !== null && $candidate <= $lastCounter)) continue;
        if (hash_equals(app_admin_totp_code($secret, $candidate), $code)) return $candidate;
    }
    return null;
}

function app_admin_totp_status(): array
{
    app_require_schema_019();
    $statement = app_db()->prepare('SELECT totp_enabled, totp_confirmed_at FROM admin_account WHERE id = ?');
    $statement->execute([(int) $_SESSION['admin_id']]);
    $admin = $statement->fetch();
    if (!$admin) app_error(404, 'Administrator account not found.', 'ADMIN_NOT_FOUND');
    return [
        'enabled' => !empty($admin['totp_enabled']),
        'confirmedAt' => app_now_iso($admin['totp_confirmed_at'] ?? null),
        'digits' => APP_ADMIN_TOTP_DIGITS,
        'period' => APP_ADMIN_TOTP_PERIOD,
    ];
}

function app_admin_totp_setup(): array
{
    app_require_schema_019();
    if (!app_security_peer_rate_limit_allow('admin-totp-settings', 30)) {
        app_error(429, '二步验证尝试过于频繁，请稍后再试。', 'TWO_FACTOR_RATE_LIMITED');
    }
    $body = app_body();
    $password = (string) ($body['currentPassword'] ?? '');
    $statement = app_db()->prepare('SELECT username, password_hash, totp_enabled FROM admin_account WHERE id = ?');
    $statement->execute([(int) $_SESSION['admin_id']]);
    $admin = $statement->fetch();
    if (!$admin || strlen($password) > 1024 || !password_verify($password, (string) $admin['password_hash'])) {
        app_error(400, '当前管理员密码不正确。', 'INVALID_CURRENT_PASSWORD');
    }
    if (!empty($admin['totp_enabled'])) {
        app_error(409, '二步验证已经开启。', 'TWO_FACTOR_ALREADY_ENABLED');
    }

    $secret = app_admin_totp_base32_encode(random_bytes(20));
    $_SESSION['admin_totp_setup_secret'] = $secret;
    $_SESSION['admin_totp_setup_admin_id'] = (int) $_SESSION['admin_id'];
    $_SESSION['admin_totp_setup_expires_at'] = time() + APP_ADMIN_TOTP_PENDING_TTL;
    $host = (string) (parse_url(app_public_site_url(), PHP_URL_HOST) ?: 'Personal Website');
    $issuer = 'Personal Website (' . $host . ')';
    $account = (string) $admin['username'];
    $label = rawurlencode($issuer . ':' . $account);
    $uri = 'otpauth://totp/' . $label
        . '?secret=' . rawurlencode($secret)
        . '&issuer=' . rawurlencode($issuer)
        . '&algorithm=SHA1&digits=' . APP_ADMIN_TOTP_DIGITS
        . '&period=' . APP_ADMIN_TOTP_PERIOD;
    app_audit_set_context(['action' => 'TWO_FACTOR_SETUP_STARTED', 'adminId' => (int) $_SESSION['admin_id'], 'username' => $account]);
    app_audit_set_details(['twoFactor' => ['stage' => 'setup_started']]);
    return ['secret' => $secret, 'otpauthUri' => $uri, 'expiresIn' => APP_ADMIN_TOTP_PENDING_TTL];
}

function app_admin_totp_confirm(): array
{
    app_require_schema_019();
    if (!app_security_peer_rate_limit_allow('admin-totp-settings', 30)) {
        app_error(429, '二步验证尝试过于频繁，请稍后再试。', 'TWO_FACTOR_RATE_LIMITED');
    }
    $body = app_body();
    $code = (string) ($body['code'] ?? '');
    app_audit_set_context(['action' => 'TWO_FACTOR_ENABLED', 'adminId' => (int) $_SESSION['admin_id']]);
    app_audit_set_details(['twoFactor' => ['stage' => 'setup_confirmation']]);
    $secret = (string) ($_SESSION['admin_totp_setup_secret'] ?? '');
    $setupAdminId = (int) ($_SESSION['admin_totp_setup_admin_id'] ?? 0);
    $expiresAt = (int) ($_SESSION['admin_totp_setup_expires_at'] ?? 0);
    if ($secret === '' || $setupAdminId !== (int) $_SESSION['admin_id'] || $expiresAt < time()) {
        unset($_SESSION['admin_totp_setup_secret'], $_SESSION['admin_totp_setup_admin_id'], $_SESSION['admin_totp_setup_expires_at']);
        app_error(400, '绑定已过期，请重新开始。', 'TWO_FACTOR_SETUP_EXPIRED');
    }
    $counter = app_admin_totp_verify($secret, $code);
    if ($counter === null) app_error(400, '验证码不正确或已过期。', 'INVALID_TWO_FACTOR_CODE');

    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare('SELECT id, username, session_version, totp_enabled FROM admin_account WHERE id = ? FOR UPDATE');
        $statement->execute([$setupAdminId]);
        $admin = $statement->fetch();
        if (!$admin) {
            $database->rollBack();
            app_error(404, 'Administrator account not found.', 'ADMIN_NOT_FOUND');
        }
        if (!empty($admin['totp_enabled'])) {
            $database->rollBack();
            app_error(409, '二步验证已经开启。', 'TWO_FACTOR_ALREADY_ENABLED');
        }
        $encrypted = app_admin_totp_encrypt_secret($secret);
        $nextSessionVersion = ((int) $admin['session_version']) + 1;
        $update = $database->prepare(
            'UPDATE admin_account
             SET totp_secret_encrypted = ?, totp_enabled = 1, totp_last_counter = ?, totp_confirmed_at = NOW(),
                 session_version = ?, updated_at = NOW()
             WHERE id = ?'
        );
        $update->execute([$encrypted, $counter, $nextSessionVersion, $setupAdminId]);
        $database->commit();
        $_SESSION['admin_session_version'] = $nextSessionVersion;
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    unset($_SESSION['admin_totp_setup_secret'], $_SESSION['admin_totp_setup_admin_id'], $_SESSION['admin_totp_setup_expires_at']);
    return ['success' => true, 'enabled' => true, 'confirmedAt' => date(DATE_ATOM)];
}

function app_admin_totp_disable(): array
{
    app_require_schema_019();
    if (!app_security_peer_rate_limit_allow('admin-totp-settings', 30)) {
        app_error(429, '二步验证尝试过于频繁，请稍后再试。', 'TWO_FACTOR_RATE_LIMITED');
    }
    $body = app_body();
    $code = (string) ($body['code'] ?? '');
    app_audit_set_context(['action' => 'TWO_FACTOR_DISABLED', 'adminId' => (int) $_SESSION['admin_id']]);
    app_audit_set_details(['twoFactor' => ['stage' => 'disable_confirmation']]);
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare(
            'SELECT id, username, session_version, totp_enabled, totp_secret_encrypted, totp_last_counter
             FROM admin_account WHERE id = ? FOR UPDATE'
        );
        $statement->execute([(int) $_SESSION['admin_id']]);
        $admin = $statement->fetch();
        if (!$admin) {
            $database->rollBack();
            app_error(404, 'Administrator account not found.', 'ADMIN_NOT_FOUND');
        }
        if (empty($admin['totp_enabled']) || (string) $admin['totp_secret_encrypted'] === '') {
            $database->rollBack();
            app_error(409, '二步验证尚未开启。', 'TWO_FACTOR_NOT_ENABLED');
        }
        try {
            $secret = app_admin_totp_decrypt_secret((string) $admin['totp_secret_encrypted']);
        } catch (Throwable $error) {
            error_log('Administrator TOTP secret decrypt failed during disable: ' . $error->getMessage());
            $database->rollBack();
            app_error(500, '无法读取二步验证配置，请检查 setup_key。', 'TWO_FACTOR_CONFIGURATION_INVALID');
        }
        $lastCounter = $admin['totp_last_counter'] === null ? null : (int) $admin['totp_last_counter'];
        $counter = app_admin_totp_verify($secret, $code, $lastCounter);
        if ($counter === null) {
            $database->rollBack();
            app_error(400, '验证码不正确、已过期或已被使用。', 'INVALID_TWO_FACTOR_CODE');
        }
        $nextSessionVersion = ((int) $admin['session_version']) + 1;
        $update = $database->prepare(
            'UPDATE admin_account
             SET totp_secret_encrypted = NULL, totp_enabled = 0, totp_last_counter = NULL, totp_confirmed_at = NULL,
                 session_version = ?, updated_at = NOW()
             WHERE id = ?'
        );
        $update->execute([$nextSessionVersion, (int) $admin['id']]);
        $database->commit();
        $_SESSION['admin_session_version'] = $nextSessionVersion;
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    unset($_SESSION['admin_totp_setup_secret'], $_SESSION['admin_totp_setup_admin_id'], $_SESSION['admin_totp_setup_expires_at']);
    return ['success' => true, 'enabled' => false];
}

function app_admin_totp_clear_pending_login(): void
{
    unset(
        $_SESSION['admin_totp_pending_id'],
        $_SESSION['admin_totp_pending_username'],
        $_SESSION['admin_totp_pending_session_version'],
        $_SESSION['admin_totp_pending_expires_at'],
        $_SESSION['admin_totp_pending_attempts']
    );
}

function app_admin_totp_begin_pending_login(array $admin): void
{
    $_SESSION = [];
    session_regenerate_id(true);
    $_SESSION['admin_totp_pending_id'] = (int) $admin['id'];
    $_SESSION['admin_totp_pending_username'] = (string) $admin['username'];
    $_SESSION['admin_totp_pending_session_version'] = (int) $admin['session_version'];
    $_SESSION['admin_totp_pending_expires_at'] = time() + APP_ADMIN_TOTP_PENDING_TTL;
    $_SESSION['admin_totp_pending_attempts'] = 0;
}

function app_admin_complete_login(array $admin): void
{
    $_SESSION = [];
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_username'] = (string) $admin['username'];
    $_SESSION['admin_session_version'] = (int) $admin['session_version'];
    $_SESSION['admin_created_at'] = time();
    $_SESSION['admin_last_seen_at'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function app_admin_totp_complete_pending_login(): void
{
    app_require_schema_019();
    app_audit_set_context([
        'eventType' => 'authentication',
        'action' => 'TWO_FACTOR_LOGIN',
        'adminId' => (int) ($_SESSION['admin_totp_pending_id'] ?? 0) ?: null,
        'username' => (string) ($_SESSION['admin_totp_pending_username'] ?? ''),
    ]);
    app_audit_set_details(['twoFactor' => ['stage' => 'login_challenge']]);
    if (!app_security_peer_rate_limit_allow('admin-totp-login', 30)) {
        app_error(429, '二步验证尝试过于频繁，请稍后再试。', 'TWO_FACTOR_RATE_LIMITED');
    }
    $pendingId = (int) ($_SESSION['admin_totp_pending_id'] ?? 0);
    $expiresAt = (int) ($_SESSION['admin_totp_pending_expires_at'] ?? 0);
    $attempts = (int) ($_SESSION['admin_totp_pending_attempts'] ?? 0);
    if ($pendingId <= 0 || $expiresAt < time()) {
        app_admin_totp_clear_pending_login();
        app_error(401, '二步验证已过期，请重新登录。', 'TWO_FACTOR_CHALLENGE_EXPIRED');
    }
    if ($attempts >= APP_ADMIN_TOTP_MAX_PENDING_ATTEMPTS) {
        app_admin_totp_clear_pending_login();
        app_error(429, '验证失败次数过多，请重新登录。', 'TWO_FACTOR_CHALLENGE_LOCKED');
    }
    $body = app_body();
    $code = (string) ($body['code'] ?? '');
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare(
            'SELECT id, username, session_version, totp_enabled, totp_secret_encrypted, totp_last_counter
             FROM admin_account WHERE id = ? FOR UPDATE'
        );
        $statement->execute([$pendingId]);
        $admin = $statement->fetch();
        $pendingVersion = (int) ($_SESSION['admin_totp_pending_session_version'] ?? 0);
        if (!$admin || empty($admin['totp_enabled']) || (int) ($admin['session_version'] ?? 0) !== $pendingVersion) {
            $database->rollBack();
            app_admin_totp_clear_pending_login();
            app_error(401, '登录验证已失效，请重新登录。', 'TWO_FACTOR_CHALLENGE_INVALID');
        }
        try {
            $secret = app_admin_totp_decrypt_secret((string) $admin['totp_secret_encrypted']);
        } catch (Throwable $error) {
            error_log('Administrator TOTP secret decrypt failed during login: ' . $error->getMessage());
            $database->rollBack();
            app_admin_totp_clear_pending_login();
            app_error(500, '无法读取二步验证配置，请检查 setup_key。', 'TWO_FACTOR_CONFIGURATION_INVALID');
        }
        $lastCounter = $admin['totp_last_counter'] === null ? null : (int) $admin['totp_last_counter'];
        $counter = app_admin_totp_verify($secret, $code, $lastCounter);
        if ($counter === null) {
            $database->rollBack();
            $_SESSION['admin_totp_pending_attempts'] = $attempts + 1;
            if ($_SESSION['admin_totp_pending_attempts'] >= APP_ADMIN_TOTP_MAX_PENDING_ATTEMPTS) {
                app_admin_totp_clear_pending_login();
                app_error(429, '验证失败次数过多，请重新登录。', 'TWO_FACTOR_CHALLENGE_LOCKED');
            }
            $remaining = APP_ADMIN_TOTP_MAX_PENDING_ATTEMPTS - (int) $_SESSION['admin_totp_pending_attempts'];
            app_error(401, '验证码不正确、已过期或已被使用。还可以尝试 ' . $remaining . ' 次。', 'INVALID_TWO_FACTOR_CODE');
        }
        $update = $database->prepare(
            'UPDATE admin_account SET totp_last_counter = ?, failed_login_attempts = 0, locked_until = NULL,
             last_login_at = NOW(), updated_at = NOW() WHERE id = ?'
        );
        $update->execute([$counter, (int) $admin['id']]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    app_admin_complete_login($admin);
    app_json(['success' => true, 'username' => $admin['username'], 'csrfToken' => $_SESSION['csrf_token']]);
}
