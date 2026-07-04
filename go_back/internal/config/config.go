package config

import (
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerHost         string
	ServerPort         string
	MySQLDSN           string
	JWTSecret          string
	JWTExpireMs        int64
	UploadDir          string
	GinMode            string
	CORSAllowedOrigins string
	AutoMigrate        bool
	AdminUsername      string
	AdminPassword      string
	AdminEmail         string
	AdminResetPassword bool
}

var AppConfig *Config

func InitConfig() {
	_ = godotenv.Load(".env", "../.env")

	jwtExpireMs, err := strconv.ParseInt(getEnv("JWT_EXPIRATION", "86400000"), 10, 64)
	if err != nil {
		log.Printf("invalid JWT_EXPIRATION, using default 86400000: %v", err)
		jwtExpireMs = 86400000
	}

	AppConfig = &Config{
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		ServerHost:         getEnv("SERVER_HOST", "0.0.0.0"),
		MySQLDSN:           buildMySQLDSN(),
		JWTSecret:          getEnv("JWT_SECRET", "please-change-this-secret-key-at-least-32-chars"),
		JWTExpireMs:        jwtExpireMs,
		UploadDir:          getEnv("APP_UPLOAD_DIR", "uploads"),
		GinMode:            getEnv("GIN_MODE", "debug"),
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "*"),
		AutoMigrate:        boolEnv("AUTO_MIGRATE", true),
		AdminUsername:      getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:      getEnv("ADMIN_PASSWORD", "admin123"),
		AdminEmail:         getEnv("ADMIN_EMAIL", "admin@example.com"),
		AdminResetPassword: boolEnv("ADMIN_RESET_PASSWORD", false),
	}
	validateProductionConfig(AppConfig)
}

func validateProductionConfig(cfg *Config) {
	if cfg.GinMode != "release" {
		return
	}
	if isUnsafeJWTSecret(cfg.JWTSecret) {
		log.Fatal("JWT_SECRET must be set to a unique value with at least 32 characters in release mode")
	}
	if isUnsafeAdminPassword(cfg.AdminPassword) {
		log.Fatal("ADMIN_PASSWORD must be changed from the default or placeholder value in release mode")
	}
	if strings.TrimSpace(cfg.CORSAllowedOrigins) == "*" {
		log.Fatal("CORS_ALLOWED_ORIGINS cannot be '*' in release mode; leave it empty for same-origin or list explicit origins")
	}
}

func isUnsafeJWTSecret(secret string) bool {
	secret = strings.TrimSpace(secret)
	if len(secret) < 32 {
		return true
	}
	switch secret {
	case "please-change-this-secret-key-at-least-32-chars",
		"replace_with_a_random_secret_at_least_32_chars":
		return true
	default:
		return false
	}
}

func isUnsafeAdminPassword(password string) bool {
	password = strings.TrimSpace(password)
	if password == "" {
		return true
	}
	switch password {
	case "admin", "admin123", "password", "123456", "replace_with_initial_admin_password":
		return true
	default:
		return false
	}
}

func buildMySQLDSN() string {
	if dsn := os.Getenv("MYSQL_DSN"); dsn != "" {
		return dsn
	}

	username := getEnv("MYSQL_USERNAME", "root")
	password := getEnv("MYSQL_PASSWORD", "")
	host := getEnv("MYSQL_HOST", "127.0.0.1")
	port := getEnv("MYSQL_PORT", "3306")
	database := getEnv("MYSQL_DATABASE", "personal_website")
	loc := url.QueryEscape(getEnv("MYSQL_LOC", "Asia/Shanghai"))

	return username + ":" + password + "@tcp(" + host + ":" + port + ")/" + database +
		"?charset=utf8mb4&parseTime=true&loc=" + loc
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func boolEnv(key string, fallback bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		log.Printf("invalid boolean env %s=%q, using default %v", key, value, fallback)
		return fallback
	}
}
