<?php

return [
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'YOUR_DATABASE_NAME',
        'user' => 'YOUR_DATABASE_USER',
        'password' => 'YOUR_DATABASE_PASSWORD',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'production' => true,
        'timezone' => 'Asia/Shanghai',
        'session_name' => 'personal_website_admin',
        // Bootstrap/fallback value only. Change it later from Account Security in the admin UI.
        // Existing installations without this key temporarily keep the legacy /admin entry.
        'admin_path_suffix' => 'control-k8x4m2q7',
        'setup_key' => 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING',
        // Optional: use the same random value on primary and backup hosts.
        'analytics_key' => 'CHANGE_THIS_TO_ANOTHER_LONG_RANDOM_STRING',
        // Optional canonical URL used by robots.txt and sitemap.xml.
        'site_url' => 'https://omblog.tombossking.xyz',
        'article_site_url_ttl_seconds' => 3600,
        'upload_dir' => dirname(__DIR__) . '/uploads',
        'upload_url' => '/uploads',
    ],
    // Secrets stay on the server. Keep providers disabled until the callback
    // URL and matching application credentials have been configured.
    'oauth' => [
        'github' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
            'callback_url' => 'https://omblog.tombossking.xyz/api/auth/oauth/github/callback',
        ],
        'qq' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
            'callback_url' => 'https://omblog.tombossking.xyz/api/auth/oauth/qq/callback',
        ],
        'wechat' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
            'callback_url' => 'https://omblog.tombossking.xyz/api/auth/oauth/wechat/callback',
        ],
    ],
];
