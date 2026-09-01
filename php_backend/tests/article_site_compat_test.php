<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/article_sites.php';

function assert_true(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$inline = <<<'HTML'
<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="./style.css">
<script type="module">document.getElementById('app').textContent='ok'</script>
</head><body><div id="app"></div></body></html>
HTML;
$got = app_article_site_compat_html($inline);
assert_true(!str_contains($got, 'type="module"'), 'inline module type should be stripped');
assert_true(!str_contains($got, 'crossorigin'), 'crossorigin should be stripped');
assert_true(str_contains($got, 'src="omblog-compat-0.js"'), 'inline script should become an external classic script');
assert_true(!str_contains($got, "document.getElementById('app').textContent='ok'"), 'inline body should be extracted from HTML');
$scripts = app_article_site_compat_scripts($inline);
assert_true(($scripts[0] ?? '') === "document.getElementById('app').textContent='ok'", 'extracted script body should match');

$external = app_article_site_compat_html('<script type="module" crossorigin src="./assets/js/app.js"></script>');
assert_true($external === '<script src="./assets/js/app.js" defer></script>', 'external module should become deferred classic script: ' . $external);

$realModule = app_article_site_compat_html('<script type="module">import.meta.url; export const x = 1;</script><body></body>');
assert_true(str_contains($realModule, 'type="module"'), 'true ESM should stay a module');

$classic = '<head><script>var a=1</script></head><body></body>';
$classicGot = app_article_site_compat_html($classic);
assert_true(str_contains($classicGot, 'src="omblog-compat-0.js"'), 'classic inline script should also be externalized');

fwrite(STDOUT, "article_site_compat_test ok\n");
