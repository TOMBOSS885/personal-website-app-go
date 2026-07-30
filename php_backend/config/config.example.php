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
        'article_site_url_ttl_seconds' => 3600,
        'upload_dir' => dirname(__DIR__) . '/uploads',
        'upload_url' => '/uploads',
    ],
];
