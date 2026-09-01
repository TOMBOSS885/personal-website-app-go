<?php

declare(strict_types=1);

const APP_ARTICLE_SITE_DIR = 'article-sites';
const APP_ARTICLE_SITE_COMPAT_JS_PREFIX = 'omblog-compat-';
const APP_ARTICLE_SITE_RESIZE_JS = 'omblog-resize.js';

function app_article_site_upload(): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('主机未启用 PHP Zip 扩展，请在主机面板启用 ZipArchive');
    }
    if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
        throw new InvalidArgumentException('请选择 ZIP 静态前端包');
    }

    $file = $_FILES['file'];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new InvalidArgumentException('ZIP 超过主机 PHP 的 upload_max_filesize 或 post_max_size 限制');
        }
        throw new InvalidArgumentException('ZIP 上传失败，请重新选择文件');
    }
    $temporary = (string) ($file['tmp_name'] ?? '');
    if ($temporary === '' || !is_uploaded_file($temporary)) {
        throw new InvalidArgumentException('无法读取上传的 ZIP 文件');
    }
    $originalName = basename(str_replace('\\', '/', (string) ($file['name'] ?? 'static-site.zip')));
    if (strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) !== 'zip') {
        throw new InvalidArgumentException('静态前端必须上传 ZIP 文件');
    }

    $settings = app_upload_settings();
    $zipLimit = max(1, (int) ($settings['articleSiteZipMaxMB'] ?? 12)) * 1024 * 1024;
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > $zipLimit) {
        throw new InvalidArgumentException('静态前端 ZIP 超过后台设置的上传限制');
    }

    $zip = new ZipArchive();
    $opened = $zip->open($temporary, ZipArchive::CHECKCONS);
    if ($opened !== true) {
        throw new InvalidArgumentException('ZIP 文件损坏或格式不正确');
    }

    $key = bin2hex(random_bytes(24));
    $root = app_article_site_root();
    $stage = $root . DIRECTORY_SEPARATOR . '.tmp-' . $key;
    $target = $root . DIRECTORY_SEPARATOR . $key;
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        $zip->close();
        throw new RuntimeException('无法创建静态前端存储目录');
    }
    if (!mkdir($stage, 0755, true) && !is_dir($stage)) {
        $zip->close();
        throw new RuntimeException('无法创建静态前端临时目录');
    }

    try {
        $prefix = app_article_site_root_prefix($zip);
        [$count, $total] = app_article_site_extract(
            $zip,
            $prefix,
            $stage,
            max(10, (int) ($settings['articleSiteFileCount'] ?? 400)),
            max(5, (int) ($settings['articleSiteTotalMB'] ?? 40)) * 1024 * 1024
        );
        if (!is_file($stage . DIRECTORY_SEPARATOR . 'index.html')) {
            throw new InvalidArgumentException('ZIP 中必须包含 index.html');
        }
        if (!@rename($stage, $target)) {
            throw new RuntimeException('保存静态前端失败，请检查 uploads 写入权限');
        }
        $stage = '';
    } finally {
        $zip->close();
        if ($stage !== '' && is_dir($stage)) app_article_site_remove_tree($stage);
    }

    @chmod($target, 0755);
    app_article_site_cleanup_orphans();
    return ['siteKey' => $key, 'name' => $originalName, 'fileCount' => $count, 'totalSize' => $total];
}

function app_article_site_root_prefix(ZipArchive $zip): string
{
    $candidates = [];
    for ($index = 0; $index < $zip->numFiles; $index++) {
        $stat = $zip->statIndex($index);
        if (!is_array($stat)) continue;
        $name = app_article_site_normalize_zip_name((string) ($stat['name'] ?? ''));
        if (app_article_site_ignored_entry($name)) continue;
        if (strtolower($name) === 'index.html') return '';
        if (strlen($name) > 11 && strtolower(substr($name, -11)) === '/index.html') {
            $candidates[] = substr($name, 0, -10);
        }
    }
    $candidates = array_values(array_unique($candidates));
    if (count($candidates) !== 1) {
        throw new InvalidArgumentException('ZIP 根目录必须包含 index.html，或只包含一个带 index.html 的项目目录');
    }
    return $candidates[0];
}

function app_article_site_extract(ZipArchive $zip, string $prefix, string $stage, int $maxFiles, int $maxTotal): array
{
    $count = 0;
    $total = 0;
    $seen = [];
    for ($index = 0; $index < $zip->numFiles; $index++) {
        $stat = $zip->statIndex($index);
        if (!is_array($stat)) continue;
        $rawName = (string) ($stat['name'] ?? '');
        $name = app_article_site_normalize_zip_name($rawName);
        if ($name === '' || app_article_site_ignored_entry($name)) continue;
        if ($prefix !== '' && substr($name, 0, strlen($prefix)) !== $prefix) continue;
        if ($prefix !== '') $name = substr($name, strlen($prefix));
        $name = ltrim($name, '/');
        if ($name === '') continue;

        $directoryEntry = substr($name, -1) === '/';
        $cleaned = app_article_site_clean_path($name);
        if ($cleaned === null) throw new InvalidArgumentException('ZIP 包含不安全路径或隐藏目录');
        if (isset($seen[strtolower($cleaned)])) throw new InvalidArgumentException('ZIP 包含重复文件路径');

        $attributes = 0;
        $operatingSystem = 0;
        if (method_exists($zip, 'getExternalAttributesIndex')) {
            $zip->getExternalAttributesIndex($index, $operatingSystem, $attributes);
            if (((int) $attributes >> 16 & 0170000) === 0120000) {
                throw new InvalidArgumentException('ZIP 不允许包含软链接');
            }
        }

        $target = app_article_site_target($stage, $cleaned);
        if ($directoryEntry) {
            if (!is_dir($target) && !mkdir($target, 0755, true) && !is_dir($target)) {
                throw new RuntimeException('创建静态前端目录失败');
            }
            continue;
        }

        $extension = strtolower(pathinfo($cleaned, PATHINFO_EXTENSION));
        if (!isset(app_article_site_allowed_extensions()[$extension])) {
            throw new InvalidArgumentException('不支持静态文件类型：.' . ($extension ?: '(无扩展名)'));
        }
        $declaredSize = max(0, (int) ($stat['size'] ?? 0));
        if (++$count > $maxFiles) throw new InvalidArgumentException('静态前端文件数量超过限制');
        if ($declaredSize > $maxTotal - $total) throw new InvalidArgumentException('静态前端解压总大小超过限制');

        $parent = dirname($target);
        if (!is_dir($parent) && !mkdir($parent, 0755, true) && !is_dir($parent)) {
            throw new RuntimeException('创建静态前端目录失败');
        }
        $source = $zip->getStream($rawName);
        if (!is_resource($source)) throw new InvalidArgumentException('无法读取 ZIP 内文件：' . $cleaned);
        $destination = @fopen($target, 'wb');
        if (!is_resource($destination)) {
            fclose($source);
            throw new RuntimeException('无法写入静态前端文件');
        }

        $written = 0;
        try {
            while (!feof($source)) {
                $chunk = fread($source, 65536);
                if ($chunk === false) throw new InvalidArgumentException('读取 ZIP 内容失败');
                if ($chunk === '') continue;
                $length = strlen($chunk);
                if ($total + $written + $length > $maxTotal) {
                    throw new InvalidArgumentException('静态前端解压后超过大小限制');
                }
                if (fwrite($destination, $chunk) !== $length) throw new RuntimeException('写入静态前端文件失败');
                $written += $length;
            }
        } finally {
            fclose($destination);
            fclose($source);
        }
        $total += $written;
        $seen[strtolower($cleaned)] = true;
        @chmod($target, 0644);
    }
    return [$count, $total];
}

function app_article_site_signed_url(array $article): string
{
    if (($article['content_type'] ?? 'markdown') !== 'static') return '';
    $id = (int) ($article['id'] ?? 0);
    $key = (string) ($article['static_site_key'] ?? '');
    if ($id <= 0 || !app_article_site_valid_key($key)) return '';
    $ttl = !empty($article['is_locked']) ? 600 : 3600;
    $configured = app_clamp((int) (app_config()['app']['article_site_url_ttl_seconds'] ?? $ttl), 300, 86400);
    $ttl = !empty($article['is_locked']) ? min($configured, 600) : $configured;
    $expires = time() + $ttl;
    $expires += (300 - ($expires % 300)) % 300;
    $version = app_article_site_version($article);
    $signature = app_article_site_signature($id, $key, $version, $expires);
    return sprintf('/api/public/article-sites/%d/%s/%d/%d/%s/index.html', $id, $key, $version, $expires, $signature);
}

function app_article_site_serve(int $id, string $key, int $version, int $expires, string $signature, string $requested): void
{
    if (function_exists('app_require_schema_014')) app_require_schema_014();
    elseif (function_exists('app_require_schema_013')) app_require_schema_013();
    // Static article assets are a separate route from /public/articles/{id};
    // start the same session here so login-gated articles cannot be reached
    // with an otherwise valid (or previously issued) signed URL.
    app_start_session();
    if ($id <= 0 || !app_article_site_valid_key($key) || $version <= 0 || $expires < time()) {
        app_error(403, '静态前端链接无效或已过期', 'ARTICLE_SITE_LINK_EXPIRED');
    }
    $expected = app_article_site_signature($id, $key, $version, $expires);
    if (!preg_match('/^[a-f0-9]{64}$/', $signature) || !hash_equals($expected, $signature)) {
        app_error(403, '静态前端签名无效', 'ARTICLE_SITE_SIGNATURE_INVALID');
    }

    $statement = app_db()->prepare('SELECT id, published, content_type, static_site_key, is_locked, login_required, access_password_hash, updated_at FROM articles WHERE id = ?');
    $statement->execute([$id]);
    $article = $statement->fetch();
    $currentVersion = $article ? app_article_site_version($article) : 0;
    if (!$article || !(bool) $article['published'] || $article['content_type'] !== 'static'
        || !hash_equals((string) $article['static_site_key'], $key) || $currentVersion !== $version) {
        app_error(404, '静态前端不存在', 'NOT_FOUND');
    }
    $loginGated = !empty($article['login_required']);
    if ($loginGated) {
        if (!empty($_SESSION['user_id'])) app_user_required();
        elseif (!empty($_SESSION['admin_id'])) app_admin_required();
    }
    if ($loginGated && empty($_SESSION['user_id']) && empty($_SESSION['admin_id'])) {
        header('Cache-Control: no-store');
        app_error(401, '请先登录后再查看文章', 'USER_UNAUTHENTICATED');
    }

    // A signed URL is not a substitute for the article's independent access
    // password. Re-check the unlock token here because this endpoint serves
    // the actual static HTML/assets and can be called directly.
    if (!empty($article['is_locked'])) {
        $unlockValue = $_SESSION['article_unlocks'][$id] ?? '';
        $unlocked = is_string($unlockValue)
            && function_exists('app_article_unlock_token')
            && hash_equals(app_article_unlock_token($article), $unlockValue);
        if (!$unlocked) {
            header('Cache-Control: no-store');
            app_error(403, '请先输入文章访问密码', 'ARTICLE_PASSWORD_REQUIRED');
        }
    }

    $path = $requested === '' ? 'index.html' : rawurldecode($requested);
    $cleaned = app_article_site_clean_path($path);
    if ($cleaned === null) app_error(404, '静态资源不存在', 'NOT_FOUND');
    $root = app_article_site_root() . DIRECTORY_SEPARATOR . $key;
    if ($cleaned === APP_ARTICLE_SITE_RESIZE_JS) {
        app_article_site_headers($expires, $loginGated);
        app_article_site_send_js(app_article_site_resize_bridge_js());
    }
    if (preg_match('/^' . preg_quote(APP_ARTICLE_SITE_COMPAT_JS_PREFIX, '/') . '(\d+)\.js$/', $cleaned, $match)) {
        app_article_site_headers($expires, $loginGated);
        app_article_site_send_compat_js($root . DIRECTORY_SEPARATOR . 'index.html', (int) $match[1]);
    }
    $target = app_article_site_target($root, $cleaned);
    if (is_dir($target)) $target .= DIRECTORY_SEPARATOR . 'index.html';
    if (!is_file($target)) {
        if (pathinfo($cleaned, PATHINFO_EXTENSION) === '') $target = $root . DIRECTORY_SEPARATOR . 'index.html';
        else app_error(404, '静态资源不存在', 'NOT_FOUND');
    }

    app_article_site_headers($expires, $loginGated);
    $extension = strtolower(pathinfo($target, PATHINFO_EXTENSION));
    if (in_array($extension, ['html', 'htm'], true)) {
        app_article_site_send_html($target, app_article_site_base_url($id, $key, $version, $expires, $signature));
    }
    app_article_site_send_file($target, $extension);
}

function app_article_site_send_html(string $target, string $baseUrl): void
{
    $html = file_get_contents($target);
    if ($html === false) app_error(404, '静态页面不可用', 'NOT_FOUND');
    if (stripos($html, '<base ') === false) {
        $base = '<base href="' . htmlspecialchars($baseUrl, ENT_QUOTES, 'UTF-8') . '">';
        $head = stripos($html, '<head>');
        $html = $head === false ? $base . $html : substr($html, 0, $head + 6) . $base . substr($html, $head + 6);
    }
    $html = app_article_site_compat_html($html);
    $resizeTag = '<script src="' . htmlspecialchars(APP_ARTICLE_SITE_RESIZE_JS, ENT_QUOTES, 'UTF-8') . '" defer></script>';
    $bodyEnd = strripos($html, '</body>');
    $html = $bodyEnd === false ? $html . $resizeTag : substr($html, 0, $bodyEnd) . $resizeTag . substr($html, $bodyEnd);
    header('Content-Type: text/html; charset=utf-8');
    header("Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads allow-presentation; default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https:");
    header('Content-Length: ' . strlen($html));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $html;
    exit;
}

function app_article_site_compat_html(string $html): string
{
    return app_article_site_compat_rewrite($html)[0];
}

function app_article_site_compat_scripts(string $html): array
{
    return app_article_site_compat_rewrite($html)[1];
}

function app_article_site_compat_rewrite(string $html): array
{
    $length = strlen($html);
    $offset = 0;
    $out = '';
    $scripts = [];
    while ($offset < $length) {
        $scriptStart = stripos($html, '<script', $offset);
        $linkStart = stripos($html, '<link', $offset);
        $start = app_article_site_earliest_tag($scriptStart, $linkStart);
        if ($start === false) {
            $out .= substr($html, $offset);
            break;
        }

        $isScript = $scriptStart === $start;
        $tagName = $isScript ? 'script' : 'link';
        $nameLength = strlen($tagName);
        $afterName = $start + 1 + $nameLength;
        if ($afterName < $length) {
            $ch = $html[$afterName];
            if ($ch !== '>' && $ch !== '/' && $ch !== ' ' && $ch !== "\t" && $ch !== "\n" && $ch !== "\r") {
                $out .= substr($html, $offset, $afterName - $offset);
                $offset = $afterName;
                continue;
            }
        }

        $tagEnd = strpos($html, '>', $start);
        if ($tagEnd === false) {
            $out .= substr($html, $offset);
            break;
        }

        $out .= substr($html, $offset, $start - $offset);
        $attrs = substr($html, $start + 1 + $nameLength, $tagEnd - ($start + 1 + $nameLength));

        if (!$isScript) {
            $out .= '<link' . app_article_site_strip_crossorigin($attrs) . '>';
            $offset = $tagEnd + 1;
            continue;
        }

        $close = stripos($html, '</script>', $tagEnd);
        if ($close === false) {
            $out .= substr($html, $start);
            break;
        }
        $body = substr($html, $tagEnd + 1, $close - ($tagEnd + 1));
        $full = substr($html, $start, $close + 9 - $start);
        [$rewritten, $extracted] = app_article_site_compat_script($attrs, $body, $full, count($scripts));
        if ($extracted !== null) $scripts[] = $extracted;
        $out .= $rewritten;
        $offset = $close + 9;
    }

    return [$out, $scripts];
}

function app_article_site_earliest_tag($first, $second)
{
    if ($first === false) return $second;
    if ($second === false) return $first;
    return $first <= $second ? $first : $second;
}

function app_article_site_compat_script(string $attrs, string $body, string $full, int $index): array
{
    $isModule = (bool) preg_match('/\btype\s*=\s*(?:(["\'])module\1|module(?![\w-]))/i', $attrs);
    if ($isModule && preg_match('/\bnomodule\b/i', $attrs)) {
        return [$full, null];
    }
    if ($isModule && app_article_site_script_needs_module($body)) {
        return [$full, null];
    }

    if ($isModule) {
        $attrs = preg_replace('/\s*\btype\s*=\s*(?:(["\'])module\1|module(?![\w-]))/i', '', $attrs) ?? $attrs;
    }
    $attrs = app_article_site_strip_crossorigin($attrs);
    $hasSrc = (bool) preg_match('/\bsrc\s*=/i', $attrs);
    if ($hasSrc) {
        if ($isModule && !preg_match('/\b(?:defer|async)\b/i', $attrs)) $attrs .= ' defer';
        $attrs = trim(preg_replace('/\s+/', ' ', $attrs) ?? $attrs);
        $html = $attrs === '' ? '<script>' . $body . '</script>' : '<script ' . $attrs . '>' . $body . '</script>';
        return [$html, null];
    }
    if (trim($body) === '') return [$full, null];

    $src = APP_ARTICLE_SITE_COMPAT_JS_PREFIX . $index . '.js';
    return ['<script src="' . htmlspecialchars($src, ENT_QUOTES, 'UTF-8') . '" defer></script>', $body];
}

function app_article_site_script_needs_module(string $body): bool
{
    if (strpos($body, 'import.meta') !== false) return true;
    if (strpos($body, 'import') !== false
        && preg_match('/(?:^|[;{}\(\[\s])import\s*(?:\(|[*\w{\'"])/', $body)) {
        return true;
    }
    if (strpos($body, 'export') !== false
        && preg_match('/(?:^|[;{}\(\[\s])export\s+(?:default|async|function|class|const|let|var|enum|type|\{|\*)/', $body)) {
        return true;
    }
    return false;
}

function app_article_site_strip_crossorigin(string $attrs): string
{
    $attrs = preg_replace('/\s*\bcrossorigin(?:\s*=\s*(["\']?)[^"\'\s>]*\1)?/i', '', $attrs) ?? $attrs;
    return rtrim($attrs);
}

function app_article_site_send_compat_js(string $htmlPath, int $index): void
{
    $html = @file_get_contents($htmlPath);
    if ($html === false) app_error(404, '静态页面不可用', 'NOT_FOUND');
    $scripts = app_article_site_compat_scripts($html);
    if (!isset($scripts[$index])) app_error(404, '静态资源不存在', 'NOT_FOUND');
    app_article_site_send_js($scripts[$index]);
}

function app_article_site_send_js(string $javascript): void
{
    header('Content-Type: application/javascript; charset=utf-8');
    header('Content-Length: ' . strlen($javascript));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $javascript;
    exit;
}

function app_article_site_resize_bridge_js(): string
{
    return <<<'JS'
(function () {
  if (window.parent === window || window.__OMBLOG_STATIC_RESIZE__) return;
  window.__OMBLOG_STATIC_RESIZE__ = true;
  var messageType = 'omblog:static-site-size';
  var lastHeight = 0;
  var lastWidth = window.innerWidth;
  var frame = 0;

  function measure() {
    frame = 0;
    var root = document.documentElement;
    var body = document.body;
    var height = Math.ceil(Math.max(
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    ));
    if (!Number.isFinite(height) || height < 1 || height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ type: messageType, height: height }, '*');
  }

  function scheduleMeasure() {
    if (frame) return;
    frame = window.requestAnimationFrame(measure);
  }

  window.addEventListener('load', scheduleMeasure);
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    scheduleMeasure();
  }, { passive: true });
  document.addEventListener('load', scheduleMeasure, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleMeasure, { once: true });
  } else {
    scheduleMeasure();
  }

  if ('MutationObserver' in window) {
    new MutationObserver(scheduleMeasure).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open'],
      characterData: true
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
  window.setTimeout(scheduleMeasure, 250);
  window.setTimeout(scheduleMeasure, 1000);
})();
JS;
}

function app_article_site_send_file(string $target, string $extension): void
{
    $types = app_article_site_mime_types();
    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Accept-Ranges: bytes');
    $size = filesize($target);
    if ($size === false) app_error(404, '静态资源不存在', 'NOT_FOUND');
    $start = 0;
    $end = max(0, $size - 1);
    $range = (string) ($_SERVER['HTTP_RANGE'] ?? '');
    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match)) {
        if ($match[1] === '' && $match[2] !== '') {
            $length = min($size, (int) $match[2]);
            $start = max(0, $size - $length);
        } else {
            $start = (int) $match[1];
            if ($match[2] !== '') $end = min($end, (int) $match[2]);
        }
        if ($start > $end || $start >= $size) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            exit;
        }
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
    }
    $length = $size === 0 ? 0 : $end - $start + 1;
    header('Content-Length: ' . $length);
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD' || $length === 0) exit;
    $stream = fopen($target, 'rb');
    if (!is_resource($stream)) app_error(404, '静态资源不存在', 'NOT_FOUND');
    fseek($stream, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($stream)) {
        $chunk = fread($stream, min(65536, $remaining));
        if ($chunk === false) break;
        echo $chunk;
        $remaining -= strlen($chunk);
    }
    fclose($stream);
    exit;
}

function app_article_site_headers(int $expires, bool $noStore = false): void
{
    $remaining = max(0, min(3600, $expires - time()));
    header('Cache-Control: ' . ($noStore ? 'no-store' : 'private, max-age=' . $remaining));
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
}

function app_article_site_version(array $article): int
{
    $value = implode('|', [
        (string) ($article['updated_at'] ?? ''),
        (string) ($article['static_site_key'] ?? ''),
        !empty($article['published']) ? '1' : '0',
        !empty($article['is_locked']) ? '1' : '0',
        (string) ($article['access_password_hash'] ?? ''),
    ]);
    return max(1, (int) hexdec(substr(hash('sha256', $value), 0, 12)));
}

function app_article_site_signature(int $id, string $key, int $version, int $expires): string
{
    $payload = implode('|', ['article-site', $id, $key, $version, $expires, app_article_site_client_ip()]);
    return hash_hmac('sha256', $payload, app_article_site_signing_key());
}

function app_article_site_signing_key(): string
{
    $config = app_config();
    $app = $config['app'] ?? [];
    $key = (string) ($app['article_site_signing_key'] ?? $app['setup_key'] ?? '');
    if (strlen($key) >= 32 && $key !== 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING') return $key;
    $database = $config['database'] ?? [];
    return hash('sha256', json_encode($database, JSON_UNESCAPED_SLASHES) . '|' . $key);
}

function app_article_site_client_ip(): string
{
    $cloudflare = trim((string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));
    if ($cloudflare !== '' && filter_var($cloudflare, FILTER_VALIDATE_IP)) return $cloudflare;
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : '0.0.0.0';
}

function app_article_site_base_url(int $id, string $key, int $version, int $expires, string $signature): string
{
    return sprintf('/api/public/article-sites/%d/%s/%d/%d/%s/', $id, $key, $version, $expires, $signature);
}

function app_article_site_exists(string $key): bool
{
    return app_article_site_valid_key($key)
        && is_file(app_article_site_root() . DIRECTORY_SEPARATOR . $key . DIRECTORY_SEPARATOR . 'index.html');
}

function app_article_site_delete(string $key): bool
{
    if (!app_article_site_valid_key($key)) return false;
    $target = app_article_site_root() . DIRECTORY_SEPARATOR . $key;
    if (!is_dir($target)) return false;
    app_article_site_remove_tree($target);
    return !is_dir($target);
}

function app_article_site_delete_if_unreferenced(string $key): void
{
    if (!app_article_site_valid_key($key)) return;
    $statement = app_db()->prepare('SELECT COUNT(*) FROM articles WHERE static_site_key = ?');
    $statement->execute([$key]);
    if ((int) $statement->fetchColumn() === 0) app_article_site_delete($key);
}

function app_article_site_cleanup_orphans(): void
{
    $root = app_article_site_root();
    if (!is_dir($root)) return;
    $referenced = [];
    try {
        foreach (app_db()->query("SELECT static_site_key FROM articles WHERE static_site_key IS NOT NULL AND static_site_key <> ''")->fetchAll(PDO::FETCH_COLUMN) as $key) {
            $referenced[(string) $key] = true;
        }
    } catch (Throwable $error) {
        return;
    }
    $cutoff = time() - 86400;
    foreach (new DirectoryIterator($root) as $entry) {
        if ($entry->isDot() || !$entry->isDir()) continue;
        $name = $entry->getFilename();
        if ((substr($name, 0, 5) === '.tmp-' || app_article_site_valid_key($name))
            && !isset($referenced[$name]) && $entry->getMTime() < $cutoff) {
            app_article_site_remove_tree($entry->getPathname());
        }
    }
}

function app_article_site_remove_tree(string $root): void
{
    if (!is_dir($root)) return;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isDir() && !$entry->isLink()) @rmdir($entry->getPathname());
        else @unlink($entry->getPathname());
    }
    @rmdir($root);
}

function app_article_site_root(): string
{
    return rtrim((string) app_config()['app']['upload_dir'], '/\\') . DIRECTORY_SEPARATOR . APP_ARTICLE_SITE_DIR;
}

function app_article_site_target(string $root, string $relative): string
{
    $cleaned = app_article_site_clean_path($relative);
    if ($cleaned === null) throw new InvalidArgumentException('静态前端路径无效');
    return rtrim($root, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $cleaned);
}

function app_article_site_clean_path(string $value): ?string
{
    $value = str_replace('\\', '/', $value);
    $value = preg_replace('#^\./+#', '', $value) ?? $value;
    if ($value === '' || strpos($value, "\0") !== false || substr($value, 0, 1) === '/'
        || preg_match('/^[a-z]:/i', $value)) return null;
    $parts = [];
    foreach (explode('/', $value) as $part) {
        if ($part === '' || $part === '.') continue;
        if ($part === '..' || substr($part, 0, 1) === '.') return null;
        $parts[] = $part;
    }
    return $parts ? implode('/', $parts) : null;
}

function app_article_site_normalize_zip_name(string $name): string
{
    return preg_replace('#^\./+#', '', str_replace('\\', '/', $name)) ?? $name;
}

function app_article_site_ignored_entry(string $name): bool
{
    $lower = strtolower($name);
    return substr($lower, 0, 9) === '__macosx/' || $lower === '.ds_store' || substr($lower, -10) === '/.ds_store';
}

function app_article_site_valid_key(string $key): bool
{
    return (bool) preg_match('/^(?:[a-f0-9]{48}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i', $key);
}

function app_article_site_allowed_extensions(): array
{
    static $allowed;
    if ($allowed !== null) return $allowed;
    $extensions = [
        'html','htm','css','js','mjs','json','map','txt','xml','webmanifest','csv','yaml','yml','pdf',
        'png','jpg','jpeg','gif','webp','avif','svg','ico','cur','woff','woff2','ttf','otf','eot',
        'mp3','wav','ogg','m4a','aac','mp4','webm','mov','vtt','srt','wasm','gltf','glb','bin',
    ];
    $allowed = array_fill_keys($extensions, true);
    return $allowed;
}

function app_article_site_mime_types(): array
{
    return [
        'html'=>'text/html; charset=utf-8','htm'=>'text/html; charset=utf-8','css'=>'text/css; charset=utf-8',
        'js'=>'application/javascript; charset=utf-8','mjs'=>'application/javascript; charset=utf-8','json'=>'application/json; charset=utf-8',
        'map'=>'application/json; charset=utf-8','txt'=>'text/plain; charset=utf-8','xml'=>'application/xml','webmanifest'=>'application/manifest+json',
        'csv'=>'text/csv; charset=utf-8','yaml'=>'text/yaml; charset=utf-8','yml'=>'text/yaml; charset=utf-8','pdf'=>'application/pdf',
        'png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','webp'=>'image/webp','avif'=>'image/avif','svg'=>'image/svg+xml','ico'=>'image/x-icon','cur'=>'image/x-icon',
        'woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf','otf'=>'font/otf','eot'=>'application/vnd.ms-fontobject',
        'mp3'=>'audio/mpeg','wav'=>'audio/wav','ogg'=>'audio/ogg','m4a'=>'audio/mp4','aac'=>'audio/aac',
        'mp4'=>'video/mp4','webm'=>'video/webm','mov'=>'video/quicktime','vtt'=>'text/vtt','srt'=>'application/x-subrip',
        'wasm'=>'application/wasm','gltf'=>'model/gltf+json','glb'=>'model/gltf-binary','bin'=>'application/octet-stream',
    ];
}
