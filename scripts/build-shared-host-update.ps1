param(
    [switch]$SkipFrontendBuild
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
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'api') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot 'migrations') -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $distRoot 'index.html') -Destination $releaseRoot -Force
Copy-Item -LiteralPath (Join-Path $distRoot 'assets') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\app') -Destination $releaseRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'php_backend\public\api\index.php') -Destination (Join-Path $releaseRoot 'api\index.php') -Force
Copy-Item -Path (Join-Path $repoRoot 'php_backend\migrations\*') -Destination (Join-Path $releaseRoot 'migrations') -Force

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
Write-Host 'This update archive intentionally excludes config, uploads, setup.php, and .htaccess.'
