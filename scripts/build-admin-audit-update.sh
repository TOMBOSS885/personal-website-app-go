#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_root="${repo_root}/frontend/dist"
package_root="/tmp/personal-website-admin-audit-update-20260831-v5"
staging_root="${package_root}/personal-website-admin-audit-update"
archive_path="${package_root}/personal-website-admin-audit-update-20260831-v5.zip"

if [[ -e "${package_root}" ]]; then
  printf 'Refusing to overwrite existing output: %s\n' "${package_root}" >&2
  exit 1
fi
if [[ ! -f "${dist_root}/index.html" ]]; then
  printf 'Missing frontend build: %s\n' "${dist_root}/index.html" >&2
  exit 1
fi
if ! rg -q 'r20260831audit20260831v2-' "${dist_root}/index.html"; then
  printf 'frontend/dist does not contain the expected audit release prefix.\n' >&2
  exit 1
fi

mkdir -p "${staging_root}/api" "${staging_root}/app" "${staging_root}/assets" "${staging_root}/migrations"
install -m 0644 "${dist_root}/index.html" "${staging_root}/index.html"
cp -a "${dist_root}/assets/." "${staging_root}/assets/"
install -m 0644 "${repo_root}/php_backend/public/api/index.php" "${staging_root}/api/index.php"
install -m 0644 "${repo_root}/php_backend/app/bootstrap.php" "${staging_root}/app/bootstrap.php"
install -m 0644 "${repo_root}/php_backend/app/audit.php" "${staging_root}/app/audit.php"
install -m 0644 "${repo_root}/php_backend/app/social.php" "${staging_root}/app/social.php"
install -m 0644 "${repo_root}/php_backend/migrations/012_admin_operation_logs.sql" "${staging_root}/migrations/012_admin_operation_logs.sql"

(
  cd "${staging_root}"
  zip -q -r "${archive_path}" index.html assets api app migrations
)

printf 'Update directory: %s\n' "${staging_root}"
printf 'Update archive: %s\n' "${archive_path}"
sha256sum "${archive_path}"
