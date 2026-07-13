-- Safe, non-destructive database bootstrap for MySQL 8.0+.
--
-- This script intentionally does not create, truncate, or seed application
-- tables. The Go service manages the current schema through GORM AutoMigrate
-- and creates an administrator only when one does not already exist.
-- Running this file against an existing deployment is therefore harmless.

CREATE DATABASE IF NOT EXISTS personal_website
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE personal_website;
