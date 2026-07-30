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

$totalBytes = (Get-ChildItem -LiteralPath $releaseRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
$totalMB = [Math]::Round($totalBytes / 1MB, 2)
if ($totalMB -gt 270) {
    throw "Release size is $totalMB MB, above the 270 MB safety limit. Clean uploads and retry."
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
New-PortableZipArchive -SourceDirectory $releaseRoot -DestinationPath $zipPath

Write-Host "Release directory: $releaseRoot"
Write-Host "Release archive: $zipPath"
Write-Host "Uncompressed size: $totalMB MB"
Write-Host 'Edit release\php-shared-host\config\config.php before uploading.'
