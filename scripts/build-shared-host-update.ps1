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
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\PHP-shared-host-security-performance-update.md') -Destination (Join-Path $releaseRoot 'DEPLOY-UPDATE.md') -Force

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
New-PortableZipArchive -SourceDirectory $releaseRoot -DestinationPath $zipPath

$totalBytes = (Get-ChildItem -LiteralPath $releaseRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
$zipBytes = (Get-Item -LiteralPath $zipPath).Length
Write-Host "Update directory: $releaseRoot"
Write-Host "Update archive: $zipPath"
Write-Host "Uncompressed size: $([Math]::Round($totalBytes / 1MB, 2)) MB"
Write-Host "Archive size: $([Math]::Round($zipBytes / 1MB, 2)) MB"
Write-Host 'This update archive intentionally excludes config, uploads, setup.php, and the live root .htaccess.'
Write-Host "Frontend assets use release prefix: $AssetReleasePrefix"
Write-Host 'Import migrations/006_security_performance_hardening.sql through 009_guest_message_targets.sql before replacing app files.'
Write-Host 'No new database migration is required for the responsive-image, SEO, and Live2D update.'
Write-Host 'Read DEPLOY-UPDATE.md before uploading.'
