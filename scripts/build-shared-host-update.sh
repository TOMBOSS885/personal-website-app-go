#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="20260904-creator-session-series"
release_prefix="r${version}"
release_dir="${repo_root}/release/personal-website-content-incremental-update-${version}"
archive="${repo_root}/release/personal-website-content-incremental-update-${version}.zip"

command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

echo "[1/5] Building frontend..."
(cd "${repo_root}/frontend" && VITE_ASSET_RELEASE_PREFIX="${release_prefix}" npm run build)

echo "[2/5] Preparing update tree..."
rm -rf "${release_dir}"
mkdir -p "${release_dir}/api" "${release_dir}/app" "${release_dir}/migrations"
cp -a "${repo_root}/frontend/dist/index.html" "${release_dir}/"
cp -a "${repo_root}/frontend/dist/assets" "${release_dir}/"
cp -a "${repo_root}/php_backend/public/api/index.php" "${release_dir}/api/index.php"
cp -a "${repo_root}/php_backend/app/bootstrap.php" "${release_dir}/app/bootstrap.php"
cp -a "${repo_root}/php_backend/app/audit.php" "${release_dir}/app/audit.php"
cp -a "${repo_root}/php_backend/app/mind_maps.php" "${release_dir}/app/mind_maps.php"
cp -a "${repo_root}/php_backend/app/mail.php" "${release_dir}/app/mail.php"
cp -a "${repo_root}/php_backend/app/mail_templates.php" "${release_dir}/app/mail_templates.php"
cp -a "${repo_root}/php_backend/app/content_auth.php" "${release_dir}/app/content_auth.php"
cp -a "${repo_root}/php_backend/app/creator.php" "${release_dir}/app/creator.php"
cp -a "${repo_root}/php_backend/app/user_auth.php" "${release_dir}/app/user_auth.php"
cp -a "${repo_root}/php_backend/app/user_admin.php" "${release_dir}/app/user_admin.php"
cp -a "${repo_root}/php_backend/migrations/017_smtp_email_verification.sql" "${release_dir}/migrations/017_smtp_email_verification.sql"
cp -a "${repo_root}/php_backend/migrations/018_user_roles_content_ownership.sql" "${release_dir}/migrations/018_user_roles_content_ownership.sql"
cp -a "${repo_root}/docs/content-ownership-incremental-deploy.md" "${release_dir}/DEPLOY-CONTENT.md"

echo "[3/5] Writing checksums..."
(cd "${release_dir}" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt)

echo "[4/5] Creating archive..."
rm -f "${archive}"
(cd "${release_dir}" && zip -qr "${archive}" .)
(cd "$(dirname "${archive}")" && sha256sum "$(basename "${archive}")") | tee "${archive}.sha256"

echo "[5/5] Package ready"
echo "Directory: ${release_dir}"
echo "Archive:   ${archive}"
echo "Do not upload this package over config/ or uploads/."
