<?php

declare(strict_types=1);

function app_config(): array
{
    return [
        'app' => ['setup_key' => 'unit-test-setup-key'],
        'database' => ['name' => 'personal_website_test'],
    ];
}

require dirname(__DIR__) . '/app/admin_totp.php';

function assert_true(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$raw = '12345678901234567890';
$encoded = app_admin_totp_base32_encode($raw);
assert_true($encoded === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'base32 encode mismatch: ' . $encoded);
assert_true(app_admin_totp_base32_decode($encoded) === $raw, 'base32 roundtrip failed');

assert_true(app_admin_totp_code($encoded, 0) === '755224', 'HOTP counter 0 mismatch');
assert_true(app_admin_totp_code($encoded, 1) === '287082', 'HOTP counter 1 mismatch');
assert_true(app_admin_totp_code($encoded, 2) === '359152', 'HOTP counter 2 mismatch');

assert_true(app_admin_totp_verify($encoded, '287082', null, 59) === 1, 'TOTP at t=59 should accept counter 1');
assert_true(app_admin_totp_verify($encoded, '755224', null, 59) === 0, 'TOTP should accept the previous 30s window');
assert_true(app_admin_totp_verify($encoded, '359152', null, 59) === 2, 'TOTP should accept the next 30s window');
assert_true(app_admin_totp_verify($encoded, '287082', 1, 59) === null, 'used TOTP counters must be rejected');
assert_true(app_admin_totp_verify($encoded, '000000', null, 59) === null, 'wrong TOTP codes must be rejected');
assert_true(app_admin_totp_verify($encoded, '28708', null, 59) === null, 'short codes must be rejected');

$secret = 'JBSWY3DPEHPK3PXP';
$encrypted = app_admin_totp_encrypt_secret($secret);
assert_true(str_starts_with($encrypted, 'v2.'), 'encrypted secret should use v2 payload format');
assert_true(app_admin_totp_decrypt_secret($encrypted) === $secret, 'TOTP secret encrypt/decrypt roundtrip failed');
assert_true($encrypted !== app_admin_totp_encrypt_secret($secret), 'TOTP encryption must use a unique IV');

$legacyIv = random_bytes(12);
$legacyTag = '';
$legacyCipher = openssl_encrypt($secret, 'aes-256-gcm', app_admin_totp_legacy_encryption_key('personal_website_test'), OPENSSL_RAW_DATA, $legacyIv, $legacyTag, 'admin-totp-v1', 16);
$legacyPayload = 'v1.' . base64_encode($legacyIv) . '.' . base64_encode($legacyTag) . '.' . base64_encode($legacyCipher);
assert_true(app_admin_totp_decrypt_secret($legacyPayload) === $secret, 'legacy TOTP payload must remain readable');
assert_true(str_starts_with(app_admin_totp_reencrypt_legacy_secret($legacyPayload), 'v2.'), 'legacy TOTP payload must be upgradeable');

fwrite(STDOUT, "admin_totp_test ok\n");
