#!/usr/bin/env bash
set -euo pipefail

source_dir="/tmp/personal-website-formula-hotfix"
package_root="/tmp/personal-website-formula-hotfix-package-20260831"
staging_dir="${package_root}/personal-website-formula-hotfix"
archive_path="${package_root}/personal-website-formula-hotfix-20260831.zip"

if [[ -e "${package_root}" ]]; then
  printf 'Refusing to overwrite existing package directory: %s\n' "${package_root}" >&2
  exit 1
fi

mkdir -p "${staging_dir}/assets"
install -m 0644 "${source_dir}/index-formula3.html" "${staging_dir}/index.html"
install -m 0644 "${source_dir}"/assets/r20260831formula3-*.js "${staging_dir}/assets/"

(
  cd "${staging_dir}"
  zip -q -r "${archive_path}" index.html assets
)

printf '%s\n' "${archive_path}"
