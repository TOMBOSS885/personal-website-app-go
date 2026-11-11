#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="20261106-initial"
release_prefix="r${version}"
release_dir="${repo_root}/release/personal-website-php-shared-host-initial-${version}"
archive="${repo_root}/release/personal-website-php-shared-host-initial-${version}.zip"

command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

echo "[1/6] Building frontend..."
(cd "${repo_root}/frontend" && VITE_ASSET_RELEASE_PREFIX="${release_prefix}" npm run build)

echo "[2/6] Preparing release tree..."
rm -rf "${release_dir}"
mkdir -p "${release_dir}/api" "${release_dir}/config" "${release_dir}/migrations" "${release_dir}/server-config" "${release_dir}/uploads"

cp -a "${repo_root}/frontend/dist/." "${release_dir}/"
cp -a "${repo_root}/php_backend/app" "${release_dir}/app"
cp -a "${repo_root}/php_backend/public/api/index.php" "${release_dir}/api/index.php"
cp -a "${repo_root}/php_backend/public/setup.php" "${release_dir}/setup.php"
cp -a "${repo_root}/php_backend/config/config.example.php" "${release_dir}/config/config.php"
cp -a "${repo_root}/php_backend/migrations/." "${release_dir}/migrations/"
cp -a "${repo_root}/deploy/shared-host/.htaccess" "${release_dir}/.htaccess"
cp -a "${repo_root}/deploy/shared-host/nginx-rewrite.conf" "${release_dir}/server-config/nginx-rewrite.conf"
cp -a "${repo_root}/deploy/shared-host/uploads/.htaccess" "${release_dir}/uploads/.htaccess"
cp -a "${repo_root}/docs/PHP-virtual-host-initial-deploy-20261106.md" "${release_dir}/DEPLOY.md"

for directory in articles avatars theme live2d article-sites; do
  mkdir -p "${release_dir}/uploads/${directory}"
done

echo "[3/6] Checking package boundaries..."
if find "${release_dir}" -type f \( -name '.env' -o -name 'config.php.bak' -o -name '*.sql.gz' \) -print -quit | grep -q .; then
  echo "Unexpected secret or database backup in release tree" >&2
  exit 1
fi
if rg -n --hidden --glob '!SHA256SUMS.txt' --glob '!assets/**' --glob '!*.woff2' -- '-----BEGIN .*PRIVATE KEY-----' "${release_dir}"; then
  echo "Possible secret found in release tree" >&2
  exit 1
fi

echo "[4/6] Writing checksums..."
(cd "${release_dir}" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt)

echo "[5/6] Creating archive..."
rm -f "${archive}" "${archive}.sha256"
(cd "${release_dir}" && zip -qr "${archive}" .)
(cd "$(dirname "${archive}")" && sha256sum "$(basename "${archive}")") | tee "${archive}.sha256"

echo "[6/6] Package ready"
echo "Directory: ${release_dir}"
echo "Archive:   ${archive}"
