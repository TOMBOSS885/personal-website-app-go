#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="20261010-performance"
release_prefix="r${version}"
release_dir="${repo_root}/release/personal-website-performance-incremental-update-${version}"
archive="${repo_root}/release/personal-website-performance-incremental-update-${version}.zip"

command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

echo "[1/5] Building frontend..."
(cd "${repo_root}/frontend" && VITE_ASSET_RELEASE_PREFIX="${release_prefix}" npm run build)

echo "[2/5] Preparing update tree..."
rm -rf "${release_dir}"
mkdir -p "${release_dir}/api" "${release_dir}/app"
cp -a "${repo_root}/frontend/dist/index.html" "${release_dir}/"
cp -a "${repo_root}/frontend/dist/assets" "${release_dir}/"
cp -a "${repo_root}/php_backend/public/api/index.php" "${release_dir}/api/index.php"
cp -a "${repo_root}/php_backend/app/bootstrap.php" "${release_dir}/app/bootstrap.php"
cp -a "${repo_root}/docs/performance-incremental-deploy.md" "${release_dir}/DEPLOY-PERFORMANCE.md"

echo "[3/5] Writing checksums..."
(cd "${release_dir}" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt)

echo "[4/5] Creating archive..."
rm -f "${archive}" "${archive}.sha256"
(cd "${release_dir}" && zip -qr "${archive}" .)
(cd "$(dirname "${archive}")" && sha256sum "$(basename "${archive}")") | tee "${archive}.sha256"

echo "[5/5] Package ready"
echo "Directory: ${release_dir}"
echo "Archive:   ${archive}"
echo "Do not upload this package over config/ or uploads/."
