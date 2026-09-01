$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bootstrap = Get-Content (Join-Path $root 'app\bootstrap.php') -Raw
$articleSites = Get-Content (Join-Path $root 'app\article_sites.php') -Raw

function Assert-Contains([string] $text, [string] $pattern, [string] $message) {
    if ($text -notmatch $pattern) { throw "FAIL: $message" }
}

Assert-Contains $bootstrap 'APP_BACKUP_MAX_ARCHIVE_BYTES' 'backup archive size limit is missing'
Assert-Contains $bootstrap 'token_get_all\(\$source\)' 'legacy backup settings are not lexically validated'
if ($bootstrap -match 'include\s+\$safePath') { throw 'FAIL: legacy backup settings must not be executed as PHP' }
Assert-Contains $bootstrap 'app_backup_validate_sql_statement' 'backup SQL allowlist is missing'
Assert-Contains $bootstrap 'app_backup_validate_upload_path' 'backup upload path allowlist is missing'
Assert-Contains $bootstrap 'app_backup_install_upload_protection' 'restored upload directory is not protected'
Assert-Contains $bootstrap 'config/app-settings\.json\.enc' 'new backups do not use encrypted JSON settings'
Assert-Contains $bootstrap 'CROSS_SITE_REQUEST_BLOCKED' 'Fetch Metadata CSRF defense is missing'
Assert-Contains $bootstrap 'app_article_unlock_token' 'article unlock state is not bound to the password hash'
Assert-Contains $bootstrap "Cache-Control: no-store" 'private response cache protection is missing'
Assert-Contains $bootstrap 'session\.cookie_httponly' 'session HttpOnly configuration is missing'
Assert-Contains $bootstrap 'session\.use_strict_mode' 'strict session mode is missing'
Assert-Contains $articleSites 'app_article_site_clean_path' 'static article path traversal guard is missing'
Assert-Contains $articleSites 'hash_equals\(\$expected, \$signature\)' 'static article signature verification is missing'
if ($articleSites -match 'Access-Control-Allow-Origin:\s*\*') { throw 'FAIL: signed static article resources must not grant wildcard CORS' }

Write-Output 'PHP backend security invariant audit passed.'
