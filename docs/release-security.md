# Desktop release security

The repository builds and tests the desktop client in CI, but a trustworthy
public Windows release also requires credentials that must not be committed.

Before publishing a release:

1. Sign the NSIS and MSI installers with an organization-owned Windows
   Authenticode certificate. Keep the PFX and password in GitHub Environment
   secrets or use a managed signing service.
2. Configure the Tauri updater with an offline-generated updater key. Store the
   private key and password in GitHub secrets; only the public key belongs in
   `tauri.conf.json`.
3. Build release artifacts only from a protected tag in CI using `npm ci` and
   `cargo build --locked`.
4. Publish SHA-256 hashes and an SBOM alongside every installer.
5. Never upload locally built unsigned installers as the canonical GitHub
   release after signed CI publishing is enabled.

The application remains usable without these credentials, but Windows cannot
verify the publisher and installed clients cannot verify update provenance.
