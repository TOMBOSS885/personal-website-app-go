<?php

declare(strict_types=1);

const APP_OAUTH_TRANSACTION_TTL = 600;
const APP_OAUTH_HTTP_MAX_BYTES = 1048576;

function app_oauth_base64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function app_oauth_provider_names(): array
{
    return ['github' => 'GitHub', 'qq' => 'QQ', 'wechat' => '微信', 'google' => 'Google', 'microsoft' => 'Microsoft'];
}

function app_oauth_provider(string $provider, bool $requireConfigured = true): array
{
    $provider = strtolower(trim($provider));
    $names = app_oauth_provider_names();
    if (!isset($names[$provider])) app_error(404, '不支持该第三方登录平台。', 'OAUTH_PROVIDER_NOT_FOUND');
    $configured = app_config()['oauth'][$provider] ?? [];
    if (!is_array($configured)) $configured = [];
    $clientId = trim((string) ($configured['client_id'] ?? ''));
    $clientSecret = trim((string) ($configured['client_secret'] ?? ''));
    $callback = trim((string) ($configured['callback_url'] ?? ''));
    $enabled = app_bool($configured['enabled'] ?? false);
    $validClientId = preg_match('/^[\x21-\x7e]{1,191}$/D', $clientId) === 1;
    $validCallback = app_oauth_callback_url_valid($callback, $provider);
    $ready = $enabled && $validClientId && $clientSecret !== '' && $validCallback;
    if ($requireConfigured && !$ready) app_error(503, '该第三方登录方式尚未启用或配置不完整。', 'OAUTH_PROVIDER_UNAVAILABLE');
    return [
        'provider' => $provider,
        'name' => $names[$provider],
        'enabled' => $enabled,
        'configured' => $validClientId && $clientSecret !== '' && $validCallback,
        'ready' => $ready,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'callback_url' => $callback,
    ];
}

function app_oauth_callback_url_valid(string $url, string $provider): bool
{
    if ($url === '' || preg_match('/[\x00-\x20\\\\]/', $url)) return false;
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host']) || !isset($parts['scheme'])
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) return false;
    $scheme = strtolower((string) $parts['scheme']);
    if ($scheme !== 'https' && (!empty(app_config()['app']['production']) || $scheme !== 'http')) return false;
    $siteParts = parse_url((string) (app_config()['app']['site_url'] ?? ''));
    if (!is_array($siteParts) || empty($siteParts['host']) || strcasecmp((string) $siteParts['host'], (string) $parts['host']) !== 0
        || (int) ($siteParts['port'] ?? 0) !== (int) ($parts['port'] ?? 0)) return false;
    $path = rtrim((string) ($parts['path'] ?? ''), '/');
    return $path === '/api/auth/oauth/' . $provider . '/callback';
}

function app_oauth_providers_payload(): array
{
    $providers = [];
    foreach (array_keys(app_oauth_provider_names()) as $provider) {
        $config = app_oauth_provider($provider, false);
        $providers[] = [
            'provider' => $provider,
            'name' => $config['name'],
            'enabled' => (bool) $config['ready'],
            'configured' => (bool) $config['configured'],
        ];
    }
    return ['providers' => $providers];
}

function app_oauth_return_path($value): string
{
    $path = trim((string) $value);
    if ($path === '') return '/';
    if ($path[0] !== '/' || substr($path, 0, 2) === '//' || strpos($path, '\\') !== false
        || preg_match('/[\x00-\x1f\x7f]/', $path) || strlen($path) > 500) {
        app_error(400, '登录完成后的返回地址无效。', 'OAUTH_RETURN_PATH_INVALID');
    }
    $parts = parse_url($path);
    if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host']) || isset($parts['fragment'])) {
        app_error(400, '登录完成后的返回地址无效。', 'OAUTH_RETURN_PATH_INVALID');
    }
    return $path;
}

function app_oauth_session_hash(): string
{
    return hash_hmac('sha256', 'oauth-session|' . session_id(), app_security_secret('oauth-session'), true);
}

function app_oauth_authorize_url(array $provider, string $state, string $challenge): string
{
    $key = $provider['provider'];
    if ($key === 'github') {
        return 'https://github.com/login/oauth/authorize?' . http_build_query([
            'client_id' => $provider['client_id'], 'redirect_uri' => $provider['callback_url'],
            'state' => $state,
            'code_challenge' => $challenge, 'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);
    }
    if ($key === 'qq') {
        return 'https://graph.qq.com/oauth2.0/authorize?' . http_build_query([
            'response_type' => 'code', 'client_id' => $provider['client_id'],
            'redirect_uri' => $provider['callback_url'], 'scope' => 'get_user_info', 'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
    }
    if ($key === 'google') {
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $provider['client_id'], 'redirect_uri' => $provider['callback_url'],
            'response_type' => 'code', 'scope' => 'openid email profile', 'state' => $state,
            'code_challenge' => $challenge, 'code_challenge_method' => 'S256',
            'access_type' => 'online', 'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);
    }
    if ($key === 'microsoft') {
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' . http_build_query([
            'client_id' => $provider['client_id'], 'redirect_uri' => $provider['callback_url'],
            'response_type' => 'code', 'scope' => 'openid profile email User.Read', 'state' => $state,
            'code_challenge' => $challenge, 'code_challenge_method' => 'S256',
            'response_mode' => 'query',
        ], '', '&', PHP_QUERY_RFC3986);
    }
    return 'https://open.weixin.qq.com/connect/qrconnect?' . http_build_query([
        'appid' => $provider['client_id'], 'redirect_uri' => $provider['callback_url'],
        'response_type' => 'code', 'scope' => 'snsapi_login', 'state' => $state,
    ], '', '&', PHP_QUERY_RFC3986) . '#wechat_redirect';
}

function app_oauth_create_transaction(array $provider, string $intent, ?int $userId, string $returnPath): string
{
    $state = app_oauth_base64url(random_bytes(32));
    $stateHash = hash('sha256', $state, true);
    $verifier = app_oauth_base64url(random_bytes(48));
    $challenge = app_oauth_base64url(hash('sha256', $verifier, true));
    $statement = app_db()->prepare('INSERT INTO oauth_transactions (state_hash, session_hash, provider, intent, user_id, return_path, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE))');
    $statement->execute([$stateHash, app_oauth_session_hash(), $provider['provider'], $intent, $userId, $returnPath]);
    $_SESSION['oauth_states'][bin2hex($stateHash)] = ['verifier' => $verifier, 'created' => time()];
    if (random_int(1, 100) === 1) app_db()->exec('DELETE FROM oauth_transactions WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 500');
    return app_oauth_authorize_url($provider, $state, $challenge);
}

function app_oauth_start(string $providerKey): void
{
    app_require_schema_015();
    if (!app_security_peer_rate_limit_allow('oauth-start', 60)) app_error(429, '第三方登录请求过于频繁，请稍后再试。', 'OAUTH_RATE_LIMITED');
    $provider = app_oauth_provider($providerKey);
    $intent = strtolower(trim((string) ($_GET['intent'] ?? 'login')));
    if ($intent !== 'login') app_error(405, '账号绑定必须从账号安全页面发起。', 'OAUTH_BIND_POST_REQUIRED');
    $returnPath = app_oauth_return_path($_GET['return'] ?? '/');
    $url = app_oauth_create_transaction($provider, 'login', null, $returnPath);
    header('Cache-Control: no-store');
    header('Location: ' . $url, true, 302);
    exit;
}

function app_oauth_bind_start(string $providerKey): void
{
    app_require_schema_015();
    app_user_required();
    app_user_csrf_required();
    if (!app_security_peer_rate_limit_allow('oauth-bind-start', 30)) app_error(429, '第三方账号绑定请求过于频繁，请稍后再试。', 'OAUTH_RATE_LIMITED');
    $provider = app_oauth_provider($providerKey);
    $body = app_body();
    $password = (string) ($body['currentPassword'] ?? '');
    $statement = app_db()->prepare('SELECT password_hash FROM user_accounts WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $account = $statement->fetch();
    if (!$account || strlen($password) > 128 || !password_verify($password, (string) $account['password_hash'])) {
        app_error(403, '当前密码不正确，无法绑定。', 'OAUTH_REAUTH_FAILED');
    }
    $returnPath = app_oauth_return_path($body['return'] ?? '/account');
    $url = app_oauth_create_transaction($provider, 'bind', (int) $_SESSION['user_id'], $returnPath);
    app_json(['authorizationUrl' => $url]);
}

function app_oauth_http(string $method, string $url, array $parameters = [], array $headers = []): array
{
    $urlParts = parse_url($url);
    if (!is_array($urlParts) || strtolower((string) ($urlParts['scheme'] ?? '')) !== 'https' || empty($urlParts['host'])) {
        throw new RuntimeException('OAuth provider URL must use HTTPS.');
    }
    if (!function_exists('curl_init')) throw new RuntimeException('OAuth requires the PHP cURL extension.');
    $method = strtoupper($method);
    if ($method === 'GET' && $parameters) $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
    $body = '';
    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => false, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12,
        CURLOPT_USERAGENT => 'PersonalWebsiteOAuth/1.0', CURLOPT_HTTPHEADER => $headers,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > APP_OAUTH_HTTP_MAX_BYTES) return 0;
            $body .= $chunk;
            return strlen($chunk);
        },
    ];
    if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
    if ($method === 'POST') {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
    }
    curl_setopt_array($curl, $options);
    $ok = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($ok === false || $status < 200 || $status >= 300 || $body === '') {
        error_log('OAuth provider request failed: http=' . $status . ($error !== '' ? ' curl=' . $error : ''));
        throw new RuntimeException('OAuth provider request failed.');
    }
    return ['status' => $status, 'body' => $body];
}

function app_oauth_json(string $body): array
{
    $data = json_decode($body, true);
    if (!is_array($data)) throw new RuntimeException('OAuth provider returned an invalid response.');
    return $data;
}

function app_oauth_normalize_remote_identity(array $identity): array
{
    foreach (['subject', 'scope'] as $key) {
        $value = trim((string) ($identity[$key] ?? ''));
        if ($value === '' || strlen($value) > 191 || preg_match('/[^\x21-\x7e]/', $value)) {
            throw new RuntimeException('OAuth identity is missing a valid stable ID.');
        }
        $identity[$key] = $value;
    }
    $union = isset($identity['union']) ? trim((string) $identity['union']) : '';
    if ($union !== '' && (strlen($union) > 191 || preg_match('/[^\x21-\x7e]/', $union))) {
        throw new RuntimeException('OAuth union identity is invalid.');
    }
    $identity['union'] = $union !== '' ? $union : null;
    $name = trim((string) ($identity['displayName'] ?? ''));
    $identity['displayName'] = function_exists('mb_substr') ? mb_substr($name, 0, 255) : substr($name, 0, 255);
    $avatar = trim((string) ($identity['avatarUrl'] ?? ''));
    $avatarParts = $avatar !== '' ? parse_url($avatar) : false;
    if (!is_array($avatarParts) || strtolower((string) ($avatarParts['scheme'] ?? '')) !== 'https' || empty($avatarParts['host']) || strlen($avatar) > 500) {
        $avatar = '';
    }
    $identity['avatarUrl'] = $avatar;
    return $identity;
}

function app_oauth_remote_identity(array $provider, string $code, string $verifier): array
{
    $key = $provider['provider'];
    if ($key === 'github') {
        $tokenResponse = app_oauth_http('POST', 'https://github.com/login/oauth/access_token', [
            'client_id' => $provider['client_id'], 'client_secret' => $provider['client_secret'],
            'code' => $code, 'redirect_uri' => $provider['callback_url'], 'code_verifier' => $verifier,
        ], ['Accept: application/json']);
        $token = app_oauth_json($tokenResponse['body']);
        if (empty($token['access_token']) || !empty($token['error'])) throw new RuntimeException('GitHub denied the OAuth request.');
        $profile = app_oauth_json(app_oauth_http('GET', 'https://api.github.com/user', [], [
            'Accept: application/vnd.github+json', 'Authorization: Bearer ' . $token['access_token'], 'X-GitHub-Api-Version: 2022-11-28',
        ])['body']);
        if (!isset($profile['id']) || !is_numeric($profile['id'])) throw new RuntimeException('GitHub identity is missing a stable ID.');
        return ['subject' => (string) $profile['id'], 'scope' => 'global', 'union' => null,
            'displayName' => (string) (($profile['name'] ?? '') ?: ($profile['login'] ?? '')), 'avatarUrl' => (string) ($profile['avatar_url'] ?? '')];
    }
    if ($key === 'qq') {
        $tokenBody = app_oauth_http('GET', 'https://graph.qq.com/oauth2.0/token', [
            'grant_type' => 'authorization_code', 'client_id' => $provider['client_id'],
            'client_secret' => $provider['client_secret'], 'code' => $code, 'redirect_uri' => $provider['callback_url'],
        ])['body'];
        parse_str($tokenBody, $token);
        if (empty($token['access_token'])) throw new RuntimeException('QQ denied the OAuth request.');
        $meBody = app_oauth_http('GET', 'https://graph.qq.com/oauth2.0/me', ['access_token' => $token['access_token'], 'fmt' => 'json'])['body'];
        $me = json_decode($meBody, true);
        if (!is_array($me)) {
            $meBody = preg_replace('/^callback\s*\(\s*(.*?)\s*\)\s*;?$/s', '$1', trim($meBody));
            $me = json_decode((string) $meBody, true);
        }
        if (!is_array($me) || empty($me['openid'])) throw new RuntimeException('QQ identity is missing a stable ID.');
        $profile = app_oauth_json(app_oauth_http('GET', 'https://graph.qq.com/user/get_user_info', [
            'access_token' => $token['access_token'], 'oauth_consumer_key' => $provider['client_id'], 'openid' => $me['openid'],
        ])['body']);
        return ['subject' => (string) $me['openid'], 'scope' => $provider['client_id'], 'union' => !empty($me['unionid']) ? (string) $me['unionid'] : null,
            'displayName' => (string) ($profile['nickname'] ?? ''), 'avatarUrl' => (string) ($profile['figureurl_qq_2'] ?? ($profile['figureurl_qq_1'] ?? ''))];
    }
    if ($key === 'google') {
        $token = app_oauth_json(app_oauth_http('POST', 'https://oauth2.googleapis.com/token', [
            'client_id' => $provider['client_id'], 'client_secret' => $provider['client_secret'],
            'code' => $code, 'redirect_uri' => $provider['callback_url'],
            'grant_type' => 'authorization_code', 'code_verifier' => $verifier,
        ], ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'])['body']);
        if (empty($token['access_token']) || !empty($token['error'])) throw new RuntimeException('Google denied the OAuth request.');
        $profile = app_oauth_json(app_oauth_http('GET', 'https://openidconnect.googleapis.com/v1/userinfo', [], [
            'Authorization: Bearer ' . $token['access_token'], 'Accept: application/json',
        ])['body']);
        if (empty($profile['sub'])) throw new RuntimeException('Google identity is missing a stable ID.');
        return ['subject' => (string) $profile['sub'], 'scope' => 'global', 'union' => null,
            'displayName' => (string) ($profile['name'] ?? ''), 'avatarUrl' => (string) ($profile['picture'] ?? '')];
    }
    if ($key === 'microsoft') {
        $token = app_oauth_json(app_oauth_http('POST', 'https://login.microsoftonline.com/common/oauth2/v2.0/token', [
            'client_id' => $provider['client_id'], 'client_secret' => $provider['client_secret'],
            'code' => $code, 'redirect_uri' => $provider['callback_url'],
            'grant_type' => 'authorization_code', 'code_verifier' => $verifier,
        ], ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'])['body']);
        if (empty($token['access_token']) || !empty($token['error'])) throw new RuntimeException('Microsoft denied the OAuth request.');
        $profile = app_oauth_json(app_oauth_http('GET', 'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', [], [
            'Authorization: Bearer ' . $token['access_token'], 'Accept: application/json',
        ])['body']);
        if (empty($profile['id'])) throw new RuntimeException('Microsoft identity is missing a stable ID.');
        return ['subject' => (string) $profile['id'], 'scope' => 'graph-common', 'union' => null,
            'displayName' => (string) ($profile['displayName'] ?? ($profile['userPrincipalName'] ?? '')), 'avatarUrl' => ''];
    }
    $token = app_oauth_json(app_oauth_http('GET', 'https://api.weixin.qq.com/sns/oauth2/access_token', [
        'appid' => $provider['client_id'], 'secret' => $provider['client_secret'], 'code' => $code, 'grant_type' => 'authorization_code',
    ])['body']);
    if (empty($token['access_token']) || empty($token['openid']) || !empty($token['errcode'])) throw new RuntimeException('微信拒绝了 OAuth 请求。');
    $profile = app_oauth_json(app_oauth_http('GET', 'https://api.weixin.qq.com/sns/userinfo', [
        'access_token' => $token['access_token'], 'openid' => $token['openid'], 'lang' => 'zh_CN',
    ])['body']);
    return ['subject' => (string) $token['openid'], 'scope' => $provider['client_id'],
        'union' => !empty($profile['unionid']) ? (string) $profile['unionid'] : (!empty($token['unionid']) ? (string) $token['unionid'] : null),
        'displayName' => (string) ($profile['nickname'] ?? ''), 'avatarUrl' => (string) ($profile['headimgurl'] ?? '')];
}

function app_oauth_redirect(string $returnPath, string $provider, bool $success, string $code): void
{
    $context = app_audit_current_context();
    $details = is_array($context['details'] ?? null) ? $context['details'] : [];
    $details['provider'] = $provider;
    $details['resultCode'] = $code;
    app_audit_set_context(['success' => $success, 'message' => $code, 'details' => $details]);
    $separator = strpos($returnPath, '?') === false ? '?' : '&';
    $location = $returnPath . $separator . http_build_query([
        'oauth' => $success ? 'success' : 'error', 'provider' => $provider, 'code' => $code,
    ], '', '&', PHP_QUERY_RFC3986);
    header('Cache-Control: no-store');
    header('Location: ' . $location, true, 303);
    exit;
}

function app_oauth_find_identity(PDO $database, string $provider, array $identity, bool $forUpdate = false): ?array
{
    $lock = $forUpdate ? ' FOR UPDATE' : '';
    if (!empty($identity['union'])) {
        $statement = $database->prepare('SELECT * FROM oauth_identities WHERE provider = ? AND (provider_union_id = ? OR (provider_scope = ? AND provider_subject = ?))' . $lock);
        $statement->execute([$provider, $identity['union'], $identity['scope'], $identity['subject']]);
    } else {
        $statement = $database->prepare('SELECT * FROM oauth_identities WHERE provider = ? AND provider_scope = ? AND provider_subject = ? LIMIT 1' . $lock);
        $statement->execute([$provider, $identity['scope'], $identity['subject']]);
    }
    $rows = $statement->fetchAll();
    if (count($rows) > 1) {
        $owners = array_unique(array_map(static function (array $row): int { return (int) $row['user_id']; }, $rows));
        if (count($owners) > 1) throw new RuntimeException('Conflicting OAuth identity ownership detected.');
    }
    return $rows[0] ?? null;
}

function app_oauth_callback(string $providerKey): void
{
    app_require_schema_015();
    if (!app_security_peer_rate_limit_allow('oauth-callback', 120)) app_error(429, '第三方登录回调请求过于频繁，请稍后再试。', 'OAUTH_RATE_LIMITED');
    $provider = app_oauth_provider($providerKey);
    $state = trim((string) ($_GET['state'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9_-]{43}$/', $state)) app_error(400, 'OAuth state 无效或已过期。', 'OAUTH_STATE_INVALID');
    $stateHash = hash('sha256', $state, true);
    $stateKey = bin2hex($stateHash);
    $sessionState = $_SESSION['oauth_states'][$stateKey] ?? null;
    unset($_SESSION['oauth_states'][$stateKey]);
    $database = app_db();
    $database->beginTransaction();
    try {
        $statement = $database->prepare('SELECT * FROM oauth_transactions WHERE state_hash = ? FOR UPDATE');
        $statement->execute([$stateHash]);
        $transaction = $statement->fetch();
        $valid = $transaction && empty($transaction['used_at']) && strtotime((string) $transaction['expires_at']) >= time()
            && hash_equals((string) $transaction['provider'], $provider['provider'])
            && hash_equals((string) $transaction['session_hash'], app_oauth_session_hash())
            && is_array($sessionState) && !empty($sessionState['verifier']);
        if (!$valid) {
            $database->rollBack();
            app_error(400, 'OAuth state 无效或已过期。', 'OAUTH_STATE_INVALID');
        }
        $database->prepare('UPDATE oauth_transactions SET used_at = NOW() WHERE id = ?')->execute([$transaction['id']]);
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    $returnPath = app_oauth_return_path($transaction['return_path']);
    $intent = (string) $transaction['intent'];
    app_audit_set_context([
        'eventType' => 'authentication',
        'action' => ($intent === 'bind' ? 'BIND_' : 'LOGIN_WITH_') . strtoupper($provider['provider']),
        'details' => ['accountType' => 'user', 'provider' => $provider['provider'], 'intent' => $intent],
    ]);
    if (!empty($_GET['error']) || empty($_GET['code'])) app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_DENIED');
    $code = (string) $_GET['code'];
    if (strlen($code) > 2048) app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_CODE_INVALID');
    if ($intent === 'bind') {
        app_user_required();
        if ((int) $transaction['user_id'] !== (int) $_SESSION['user_id']) app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_BIND_SESSION_CHANGED');
    }
    try {
        $identity = app_oauth_normalize_remote_identity(app_oauth_remote_identity($provider, $code, (string) $sessionState['verifier']));
    } catch (Throwable $error) {
        error_log('OAuth callback failed for ' . $provider['provider'] . ': ' . $error->getMessage());
        app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_PROVIDER_FAILED');
    }
    $database->beginTransaction();
    try {
        $existing = app_oauth_find_identity($database, $provider['provider'], $identity, true);
        if ($intent === 'bind') {
            $userId = (int) $_SESSION['user_id'];
            if ($existing && (int) $existing['user_id'] !== $userId) {
                $database->rollBack();
                app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_IDENTITY_ALREADY_BOUND');
            }
            if ($existing) {
                $database->prepare('UPDATE oauth_identities SET provider_union_id = COALESCE(?, provider_union_id), display_name = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?')
                    ->execute([$identity['union'], $identity['displayName'], $identity['avatarUrl'], $existing['id']]);
            } else {
                try {
                    $database->prepare('INSERT INTO oauth_identities (user_id, provider, provider_scope, provider_subject, provider_union_id, display_name, avatar_url, bound_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())')
                        ->execute([$userId, $provider['provider'], $identity['scope'], $identity['subject'], $identity['union'], $identity['displayName'], $identity['avatarUrl']]);
                } catch (PDOException $error) {
                    if ((int) ($error->errorInfo[1] ?? 0) !== 1062) throw $error;
                    $winner = app_oauth_find_identity($database, $provider['provider'], $identity, true);
                    if (!$winner || (int) $winner['user_id'] !== $userId) {
                        $database->rollBack();
                        app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_IDENTITY_ALREADY_BOUND');
                    }
                }
            }
            $database->commit();
            session_regenerate_id(true);
            app_audit_set_context(['username' => (string) $_SESSION['user_email'], 'adminId' => null, 'action' => 'BIND_' . strtoupper($provider['provider']), 'eventType' => 'authentication']);
            app_audit_set_details(['accountType' => 'user', 'provider' => $provider['provider'], 'userId' => $userId]);
            app_oauth_redirect($returnPath, $provider['provider'], true, 'OAUTH_BOUND');
        }
        if (!$existing) {
            $database->rollBack();
            app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_NOT_BOUND');
        }
        $userStatement = $database->prepare('SELECT * FROM user_accounts WHERE id = ? FOR UPDATE');
        $userStatement->execute([$existing['user_id']]);
        $user = $userStatement->fetch();
        $unavailable = !$user || !empty($user['disabled_at']) || (!empty($user['locked_until']) && strtotime((string) $user['locked_until']) > time());
        if ($unavailable) {
            $database->rollBack();
            app_oauth_redirect($returnPath, $provider['provider'], false, 'OAUTH_ACCOUNT_UNAVAILABLE');
        }
        $database->prepare('UPDATE oauth_identities SET provider_union_id = COALESCE(?, provider_union_id), display_name = ?, avatar_url = ?, last_login_at = NOW(), updated_at = NOW() WHERE id = ?')
            ->execute([$identity['union'], $identity['displayName'], $identity['avatarUrl'], $existing['id']]);
        $database->prepare('UPDATE user_accounts SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?')->execute([$user['id']]);
        $database->commit();
        app_user_start_session((int) $user['id'], (string) $user['email'], (int) $user['session_version']);
        app_audit_set_context(['username' => (string) $user['email'], 'adminId' => null, 'action' => 'LOGIN_WITH_' . strtoupper($provider['provider']), 'eventType' => 'authentication']);
        app_audit_set_details(['accountType' => 'user', 'provider' => $provider['provider'], 'userId' => (int) $user['id']]);
        app_oauth_redirect($returnPath, $provider['provider'], true, 'OAUTH_LOGGED_IN');
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
}

function app_oauth_identity_row(array $row): array
{
    return [
        'provider' => (string) $row['provider'],
        'displayName' => (string) ($row['display_name'] ?? ''),
        'avatarUrl' => (string) ($row['avatar_url'] ?? ''),
        'boundAt' => app_now_iso($row['bound_at'] ?? null),
        'lastLoginAt' => app_now_iso($row['last_login_at'] ?? null),
    ];
}

function app_oauth_identities_payload(): array
{
    app_require_schema_015();
    app_user_required();
    $statement = app_db()->prepare('SELECT provider, display_name, avatar_url, bound_at, last_login_at FROM oauth_identities WHERE user_id = ? ORDER BY provider');
    $statement->execute([(int) $_SESSION['user_id']]);
    return ['email' => (string) $_SESSION['user_email'], 'identities' => array_map('app_oauth_identity_row', $statement->fetchAll())];
}

function app_oauth_user_has_identity(int $userId): bool
{
    $statement = app_db()->prepare('SELECT 1 FROM oauth_identities WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    return (bool) $statement->fetchColumn();
}

function app_oauth_unbind(string $providerKey): void
{
    app_require_schema_015();
    app_user_required();
    app_user_csrf_required();
    $provider = app_oauth_provider($providerKey, false);
    $body = app_body();
    $password = (string) ($body['currentPassword'] ?? '');
    $database = app_db();
    $database->beginTransaction();
    try {
        $user = $database->prepare('SELECT password_hash FROM user_accounts WHERE id = ? FOR UPDATE');
        $user->execute([(int) $_SESSION['user_id']]);
        $account = $user->fetch();
        if (!$account || strlen($password) > 128 || !password_verify($password, (string) $account['password_hash'])) {
            $database->rollBack();
            app_error(403, '当前密码不正确，无法解绑。', 'OAUTH_REAUTH_FAILED');
        }
        $statement = $database->prepare('DELETE FROM oauth_identities WHERE user_id = ? AND provider = ?');
        $statement->execute([(int) $_SESSION['user_id'], $provider['provider']]);
        if ($statement->rowCount() < 1) {
            $database->rollBack();
            app_error(404, '该第三方账号尚未绑定。', 'OAUTH_IDENTITY_NOT_BOUND');
        }
        $database->commit();
    } catch (Throwable $error) {
        if ($database->inTransaction()) $database->rollBack();
        throw $error;
    }
    session_regenerate_id(true);
    app_audit_set_context(['username' => (string) $_SESSION['user_email'], 'adminId' => null, 'action' => 'UNBIND_' . strtoupper($provider['provider']), 'eventType' => 'authentication']);
    app_audit_set_details(['accountType' => 'user', 'provider' => $provider['provider'], 'userId' => (int) $_SESSION['user_id']]);
    app_json(['success' => true]);
}
