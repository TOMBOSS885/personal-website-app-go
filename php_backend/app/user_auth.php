<?php

declare(strict_types=1);

function app_user_email(string $value): string
{
    $email = strtolower(trim($value));
    if (!preg_match("/^[a-z0-9.!#$%&'*+\\/=?^_`{|}~-]+@qq\\.com$/i", $email) || strlen($email) > 254) {
        app_error(400, '仅支持使用 QQ 邮箱注册。', 'QQ_EMAIL_REQUIRED');
    }
    return $email;
}

function app_user_session_clear(): void
{
    unset($_SESSION['user_id'], $_SESSION['user_email'], $_SESSION['user_session_version'], $_SESSION['user_created_at'], $_SESSION['user_last_seen_at'], $_SESSION['user_csrf_token'], $_SESSION['oauth_states']);
}

function app_user_required(): void
{
    if (empty($_SESSION['user_id'])) app_error(401, '请先登录。', 'USER_UNAUTHENTICATED');
    $now = time();
    if ((int) ($_SESSION['user_created_at'] ?? 0) <= 0 || (int) ($_SESSION['user_last_seen_at'] ?? 0) <= 0
        || $now - (int) $_SESSION['user_created_at'] > 86400 * 30 || $now - (int) $_SESSION['user_last_seen_at'] > 86400 * 7) {
        app_user_session_clear();
        app_error(401, '登录状态已过期，请重新登录。', 'USER_SESSION_EXPIRED');
    }
    $statement = app_db()->prepare('SELECT email, session_version, locked_until, disabled_at FROM user_accounts WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $user = $statement->fetch();
    if (!$user || !hash_equals((string) $user['session_version'], (string) ($_SESSION['user_session_version'] ?? '')) || !empty($user['disabled_at']) || (!empty($user['locked_until']) && strtotime((string) $user['locked_until']) > time())) {
        app_user_session_clear();
        app_error(401, '账号当前不可用，请重新登录。', 'USER_SESSION_INVALID');
    }
    $_SESSION['user_last_seen_at'] = $now;
    $_SESSION['user_email'] = (string) $user['email'];
}

function app_user_register(): void
{
    $body = app_body();
    $email = app_user_email((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    if (strlen($password) < 10 || strlen($password) > 128) app_error(400, '密码长度必须为 10 至 128 位。', 'PASSWORD_INVALID');
    // Registration verification is opt-in and deliberately does not affect login or OAuth.
    if (function_exists('app_registration_email_verification_enabled') && app_registration_email_verification_enabled()) {
        app_verify_registration_code($email, (string) ($body['emailCode'] ?? ''));
    }
    try {
        $statement = app_db()->prepare('INSERT INTO user_accounts (email, password_hash, created_at, updated_at) VALUES (?, ?, NOW(), NOW())');
        $statement->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
    } catch (PDOException $error) {
        if ((int) $error->errorInfo[1] === 1062) app_error(409, '该 QQ 邮箱已经注册。', 'USER_EXISTS');
        throw $error;
    }
    $id = (int) app_db()->lastInsertId();
    app_audit_set_context(['username' => $email, 'action' => 'USER_REGISTER', 'eventType' => 'authentication', 'adminId' => null]);
    app_audit_set_details(['accountType' => 'user', 'email' => $email]);
    app_user_start_session($id, $email, 1);
    app_json(['success' => true] + app_user_session_payload());
}

function app_user_start_session(int $id, string $email, int $sessionVersion): void
{
    session_regenerate_id(true);
    // A browser may have an older administrator session. Never allow the
    // public account flow to inherit administrator privileges from it.
    unset($_SESSION['admin_id'], $_SESSION['admin_username'], $_SESSION['admin_session_version'], $_SESSION['admin_created_at'], $_SESSION['admin_last_seen_at'], $_SESSION['csrf_token'], $_SESSION['oauth_states']);
    $_SESSION['user_id'] = $id;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_session_version'] = $sessionVersion;
    $_SESSION['user_created_at'] = time();
    $_SESSION['user_last_seen_at'] = time();
    $_SESSION['user_csrf_token'] = bin2hex(random_bytes(32));
}

function app_user_csrf_required(): void
{
    $fetchSite = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
    if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) {
        app_error(403, 'Cross-site account requests are not allowed.', 'CROSS_SITE_REQUEST_BLOCKED');
    }
    $expected = (string) ($_SESSION['user_csrf_token'] ?? '');
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        app_error(403, 'CSRF validation failed. Refresh the page and try again.', 'CSRF_FAILED');
    }
}

function app_user_login(): void
{
    $body = app_body();
    $email = app_user_email((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    app_audit_set_context(['username' => $email, 'action' => 'USER_LOGIN', 'eventType' => 'authentication', 'adminId' => null]);
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare('SELECT * FROM user_accounts WHERE email = ? FOR UPDATE');
        $statement->execute([$email]);
        $user = $statement->fetch();
        $locked = $user && !empty($user['locked_until']) && strtotime((string) $user['locked_until']) > time();
        $disabled = $user && !empty($user['disabled_at']);
        $valid = $user && !$locked && !$disabled && strlen($password) <= 128 && password_verify($password, (string) $user['password_hash']);
        if (!$valid) {
            if ($user && !$locked && !$disabled) {
                $attempts = (int) $user['failed_login_attempts'] + 1;
                if ($attempts >= 3) {
                    $database->prepare('UPDATE user_accounts SET failed_login_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL 1 DAY), updated_at = NOW() WHERE id = ?')->execute([$user['id']]);
                    $locked = true;
                } else {
                    $database->prepare('UPDATE user_accounts SET failed_login_attempts = ?, updated_at = NOW() WHERE id = ?')->execute([$attempts, $user['id']]);
                }
            }
            $database->commit();
            app_audit_set_details(['accountType' => 'user', 'email' => $email, 'locked' => (bool) $locked, 'disabled' => (bool) $disabled]);
            app_error($disabled ? 403 : ($locked ? 429 : 401), $disabled ? '账号已被管理员禁用。' : ($locked ? '密码错误次数达到 3 次，账号已冻结 24 小时。' : '邮箱或密码错误。'), $disabled ? 'USER_DISABLED' : ($locked ? 'USER_LOCKED' : 'USER_INVALID_CREDENTIALS'));
        }
        $database->prepare('UPDATE user_accounts SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?')->execute([$user['id']]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    app_audit_set_details(['accountType' => 'user', 'email' => $email]);
    app_user_start_session((int) $user['id'], $email, (int) $user['session_version']);
    app_json(['success' => true] + app_user_session_payload());
}

function app_user_logout(): void
{
    if (!empty($_SESSION['user_id'])) {
        app_audit_set_context(['username' => (string) ($_SESSION['user_email'] ?? ''), 'adminId' => null, 'action' => 'USER_LOGOUT', 'eventType' => 'authentication']);
        app_audit_set_details(['accountType' => 'user']);
    }
    app_user_session_clear();
    app_json(['success' => true]);
}

function app_user_session_payload(): array
{
    if (empty($_SESSION['user_id'])) return ['authenticated' => false];
    app_user_required();
    if (empty($_SESSION['user_csrf_token'])) $_SESSION['user_csrf_token'] = bin2hex(random_bytes(32));
    $hasOAuthIdentity = function_exists('app_schema_015_ready') && app_schema_015_ready()
        ? app_oauth_user_has_identity((int) $_SESSION['user_id']) : false;
    return [
        'authenticated' => true,
        'userId' => (int) $_SESSION['user_id'],
        'email' => (string) $_SESSION['user_email'],
        'csrfToken' => (string) $_SESSION['user_csrf_token'],
        'hasOAuthIdentity' => $hasOAuthIdentity,
    ];
}
