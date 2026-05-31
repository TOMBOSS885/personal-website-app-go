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
-- 初始化数据
-- ========================================

-- 清空已有数据 (重新初始化)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE users;
TRUNCATE TABLE articles;
TRUNCATE TABLE projects;
TRUNCATE TABLE skills;
TRUNCATE TABLE themes;
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
 '这是一个基于 React + Spring Boot 构建的个人网站',
 '# 欢迎来到我的个人网站\n\n这是一个使用 React 和 Spring Boot 构建的现代化个人网站。\n\n## 特性\n\n- 🎨 精美的用户界面\n- 📝 文章管理系统\n- 💼 项目展示\n- 🛠️ 技能展示\n- 🔐 安全的管理后台',
 '公告', '欢迎,网站', 1, 100, NOW(), NOW()),

('技术栈介绍',
 '介绍本网站使用的技术栈',
 '# 技术栈介绍\n\n## 前端\n\n- React 18\n- Vite\n- TailwindCSS\n- Framer Motion\n\n## 后端\n\n- Java 21\n- Spring Boot 3.2\n- Spring Security\n- JWT Authentication\n- MySQL Database',
 '技术', 'React,Spring Boot,Java', 1, 0, NOW(), NOW());

-- 项目
INSERT INTO projects (name, description, tech_stack, github_url, featured, display_order, created_at, updated_at)
VALUES
('个人网站',
 '一个现代化的个人网站，展示个人项目、文章和技能',
 'React,Spring Boot,Java 21,TailwindCSS',
 'https://github.com/username/personal-website',
 1, 1, NOW(), NOW()),

('API 网关',
 '高性能的 API 网关服务',
 'Go,Docker,Kubernetes',
 'https://github.com/username/api-gateway',
 1, 2, NOW(), NOW());

-- 技能
INSERT INTO skills (name, category, proficiency, display_order) VALUES
('Java',        '后端',   90, 1),
('Spring Boot', '后端',   88, 2),
('React',       '前端',   85, 3),
('TypeScript',  '前端',   82, 4),
('Go',          '后端',   75, 5),
('Docker',      'DevOps', 80, 6),
('Kubernetes',  'DevOps', 70, 7),
('MySQL',       '数据库', 85, 8),
('Redis',       '数据库', 78, 9);
