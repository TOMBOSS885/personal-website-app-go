<?php

declare(strict_types=1);

const APP_EMAIL_CODE_TTL_MINUTES = 10;
const APP_EMAIL_CODE_RESEND_SECONDS = 60;
const APP_EMAIL_CODE_MAX_ATTEMPTS = 5;
const APP_EMAIL_CODE_IP_HOURLY_LIMIT = 10;

function app_schema_017_ready(): bool
{
    try {
        $tables = (int) app_db()->query("SELECT COUNT(DISTINCT TABLE_NAME) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('mail_settings','email_verification_codes')")->fetchColumn();
        return $tables === 2;
    } catch (Throwable $error) {
        return false;
    }
}

function app_require_schema_017(): void
{
    if (!app_schema_017_ready()) app_error(503, 'Please import migrations/017_smtp_email_verification.sql first.', 'MIGRATION_REQUIRED');
}

function app_mail_settings_ensure(): array
{
    app_require_schema_017();
    $row = app_db()->query('SELECT * FROM mail_settings WHERE id = 1')->fetch();
    if (!$row) {
        app_db()->exec('INSERT INTO mail_settings (id, updated_at) VALUES (1, NOW())');
        $row = app_db()->query('SELECT * FROM mail_settings WHERE id = 1')->fetch();
    }
    return is_array($row) ? $row : [];
}

function app_mail_settings_public(array $row): array
{
    $passwordConfigured = trim((string) ($row['smtp_password_encrypted'] ?? '')) !== '';
    return [
        'smtpEnabled' => !empty($row['smtp_enabled']),
        'smtpHost' => (string) ($row['smtp_host'] ?? ''),
        'smtpPort' => (int) ($row['smtp_port'] ?? 465),
        'smtpUsername' => (string) ($row['smtp_username'] ?? ''),
        'smtpPasswordConfigured' => $passwordConfigured,
        'smtpFromEmail' => (string) ($row['smtp_from_email'] ?? ''),
        'smtpFromName' => (string) ($row['smtp_from_name'] ?? ''),
        'smtpSecurity' => (string) ($row['smtp_security'] ?? 'ssl'),
        'registrationEmailVerificationEnabled' => !empty($row['registration_email_verification_enabled']),
        'lastTestAt' => app_now_iso($row['last_test_at'] ?? null),
        'lastTestSuccess' => $row['last_test_success'] === null ? null : !empty($row['last_test_success']),
        'updatedAt' => app_now_iso($row['updated_at'] ?? null),
    ];
}

function app_mail_crypto_key(): string
{
    return hash('sha256', 'smtp-password|' . (string) (app_config()['app']['setup_key'] ?? '') . '|' . (string) (app_config()['database']['name'] ?? ''), true);
}

function app_mail_encrypt_password(string $password): string
{
    if ($password === '') return '';
    if (!function_exists('openssl_encrypt')) app_error(500, '服务器不支持安全的 SMTP 密码加密。', 'SMTP_ENCRYPTION_UNAVAILABLE');
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($password, 'aes-256-gcm', app_mail_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);
    if (!is_string($cipher) || $cipher === '' || $tag === '') app_error(500, 'SMTP 密码加密失败。', 'SMTP_ENCRYPTION_FAILED');
    return 'v1.' . base64_encode($iv) . '.' . base64_encode($tag) . '.' . base64_encode($cipher);
}

function app_mail_decrypt_password(string $value): string
{
    if (!function_exists('openssl_decrypt')) return '';
    $parts = explode('.', $value);
    if (count($parts) !== 4 || $parts[0] !== 'v1') return '';
    $iv = base64_decode($parts[1], true);
    $tag = base64_decode($parts[2], true);
    $cipher = base64_decode($parts[3], true);
    if ($iv === false || $tag === false || $cipher === false) return '';
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', app_mail_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return is_string($plain) ? $plain : '';
}

function app_mail_validate_settings(array $row, bool $requireEnabled = true): void
{
    if ($requireEnabled && empty($row['smtp_enabled'])) app_error(400, '请先启用 SMTP 服务。', 'SMTP_DISABLED');
    if (trim((string) ($row['smtp_host'] ?? '')) === '') app_error(400, 'SMTP 服务器不能为空。', 'SMTP_HOST_REQUIRED');
    $port = (int) ($row['smtp_port'] ?? 0);
    if ($port < 1 || $port > 65535) app_error(400, 'SMTP 端口无效。', 'SMTP_PORT_INVALID');
    if (trim((string) ($row['smtp_username'] ?? '')) === '') app_error(400, 'SMTP 用户名不能为空。', 'SMTP_USERNAME_REQUIRED');
    if (trim((string) ($row['smtp_from_email'] ?? '')) === '' || !filter_var($row['smtp_from_email'], FILTER_VALIDATE_EMAIL)) app_error(400, '发件邮箱格式无效。', 'SMTP_FROM_EMAIL_INVALID');
    if (!in_array(strtolower((string) ($row['smtp_security'] ?? '')), ['none', 'starttls', 'ssl'], true)) app_error(400, 'SMTP 安全连接方式无效。', 'SMTP_SECURITY_INVALID');
    if (app_mail_decrypt_password((string) ($row['smtp_password_encrypted'] ?? '')) === '') app_error(400, '请先配置 SMTP 密码或授权码。', 'SMTP_PASSWORD_REQUIRED');
}

function app_admin_mail_settings(): array
{
    return app_mail_settings_public(app_mail_settings_ensure());
}

function app_update_admin_mail_settings(): array
{
    app_require_schema_017();
    $body = app_body();
    $current = app_mail_settings_ensure();
    $enabled = app_bool($body['smtpEnabled'] ?? false);
    $registrationEnabled = app_bool($body['registrationEmailVerificationEnabled'] ?? false);
    $host = trim((string) ($body['smtpHost'] ?? ''));
    $port = app_int($body['smtpPort'] ?? 465, 465);
    $username = trim((string) ($body['smtpUsername'] ?? ''));
    $fromEmail = strtolower(trim((string) ($body['smtpFromEmail'] ?? '')));
    $fromName = trim((string) ($body['smtpFromName'] ?? ''));
    $security = strtolower(trim((string) ($body['smtpSecurity'] ?? 'ssl')));
    $passwordInput = (string) ($body['smtpPassword'] ?? '');
    if ($passwordInput !== '' && strlen($passwordInput) > 1024) app_error(400, 'SMTP 密码或授权码过长。', 'SMTP_PASSWORD_INVALID');
    $passwordEncrypted = $passwordInput !== '' ? app_mail_encrypt_password($passwordInput) : (string) ($current['smtp_password_encrypted'] ?? '');
    // Verification cannot operate without SMTP; turning SMTP off also turns
    // this dependent behavior off so administrators cannot get stuck with a
    // checked but unusable setting.
    if (!$enabled) $registrationEnabled = false;
    $candidate = ['smtp_enabled' => $enabled, 'smtp_host' => $host, 'smtp_port' => $port, 'smtp_username' => $username, 'smtp_password_encrypted' => $passwordEncrypted, 'smtp_from_email' => $fromEmail, 'smtp_from_name' => $fromName, 'smtp_security' => $security];
    if ($enabled || $registrationEnabled) app_mail_validate_settings($candidate);
    $database = app_db();
    $statement = $database->prepare('UPDATE mail_settings SET smtp_enabled = ?, smtp_host = ?, smtp_port = ?, smtp_username = ?, smtp_password_encrypted = ?, smtp_from_email = ?, smtp_from_name = ?, smtp_security = ?, registration_email_verification_enabled = ?, last_test_at = NULL, last_test_success = NULL, updated_at = NOW(), updated_by = ? WHERE id = 1');
    $statement->execute([$enabled ? 1 : 0, $host, $port, $username, $passwordEncrypted, $fromEmail, $fromName, $security, $registrationEnabled ? 1 : 0, (int) $_SESSION['admin_id']]);
    app_audit_set_context(['action' => 'UPDATE_SMTP_SETTINGS', 'eventType' => 'admin_request', 'adminId' => (int) $_SESSION['admin_id']]);
    app_audit_set_details(['smtpEnabled' => $enabled, 'registrationEmailVerificationEnabled' => $registrationEnabled, 'passwordUpdated' => $passwordInput !== '']);
    return app_admin_mail_settings();
}

function app_registration_email_verification_enabled(): bool
{
    if (!app_schema_017_ready()) return false;
    $row = app_db()->query('SELECT smtp_enabled, registration_email_verification_enabled FROM mail_settings WHERE id = 1')->fetch();
    return is_array($row) && !empty($row['smtp_enabled']) && !empty($row['registration_email_verification_enabled']);
}

function app_public_registration_settings(): array
{
    app_require_schema_017();
    return ['registrationEmailVerificationEnabled' => app_registration_email_verification_enabled()];
}

function app_mail_site_name(): string
{
    try {
        $profile = app_profile(true);
        return trim((string) ($profile['nickname'] ?? '')) ?: '本站';
    } catch (Throwable $error) {
        return '本站';
    }
}

function app_smtp_read($socket): string
{
    $response = '';
    while (($line = fgets($socket, 2048)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') break;
    }
    if ($response === '') throw new RuntimeException('SMTP server returned no response.');
    return $response;
}

function app_smtp_expect($socket, array $codes): void
{
    $response = app_smtp_read($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $codes, true)) throw new RuntimeException('SMTP response ' . $code . '.');
}

function app_smtp_command($socket, string $command, array $codes): void
{
    if (@fwrite($socket, $command . "\r\n") === false) throw new RuntimeException('SMTP write failed.');
    app_smtp_expect($socket, $codes);
}

function app_smtp_send(array $settings, string $to, string $subject, string $html, string $text): void
{
    app_mail_validate_settings($settings);
    $host = trim((string) $settings['smtp_host']);
    $security = strtolower((string) $settings['smtp_security']);
    $port = (int) $settings['smtp_port'];
    $timeout = 12;
    $transport = $security === 'ssl' ? 'ssl://' . $host : $host;
    $errno = 0;
    $errstr = '';
    $socket = @fsockopen($transport, $port, $errno, $errstr, $timeout);
    if (!is_resource($socket)) throw new RuntimeException('SMTP connection failed.');
    stream_set_timeout($socket, $timeout);
    try {
        app_smtp_expect($socket, [220]);
        $helo = gethostname() ?: 'localhost';
        app_smtp_command($socket, 'EHLO ' . preg_replace('/[^a-z0-9.-]/i', '-', $helo), [250]);
        if ($security === 'starttls') {
            app_smtp_command($socket, 'STARTTLS', [220]);
            $crypto = defined('STREAM_CRYPTO_METHOD_TLS_CLIENT') ? STREAM_CRYPTO_METHOD_TLS_CLIENT : STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            if (!@stream_socket_enable_crypto($socket, true, $crypto)) throw new RuntimeException('TLS handshake failed.');
            app_smtp_command($socket, 'EHLO ' . preg_replace('/[^a-z0-9.-]/i', '-', $helo), [250]);
        }
        app_smtp_command($socket, 'AUTH LOGIN', [334]);
        app_smtp_command($socket, base64_encode((string) $settings['smtp_username']), [334]);
        app_smtp_command($socket, base64_encode(app_mail_decrypt_password((string) $settings['smtp_password_encrypted'])), [235]);
        $from = strtolower(trim((string) $settings['smtp_from_email']));
        app_smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
        app_smtp_command($socket, 'RCPT TO:<' . strtolower(trim($to)) . '>', [250, 251]);
        app_smtp_command($socket, 'DATA', [354]);
        $fromName = trim((string) $settings['smtp_from_name']);
        $encodedName = $fromName !== '' ? '=?UTF-8?B?' . base64_encode($fromName) . '?=' : $from;
        $boundary = '=_part_' . bin2hex(random_bytes(12));
        $toHeader = strtolower(trim($to));
        $headers = 'From: ' . $encodedName . ' <' . $from . ">\r\n"
            . 'To: <' . $toHeader . ">\r\n"
            . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
            . "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
        $body = '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $text . "\r\n\r\n--" . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $html . "\r\n\r\n--" . $boundary . "--\r\n.\r\n";
        if (@fwrite($socket, $headers . $body) === false) throw new RuntimeException('SMTP message write failed.');
        app_smtp_expect($socket, [250]);
        @fwrite($socket, "QUIT\r\n");
    } finally {
        fclose($socket);
    }
}

function app_mail_error_message(Throwable $error): string
{
    $message = strtolower($error->getMessage());
    if (str_contains($message, 'tls')) return 'TLS 握手失败，请检查安全连接方式和端口。';
    if (str_contains($message, 'auth') || str_contains($message, 'response 535')) return 'SMTP 认证失败，请检查用户名和密码或授权码。';
    if (str_contains($message, 'rcpt') || str_contains($message, 'response 550')) return '收件人被 SMTP 服务器拒绝。';
    if (str_contains($message, 'connection')) return 'SMTP 服务器无法连接，请检查 Host、端口或网络限制。';
    return '邮件发送失败，请检查 SMTP 配置后重试。';
}

function app_admin_mail_test(): array
{
    app_require_schema_017();
    $body = app_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) app_error(400, '测试收件邮箱格式无效。', 'TEST_EMAIL_INVALID');
    $settings = app_mail_settings_ensure();
    try {
        $mail = app_smtp_test_mail(app_mail_site_name());
        app_smtp_send($settings, $email, 'SMTP 邮件服务测试', $mail['html'], $mail['text']);
        app_db()->prepare('UPDATE mail_settings SET last_test_at = NOW(), last_test_success = 1 WHERE id = 1')->execute();
        app_audit_set_context(['action' => 'SMTP_TEST', 'eventType' => 'admin_request', 'adminId' => (int) $_SESSION['admin_id']]);
        app_audit_set_details(['success' => true, 'recipient' => $email]);
        return ['success' => true, 'message' => '测试邮件发送成功。'];
    } catch (Throwable $error) {
        app_db()->prepare('UPDATE mail_settings SET last_test_at = NOW(), last_test_success = 0 WHERE id = 1')->execute();
        app_audit_set_context(['action' => 'SMTP_TEST', 'eventType' => 'admin_request', 'adminId' => (int) $_SESSION['admin_id']]);
        app_audit_set_details(['success' => false, 'recipient' => $email]);
        error_log('SMTP test failed: ' . $error->getMessage());
        app_error(502, app_mail_error_message($error), 'SMTP_TEST_FAILED');
    }
}

function app_mask_email(string $email): string
{
    [$local, $domain] = explode('@', $email, 2);
    $visible = function_exists('mb_substr') ? mb_substr($local, 0, 1) : substr($local, 0, 1);
    return $visible . str_repeat('*', max(2, min(8, strlen($local) - 1))) . '@' . $domain;
}

function app_send_registration_code(string $email): array
{
    app_require_schema_017();
    if (!app_registration_email_verification_enabled()) app_error(400, '当前未启用注册邮箱验证。', 'REGISTRATION_VERIFICATION_DISABLED');
    $statement = app_db()->prepare('SELECT id FROM user_accounts WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    if ($statement->fetchColumn()) app_error(409, '该 QQ 邮箱已经注册。', 'USER_EXISTS');
    app_db()->exec("DELETE FROM email_verification_codes WHERE expires_at < NOW() OR used_at IS NOT NULL AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
    $latest = app_db()->prepare("SELECT created_at FROM email_verification_codes WHERE email = ? AND purpose = 'REGISTER' AND used_at IS NULL ORDER BY id DESC LIMIT 1");
    $latest->execute([$email]);
    $created = $latest->fetchColumn();
    if ($created && strtotime((string) $created) > time() - APP_EMAIL_CODE_RESEND_SECONDS) app_error(429, '验证码发送过于频繁，请稍后再试。', 'EMAIL_CODE_COOLDOWN');
    $clientHash = hash('sha256', 'email-code|' . app_security_secret('email-code') . '|' . app_client_address(), true);
    $ipCount = app_db()->prepare("SELECT COUNT(*) FROM email_verification_codes WHERE client_hash = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    $ipCount->execute([$clientHash]);
    if ((int) $ipCount->fetchColumn() >= APP_EMAIL_CODE_IP_HOURLY_LIMIT) app_error(429, '验证码请求次数已达上限，请稍后再试。', 'EMAIL_CODE_RATE_LIMIT');
    $code = (string) random_int(100000, 999999);
    $hash = hash_hmac('sha256', $code, app_security_secret('registration-code'));
    $database = app_db();
    $database->prepare("UPDATE email_verification_codes SET used_at = NOW() WHERE email = ? AND purpose = 'REGISTER' AND used_at IS NULL")->execute([$email]);
    $database->prepare("INSERT INTO email_verification_codes (email, purpose, code_hash, expires_at, client_hash, created_at) VALUES (?, 'REGISTER', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, NOW())")->execute([$email, $hash, $clientHash]);
    $settings = app_mail_settings_ensure();
    try {
        $mail = app_registration_code_mail(app_mail_site_name(), $code, APP_EMAIL_CODE_TTL_MINUTES);
        app_smtp_send($settings, $email, '注册邮箱验证码', $mail['html'], $mail['text']);
    } catch (Throwable $error) {
        $database->prepare("DELETE FROM email_verification_codes WHERE email = ? AND purpose = 'REGISTER' AND code_hash = ?")->execute([$email, $hash]);
        error_log('Registration email delivery failed: ' . $error->getMessage());
        app_error(502, app_mail_error_message($error), 'EMAIL_CODE_SEND_FAILED');
    }
    return ['success' => true, 'message' => '验证码已发送至 ' . app_mask_email($email), 'maskedEmail' => app_mask_email($email), 'expiresIn' => APP_EMAIL_CODE_TTL_MINUTES * 60];
}

function app_verify_registration_code(string $email, string $code): void
{
    if (!preg_match('/^\d{6}$/', $code)) app_error(400, '请输入 6 位邮箱验证码。', 'EMAIL_CODE_INVALID');
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare("SELECT * FROM email_verification_codes WHERE email = ? AND purpose = 'REGISTER' AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE");
        $statement->execute([$email]);
        $row = $statement->fetch();
        $valid = $row && strtotime((string) $row['expires_at']) >= time() && hash_equals((string) $row['code_hash'], hash_hmac('sha256', $code, app_security_secret('registration-code')));
        if (!$row || strtotime((string) ($row['expires_at'] ?? '')) < time()) {
            $database->rollBack();
            app_error(400, '验证码已过期，请重新获取。', 'EMAIL_CODE_EXPIRED');
        }
        if (!$valid) {
            $attempts = (int) $row['attempt_count'] + 1;
            $database->prepare('UPDATE email_verification_codes SET attempt_count = ?, used_at = CASE WHEN ? >= ' . APP_EMAIL_CODE_MAX_ATTEMPTS . ' THEN NOW() ELSE used_at END WHERE id = ?')->execute([$attempts, $attempts, $row['id']]);
            $database->commit();
            app_error(400, $attempts >= APP_EMAIL_CODE_MAX_ATTEMPTS ? '验证码错误次数过多，请重新获取。' : '验证码错误，请重新输入。', 'EMAIL_CODE_INVALID');
        }
        $database->prepare('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?')->execute([$row['id']]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
}
