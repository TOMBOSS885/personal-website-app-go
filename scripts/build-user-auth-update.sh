#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_root="/tmp/personal-website-user-auth-update-20260901"
staging_root="${output_root}/personal-website-user-auth-update"
archive_path="${output_root}/personal-website-user-auth-update-20260901.zip"
release_prefix="r20260901userauth"

if [[ -e "${output_root}" ]]; then
  printf 'Refusing to overwrite existing output: %s\n' "${output_root}" >&2
  exit 1
fi

(cd "${repo_root}/frontend" && VITE_ASSET_RELEASE_PREFIX="${release_prefix}" npm run build)
dist_root="${repo_root}/frontend/dist"
if [[ ! -f "${dist_root}/index.html" ]] || ! rg -q "${release_prefix}-" "${dist_root}/index.html"; then
  printf 'frontend/dist is missing the expected release prefix.\n' >&2
  exit 1
fi

mkdir -p "${staging_root}/api" "${staging_root}/app" "${staging_root}/assets" "${staging_root}/migrations"
install -m 0644 "${dist_root}/index.html" "${staging_root}/index.html"
cp -a "${dist_root}/assets/." "${staging_root}/assets/"
install -m 0644 "${repo_root}/php_backend/public/api/index.php" "${staging_root}/api/index.php"
install -m 0644 "${repo_root}/php_backend/app/bootstrap.php" "${staging_root}/app/bootstrap.php"
install -m 0644 "${repo_root}/php_backend/app/analytics.php" "${staging_root}/app/analytics.php"
install -m 0644 "${repo_root}/php_backend/app/article_sites.php" "${staging_root}/app/article_sites.php"
install -m 0644 "${repo_root}/php_backend/app/audit.php" "${staging_root}/app/audit.php"
install -m 0644 "${repo_root}/php_backend/app/social.php" "${staging_root}/app/social.php"
install -m 0644 "${repo_root}/php_backend/app/user_auth.php" "${staging_root}/app/user_auth.php"
install -m 0644 "${repo_root}/php_backend/app/user_admin.php" "${staging_root}/app/user_admin.php"
install -m 0644 "${repo_root}/php_backend/migrations/012_admin_operation_logs.sql" "${staging_root}/migrations/012_admin_operation_logs.sql"
install -m 0644 "${repo_root}/php_backend/migrations/013_user_auth_article_login_analytics.sql" "${staging_root}/migrations/013_user_auth_article_login_analytics.sql"
install -m 0644 "${repo_root}/php_backend/migrations/014_user_admin_management.sql" "${staging_root}/migrations/014_user_admin_management.sql"

(
  cd "${staging_root}"
  zip -q -r "${archive_path}" index.html assets api app migrations
)

printf 'Update directory: %s\n' "${staging_root}"
printf 'Update archive: %s\n' "${archive_path}"
sha256sum "${archive_path}"
