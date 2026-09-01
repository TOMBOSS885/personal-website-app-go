param(
    [switch]$SkipFrontendBuild,
    [string]$AssetReleasePrefix = ('r' + (Get-Date -Format 'yyyyMMddHHmm'))
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $repoRoot 'release\php-shared-host-update'
$zipPath = Join-Path $repoRoot 'release\php-shared-host-update.zip'

function New-PortableZipArchive {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDirectory,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open(
        $DestinationPath,
        [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
        foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File) {
            $entryName = $file.FullName.Substring($SourceDirectory.Length).TrimStart([char[]]'\/').Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $file.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally {
        $archive.Dispose()
    }
}

function Assert-SafeReleaseTree {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string[]]$AllowedTopLevel
    )

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd([char[]]'\/')
    $secretPatterns = @(
        '-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----',
        '(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])',
        '(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9_]{20,}',
        '(?<![A-Za-z0-9-])xox[baprs]-[A-Za-z0-9-]{20,}',
        '(?i)ftps?://[^/\s:@]+:[^@\s/]+@'
    )

    foreach ($file in Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Force -File) {
        if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Release contains a reparse point: $($file.FullName)"
        }

        $relative = $file.FullName.Substring($resolvedRoot.Length).TrimStart([char[]]'\/').Replace('\', '/')
        $topLevel = ($relative -split '/', 2)[0]
        if ($AllowedTopLevel -notcontains $topLevel) {
            throw "Unexpected top-level update entry: $relative"
        }
        if ($relative -match '(^|/)\.') {
            throw "Hidden file is not allowed in the update archive: $relative"
        }

        if ($file.Length -le 8MB -and $file.Extension -match '^\.(?:php|js|css|html?|md|txt|conf|sql|json|xml|ya?ml|htaccess)$') {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            foreach ($pattern in $secretPatterns) {
                if ($content -match $pattern) {
                    throw "Possible embedded credential in update file: $relative"
                }
            }
        }
    }
}

function Write-ReleaseChecksumManifest {
    param([Parameter(Mandatory = $true)][string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd([char[]]'\/')
    $manifestPath = Join-Path $resolvedRoot 'SHA256SUMS.txt'
    $lines = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Force -File |
        Where-Object { $_.FullName -ne $manifestPath } |
        ForEach-Object {
            $relative = $_.FullName.Substring($resolvedRoot.Length).TrimStart([char[]]'\/').Replace('\', '/')
            "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relative
        } |
        Sort-Object
    [System.IO.File]::WriteAllLines($manifestPath, [string[]]$lines, [System.Text.Encoding]::ASCII)
}

function Assert-SafeZipArchive {
    param([Parameter(Mandatory = $true)][string]$ArchivePath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        $seen = @{}
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName.Replace('\', '/')
            if ($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or $name -match '(^|/)\.\.(/|$)') {
                throw "Unsafe archive entry path: $name"
            }
            $key = $name.ToLowerInvariant()
            if ($seen.ContainsKey($key)) {
                throw "Duplicate archive entry: $name"
            }
            $seen[$key] = $true
        }
    } finally {
        $archive.Dispose()
    }
}

if (-not $SkipFrontendBuild) {
    Push-Location (Join-Path $repoRoot 'frontend')
    $previousAssetReleasePrefix = $env:VITE_ASSET_RELEASE_PREFIX
    try {
        $env:VITE_ASSET_RELEASE_PREFIX = $AssetReleasePrefix
        npm.cmd run build
    } finally {
        if ($null -eq $previousAssetReleasePrefix) {
            Remove-Item Env:VITE_ASSET_RELEASE_PREFIX -ErrorAction SilentlyContinue
        } else {
            $env:VITE_ASSET_RELEASE_PREFIX = $previousAssetReleasePrefix
        }
        Pop-Location
    }
}

$distRoot = Join-Path $repoRoot 'frontend\dist'
if (-not (Test-Path -LiteralPath (Join-Path $distRoot 'index.html'))) {
    throw 'frontend/dist/index.html is missing. Build the frontend first.'
}

if (Test-Path -LiteralPath $releaseRoot) {
    Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'api') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'migrations') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'server-config') -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $distRoot 'index.html') -Destination $releaseRoot -Force
Copy-Item -LiteralPath (Join-Path $distRoot 'assets') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\app') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\public\api\index.php') -Destination (Join-Path $releaseRoot 'api\index.php') -Force
Copy-Item -Path (Join-Path $repoRoot 'php_backend\migrations\*') -Destination (Join-Path $releaseRoot 'migrations') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\shared-host\.htaccess') -Destination (Join-Path $releaseRoot 'server-config\apache.htaccess') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\shared-host\nginx-rewrite.conf') -Destination (Join-Path $releaseRoot 'server-config\nginx-rewrite.conf') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\shared-host\uploads\.htaccess') -Destination (Join-Path $releaseRoot 'server-config\uploads.htaccess') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\PHP-shared-host-security-performance-update.md') -Destination (Join-Path $releaseRoot 'SECURITY-UPDATE.md') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\PHP-content-discovery-update.md') -Destination (Join-Path $releaseRoot 'DEPLOY-UPDATE.md') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\PHP-markdown-rendering.md') -Destination (Join-Path $releaseRoot 'MARKDOWN-RENDERING.md') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\deployment-security-audit-2026-08-14.md') -Destination (Join-Path $releaseRoot 'SECURITY-AUDIT-2026-08-14.md') -Force

Write-ReleaseChecksumManifest -Root $releaseRoot
Assert-SafeReleaseTree -Root $releaseRoot -AllowedTopLevel @(
    'DEPLOY-UPDATE.md', 'MARKDOWN-RENDERING.md', 'SECURITY-UPDATE.md', 'SECURITY-AUDIT-2026-08-14.md', 'SHA256SUMS.txt',
    'api', 'app', 'assets', 'index.html', 'migrations', 'server-config'
)

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
New-PortableZipArchive -SourceDirectory $releaseRoot -DestinationPath $zipPath
Assert-SafeZipArchive -ArchivePath $zipPath

$totalBytes = (Get-ChildItem -LiteralPath $releaseRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
$zipBytes = (Get-Item -LiteralPath $zipPath).Length
Write-Host "Update directory: $releaseRoot"
Write-Host "Update archive: $zipPath"
Write-Host "Uncompressed size: $([Math]::Round($totalBytes / 1MB, 2)) MB"
Write-Host "Archive size: $([Math]::Round($zipBytes / 1MB, 2)) MB"
Write-Host "Archive SHA-256: $((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash)"
Write-Host 'This update archive intentionally excludes config, uploads, setup.php, and the live root .htaccess.'
Write-Host "Frontend assets use release prefix: $AssetReleasePrefix"
Write-Host 'Import migrations/006_security_performance_hardening.sql through 011_article_discovery.sql before replacing app files.'
Write-Host 'Migrations 010-011 add article series, discovery, featured, and display-order metadata.'
Write-Host 'Read DEPLOY-UPDATE.md before uploading. SECURITY-UPDATE.md contains the earlier hardening notes.'
