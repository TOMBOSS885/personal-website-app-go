<?php

declare(strict_types=1);

function app_mail_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_registration_code_mail(string $siteName, string $code, int $expiresMinutes): array
{
    $safeName = app_mail_escape($siteName);
    $safeCode = app_mail_escape($code);
    $html = '<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b"><div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(15,23,42,.08)"><h1 style="margin:0 0 18px;font-size:22px">欢迎注册 ' . $safeName . '</h1><p>您的邮箱验证码为：</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4f46e5;margin:22px 0">' . $safeCode . '</p><p style="color:#64748b">验证码将在 ' . $expiresMinutes . ' 分钟后失效。若这不是您的操作，请忽略此邮件。</p></div></body></html>';
    $text = "欢迎注册 {$siteName}\n\n您的邮箱验证码为：{$code}\n\n验证码将在 {$expiresMinutes} 分钟后失效。若这不是您的操作，请忽略此邮件。";
    return ['html' => $html, 'text' => $text];
}

function app_smtp_test_mail(string $siteName): array
{
    $safeName = app_mail_escape($siteName);
    $html = '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1e293b"><h1>SMTP 邮件服务测试成功</h1><p>如果您收到此邮件，说明 ' . $safeName . ' 的 SMTP 配置基本正常。</p></body></html>';
    return ['html' => $html, 'text' => "SMTP 邮件服务测试成功。\n\n如果您收到此邮件，说明 {$siteName} 的 SMTP 配置基本正常。"];
}
