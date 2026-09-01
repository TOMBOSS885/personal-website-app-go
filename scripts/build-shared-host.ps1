param(
    [switch]$IncludeExistingUploads,
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $repoRoot 'release\php-shared-host'
$zipPath = Join-Path $repoRoot 'release\php-shared-host.zip'

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
    $allowedDots = @('.htaccess', 'uploads/.htaccess')
    $activeUploadPattern = '\.(?:php[0-9]?|phtml|phar|cgi|pl|py|sh|bash|exe|bat|cmd|html?|shtml|xhtml|js|mjs|css|svgz?|xml|xsl)$'
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
            throw "Unexpected top-level release entry: $relative"
        }
        if ($relative -match '(^|/)\.' -and $allowedDots -notcontains $relative) {
            throw "Hidden file is not allowed in the release: $relative"
        }
        if ($relative -match '^uploads/' -and $relative -match $activeUploadPattern) {
            throw "Active web content is not allowed in uploads: $relative"
        }

        if ($file.Length -le 8MB -and $file.Extension -match '^\.(?:php|js|css|html?|md|txt|conf|sql|json|xml|ya?ml|htaccess)$') {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            foreach ($pattern in $secretPatterns) {
                if ($content -match $pattern) {
                    throw "Possible embedded credential in release file: $relative"
                }
            }
        }
    }

    $releaseConfig = Join-Path $resolvedRoot 'config\config.php'
    if (Test-Path -LiteralPath $releaseConfig) {
        $configText = [System.IO.File]::ReadAllText($releaseConfig)
        foreach ($placeholder in @('YOUR_DATABASE_NAME', 'YOUR_DATABASE_USER', 'YOUR_DATABASE_PASSWORD', 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING')) {
            if (-not $configText.Contains($placeholder)) {
                throw "Release config is not the unconfigured template; missing placeholder: $placeholder"
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
    try {
        npm.cmd run build
    } finally {
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
New-Item -ItemType Directory -Path $releaseRoot | Out-Null

Copy-Item -Path (Join-Path $distRoot '*') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\app') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\migrations') -Destination $releaseRoot -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'config') | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\config\config.example.php') -Destination (Join-Path $releaseRoot 'config\config.php') -Force
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'api') | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\public\api\index.php') -Destination (Join-Path $releaseRoot 'api\index.php') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\public\setup.php') -Destination (Join-Path $releaseRoot 'setup.php') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\shared-host\.htaccess') -Destination (Join-Path $releaseRoot '.htaccess') -Force

$uploadsRoot = Join-Path $releaseRoot 'uploads'
New-Item -ItemType Directory -Path $uploadsRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\shared-host\uploads\.htaccess') -Destination (Join-Path $uploadsRoot '.htaccess') -Force
foreach ($folder in @('articles', 'avatars', 'theme', 'live2d', 'article-sites')) {
    New-Item -ItemType Directory -Path (Join-Path $uploadsRoot $folder) -Force | Out-Null
}

if ($IncludeExistingUploads) {
    foreach ($folder in @('articles', 'avatars', 'theme', 'live2d')) {
        $source = Join-Path $repoRoot "uploads\$folder"
        if (Test-Path -LiteralPath $source) {
            Copy-Item -Path (Join-Path $source '*') -Destination (Join-Path $uploadsRoot $folder) -Recurse -Force
        }
    }
}

Write-ReleaseChecksumManifest -Root $releaseRoot
Assert-SafeReleaseTree -Root $releaseRoot -AllowedTopLevel @(
    '.htaccess', 'SHA256SUMS.txt', 'api', 'app', 'assets', 'config', 'favicon.ico',
    'index.html', 'migrations', 'setup.php', 'uploads'
)

$totalBytes = (Get-ChildItem -LiteralPath $releaseRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
$totalMB = [Math]::Round($totalBytes / 1MB, 2)
if ($totalMB -gt 270) {
    throw "Release size is $totalMB MB, above the 270 MB safety limit. Clean uploads and retry."
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
New-PortableZipArchive -SourceDirectory $releaseRoot -DestinationPath $zipPath
Assert-SafeZipArchive -ArchivePath $zipPath

Write-Host "Release directory: $releaseRoot"
Write-Host "Release archive: $zipPath"
Write-Host "Uncompressed size: $totalMB MB"
Write-Host "Archive SHA-256: $((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash)"
Write-Host 'Edit release\php-shared-host\config\config.php before uploading.'
