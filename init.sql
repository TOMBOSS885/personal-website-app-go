-- ========================================
-- 个人网站 数据库初始化脚本
-- MySQL 8.0+
-- ========================================

CREATE DATABASE IF NOT EXISTS personal_website
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE personal_website;

-- ========================================
-- 用户表
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'ADMIN',
    avatar VARCHAR(500),
    nickname VARCHAR(255),
    bio VARCHAR(500),
    location VARCHAR(255),
    website VARCHAR(255),
    github VARCHAR(255),
    twitter VARCHAR(255),
    linkedin VARCHAR(255),
    email_public VARCHAR(255),
    tags VARCHAR(500),
    welcome_text VARCHAR(255),
    cta_title VARCHAR(255),
    cta_description VARCHAR(500),
    coffee_count INT DEFAULT 1000,
    stars_count INT DEFAULT 1000,
    bio_en VARCHAR(500),
    tags_en VARCHAR(500),
    welcome_text_en VARCHAR(255),
    cta_title_en VARCHAR(255),
    cta_description_en VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 文章表
-- ========================================
CREATE TABLE IF NOT EXISTS articles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(500),
    content TEXT,
    cover_image VARCHAR(500),
    category VARCHAR(100),
    tags VARCHAR(500),
    views INT DEFAULT 0,
    published BIT DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 项目表
-- ========================================
CREATE TABLE IF NOT EXISTS projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    cover_image VARCHAR(500),
    tech_stack VARCHAR(500),
    github_url VARCHAR(255),
    demo_url VARCHAR(255),
    stars INT DEFAULT 0,
    featured BIT DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 技能表
-- ========================================
CREATE TABLE IF NOT EXISTS skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    proficiency INT,
    icon VARCHAR(500),
    display_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 首页能力卡片表（“我能做什么 / 专业技能”模块）
-- ========================================
CREATE TABLE IF NOT EXISTS feature_cards (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    description VARCHAR(500),
    description_en VARCHAR(500),
    icon VARCHAR(100) DEFAULT 'Code',
    gradient VARCHAR(100) DEFAULT 'from-blue-500 to-cyan-500',
    display_order INT DEFAULT 0,
    enabled BIT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 主题表
-- ========================================
CREATE TABLE IF NOT EXISTS themes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    background_color VARCHAR(7),
    text_color VARCHAR(7),
    card_background VARCHAR(7),
    active BIT DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- Live2D 模型表
-- ========================================
CREATE TABLE IF NOT EXISTS live2d_models (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    directory VARCHAR(255) NOT NULL UNIQUE,
    model_path VARCHAR(1000) NOT NULL,
    active BIT DEFAULT 0,
    switchable BIT DEFAULT 1,
    display_order INT DEFAULT 0,
    scale DOUBLE DEFAULT 1,
    offset_x DOUBLE DEFAULT 0,
    offset_y DOUBLE DEFAULT 0,
    volume DOUBLE DEFAULT 0,
    tips_enabled BIT DEFAULT 1,
    welcome_messages VARCHAR(2000),
    tip_messages VARCHAR(4000),
    tip_duration INT DEFAULT 3500,
    tip_interval INT DEFAULT 9000,
    tip_offset_x INT DEFAULT 0,
    tip_offset_y INT DEFAULT 0,
    typing_enabled BIT DEFAULT 0,
    typing_param VARCHAR(255),
    typing_speed INT DEFAULT 120,
    typing_min_value DOUBLE DEFAULT 0,
    typing_max_value DOUBLE DEFAULT 1,
    created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- Live2D 全局设置表
-- ========================================
CREATE TABLE IF NOT EXISTS live2d_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enabled BIT DEFAULT 1,
    position VARCHAR(50) DEFAULT 'bottom-right',
    size INT DEFAULT 280,
    primary_color VARCHAR(100) DEFAULT 'rgba(96,165,250,0.92)',
    transition_type VARCHAR(50) DEFAULT 'slide',
    transition_duration INT DEFAULT 1500,
    menu_align VARCHAR(50) DEFAULT 'right',
    show_sleep_button BIT DEFAULT 1,
    show_about_button BIT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 音乐列表
-- ========================================
CREATE TABLE IF NOT EXISTS musics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    content_type VARCHAR(100),
    size BIGINT DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 初始化数据
-- ========================================

-- 清空已有数据 (重新初始化)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE users;
TRUNCATE TABLE articles;
TRUNCATE TABLE projects;
TRUNCATE TABLE skills;
TRUNCATE TABLE feature_cards;
TRUNCATE TABLE themes;
TRUNCATE TABLE live2d_models;
TRUNCATE TABLE live2d_settings;
TRUNCATE TABLE musics;
SET FOREIGN_KEY_CHECKS = 1;

-- 管理员用户 (密码: admin123)
INSERT INTO users (username, password, email, role, nickname, bio, location, github, tags, welcome_text, cta_title, cta_description, coffee_count, stars_count)
VALUES ('admin', '$2a$10$YBtpUW1X1eOmTD6moDilke6uR7i5/gSHY1Ti36fKmeJUSiXVeCkY6', 'admin@example.com', 'ADMIN',
        '站长', '全栈开发者，热爱技术与开源', '中国', 'https://github.com',
        '全栈开发者,技术爱好者', '👋 Hello, I''m', 'Let''s Work Together', '如果你对我的项目感兴趣，欢迎联系我', 1000, 1000);

-- 文章
INSERT INTO articles (title, summary, content, category, tags, published, views, created_at, updated_at)
VALUES
('欢迎使用个人网站',
 '这是一个基于 React + Go/Gin 构建的个人网站',
 '# 欢迎来到我的个人网站\n\n这是一个使用 React 和 Go/Gin 构建的现代化个人网站。\n\n## 特性\n\n- 🎨 精美的用户界面\n- 📝 文章管理系统\n- 💼 项目展示\n- 🛠️ 技能展示\n- 🔐 安全的管理后台',
 '公告', '欢迎,网站', 1, 100, NOW(), NOW()),

('技术栈介绍',
 '介绍本网站使用的技术栈',
 '# 技术栈介绍\n\n## 前端\n\n- React 18\n- Vite\n- TailwindCSS\n- Framer Motion\n\n## 后端\n\n- Go\n- Gin\n- GORM\n- JWT Authentication\n- MySQL Database',
 '技术', 'React,Go,Gin', 1, 0, NOW(), NOW());

-- 项目
INSERT INTO projects (name, description, tech_stack, github_url, featured, display_order, created_at, updated_at)
VALUES
('个人网站',
 '一个现代化的个人网站，展示个人项目、文章和技能',
 'React,Go,Gin,TailwindCSS',
 'https://github.com/username/personal-website',
 1, 1, NOW(), NOW()),

('API 网关',
 '高性能的 API 网关服务',
 'Go,Docker,Kubernetes',
 'https://github.com/username/api-gateway',
 1, 2, NOW(), NOW());

-- 技能
INSERT INTO skills (name, category, proficiency, display_order) VALUES
('Go',          '后端',   90, 1),
('Gin',         '后端',   88, 2),
('React',       '前端',   85, 3),
('TypeScript',  '前端',   82, 4),
('GORM',        '后端',   75, 5),
('Docker',      'DevOps', 80, 6),
('Kubernetes',  'DevOps', 70, 7),
('MySQL',       '数据库', 85, 8),
('Redis',       '数据库', 78, 9);

-- 首页能力卡片
INSERT INTO feature_cards (title, title_en, description, description_en, icon, gradient, display_order, enabled) VALUES
('全栈开发', 'Full Stack Dev', '前后端技术栈全面掌握，构建完整解决方案', 'Mastering frontend and backend technologies to build complete solutions', 'Code', 'from-blue-500 to-cyan-500', 1, 1),
('系统架构', 'System Architecture', '设计高可用、可扩展的分布式系统架构', 'Designing highly available and scalable distributed systems', 'Database', 'from-purple-500 to-pink-500', 2, 1),
('技术写作', 'Technical Writing', '分享技术心得与实践经验，记录成长历程', 'Sharing insights and experiences, documenting the growth journey', 'Globe', 'from-amber-500 to-orange-500', 3, 1),
('持续创新', 'Continuous Innovation', '保持对新技术的探索热情，拥抱变化', 'Maintaining passion for exploring new technologies and embracing change', 'Rocket', 'from-emerald-500 to-teal-500', 4, 1);
