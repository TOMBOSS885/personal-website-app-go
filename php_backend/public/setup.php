<?php

$root = is_dir(__DIR__ . '/app') ? __DIR__ : dirname(__DIR__);
require $root . '/app/bootstrap.php';

$config = app_config();
$expectedKey = (string) ($config['app']['setup_key'] ?? '');
$providedKey = (string) ($_GET['key'] ?? $_POST['key'] ?? '');
if ($expectedKey === '' || $expectedKey === 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING' || !hash_equals($expectedKey, $providedKey)) {
    http_response_code(403);
    exit('Invalid setup key. Edit config/config.php first.');
}

$count = (int) app_db()->query('SELECT COUNT(*) FROM admin_account')->fetchColumn();
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $count === 0) {
    $username = trim((string) ($_POST['username'] ?? 'admin'));
    $password = (string) ($_POST['password'] ?? '');
    if ($username === '' || strlen($password) < 10) {
        $message = '用户名不能为空，密码至少 10 位。';
    } else {
        $statement = app_db()->prepare('INSERT INTO admin_account (username, password_hash, created_at, updated_at) VALUES (?, ?, NOW(), NOW())');
        $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
        app_site_settings_ensure();
        $bootstrapSuffix = app_admin_entry_bootstrap_suffix();
        $statement = app_db()->prepare('UPDATE site_settings SET admin_path_suffix = ?, updated_at = NOW() WHERE id = 1');
        $statement->execute([$bootstrapSuffix]);
        $count = 1;
        $message = '管理员已创建。现在请删除 setup.php，然后访问 /admin/login。';
    }
}
if (isset($bootstrapSuffix)) {
    $message = '管理员已创建。请删除 setup.php，然后访问 /' . $bootstrapSuffix . '/login。';
}
?><!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>初始化管理员</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#172033}form{display:grid;gap:16px;padding:24px;border:1px solid #ddd;border-radius:8px}input,button{font:inherit;padding:12px;border:1px solid #bbb;border-radius:6px}button{background:#4f46e5;color:white;border:0}.msg{padding:12px;background:#eef2ff;border-radius:6px}</style></head><body>
<h1>初始化唯一管理员</h1>
<?php if ($message !== ''): ?><p class="msg"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
<?php if ($count > 0): ?><p>管理员已经存在。为安全起见，请立即从主机删除 <code>setup.php</code>。</p><?php else: ?>
<form method="post"><input type="hidden" name="key" value="<?= htmlspecialchars($providedKey, ENT_QUOTES, 'UTF-8') ?>"><label>用户名<br><input name="username" value="admin" required></label><label>密码（至少 10 位）<br><input type="password" name="password" minlength="10" required></label><button type="submit">创建管理员</button></form>
<?php endif; ?></body></html>
