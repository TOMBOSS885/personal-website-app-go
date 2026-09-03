#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="20260902-v3"
release_prefix="r20260902googlemicrosoftv3"
output_root="${repo_root}/release/personal-website-google-microsoft-oauth-update-${version}"
staging_root="${output_root}/personal-website-google-microsoft-oauth-update"
archive_path="${repo_root}/release/personal-website-google-microsoft-oauth-update-${version}.zip"

if [[ -e "${output_root}" || -e "${archive_path}" ]]; then
  printf 'Refusing to overwrite existing output.\n' >&2
  exit 1
fi

(cd "${repo_root}/frontend" && VITE_ASSET_RELEASE_PREFIX="${release_prefix}" npm run build)
dist_root="${repo_root}/frontend/dist"
if [[ ! -f "${dist_root}/index.html" ]] || ! rg -q "${release_prefix}-" "${dist_root}/index.html"; then
  printf 'frontend/dist is missing the expected release prefix.\n' >&2
  exit 1
fi

mkdir -p "${staging_root}/api" "${staging_root}/app" "${staging_root}/assets" \
  "${staging_root}/config" "${staging_root}/migrations" "${staging_root}/server-config"
install -m 0644 "${dist_root}/index.html" "${staging_root}/index.html"
cp -a "${dist_root}/assets/." "${staging_root}/assets/"
install -m 0644 "${repo_root}/php_backend/public/api/index.php" "${staging_root}/api/index.php"
for file in bootstrap.php article_sites.php audit.php oauth.php user_admin.php user_auth.php; do
  install -m 0644 "${repo_root}/php_backend/app/${file}" "${staging_root}/app/${file}"
done
install -m 0644 "${repo_root}/php_backend/config/config.example.php" "${staging_root}/config/config.example.php"
install -m 0644 "${repo_root}/php_backend/migrations/015_oauth_identities.sql" "${staging_root}/migrations/015_oauth_identities.sql"
install -m 0644 "${repo_root}/deploy/shared-host/nginx-rewrite.conf" "${staging_root}/server-config/nginx-rewrite.conf"
install -m 0644 "${repo_root}/docs/third-party-login-update.md" "${staging_root}/UPGRADE-THIRD-PARTY-LOGIN.md"

if rg -n "client_secret'\\s*=>\\s*'[^']+" "${staging_root}/config/config.example.php"; then
  printf 'Refusing to package a non-empty OAuth client secret.\n' >&2
  exit 1
fi

(
  cd "${staging_root}"
  zip -q -r "${archive_path}" index.html assets api app config migrations server-config UPGRADE-THIRD-PARTY-LOGIN.md
)
sha256sum "${archive_path}" > "${archive_path}.sha256"
printf 'Update archive: %s\n' "${archive_path}"
cat "${archive_path}.sha256"
