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
	ServerHost           string
	ServerPort           string
	MySQLDSN             string
	JWTSecret            string
	JWTExpireMs          int64
	UploadDir            string
	GinMode              string
	CORSAllowedOrigins   string
	AutoMigrate          bool
	AdminUsername        string
	AdminPassword        string
	AdminEmail           string
	AdminResetPassword   bool
	RedisEnabled         bool
	RedisAddr            string
	RedisPassword        string
	RedisDB              int
	CacheEnabled         bool
	CacheTTLSeconds      int
	RateLimitEnabled     bool
	PublicRateLimit      int
	MusicRateLimit       int
	MusicStreamRateLimit int
	LoginLimitMaxFails   int
	LoginLimitWindow     int
	MediaSignSecret      string
	MediaURLTTLSeconds   int
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
		ServerPort:           getEnv("SERVER_PORT", "8080"),
		ServerHost:           getEnv("SERVER_HOST", "0.0.0.0"),
		MySQLDSN:             buildMySQLDSN(),
		JWTSecret:            getEnv("JWT_SECRET", "please-change-this-secret-key-at-least-32-chars"),
		JWTExpireMs:          jwtExpireMs,
		UploadDir:            getEnv("APP_UPLOAD_DIR", "uploads"),
		GinMode:              getEnv("GIN_MODE", "debug"),
		CORSAllowedOrigins:   getEnv("CORS_ALLOWED_ORIGINS", "*"),
		AutoMigrate:          boolEnv("AUTO_MIGRATE", true),
		AdminUsername:        getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:        getEnv("ADMIN_PASSWORD", "admin123"),
		AdminEmail:           getEnv("ADMIN_EMAIL", "admin@example.com"),
		AdminResetPassword:   boolEnv("ADMIN_RESET_PASSWORD", false),
		RedisEnabled:         boolEnv("REDIS_ENABLED", false),
		RedisAddr:            getEnv("REDIS_ADDR", "127.0.0.1:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RedisDB:              intEnv("REDIS_DB", 0),
		CacheEnabled:         boolEnv("CACHE_ENABLED", true),
		CacheTTLSeconds:      intEnv("CACHE_TTL_SECONDS", 60),
		RateLimitEnabled:     boolEnv("RATE_LIMIT_ENABLED", true),
		PublicRateLimit:      intEnv("PUBLIC_RATE_LIMIT_PER_MINUTE", 180),
		MusicRateLimit:       intEnv("MUSIC_RATE_LIMIT_PER_MINUTE", 90),
		MusicStreamRateLimit: intEnv("MUSIC_STREAM_RATE_LIMIT_PER_MINUTE", 240),
		LoginLimitMaxFails:   intEnv("LOGIN_LIMIT_MAX_FAILS", 5),
		LoginLimitWindow:     intEnv("LOGIN_LIMIT_WINDOW_SECONDS", 600),
		MediaSignSecret:      getEnv("MEDIA_SIGN_SECRET", ""),
		MediaURLTTLSeconds:   intEnv("MEDIA_URL_TTL_SECONDS", 600),
	}
	validateProductionConfig(AppConfig)
}

func validateProductionConfig(cfg *Config) {
	if cfg.GinMode != "release" {
		return
	}
	if isShortOrDefaultJWTSecret(cfg.JWTSecret) {
		log.Fatal("JWT_SECRET must be set to a unique value with at least 32 characters in release mode")
	}
	if isPlaceholderJWTSecret(cfg.JWTSecret) {
		log.Println("warning: JWT_SECRET still looks like a placeholder; replace it with a real random secret before public deployment")
	}
	if isUnsafeAdminPassword(cfg.AdminPassword) && cfg.AdminResetPassword {
		log.Fatal("refusing to reset the admin password to an unsafe default or placeholder value in release mode")
	}
	if isUnsafeAdminPassword(cfg.AdminPassword) {
		log.Println("warning: ADMIN_PASSWORD still looks unsafe; it is only used when creating or explicitly resetting the admin account")
	}
	if strings.TrimSpace(cfg.CORSAllowedOrigins) == "*" {
		log.Println("warning: CORS_ALLOWED_ORIGINS is '*'; leave it empty for same-origin deployment or list explicit origins")
	}
}

func isShortOrDefaultJWTSecret(secret string) bool {
	secret = strings.TrimSpace(secret)
	return len(secret) < 32 || secret == "please-change-this-secret-key-at-least-32-chars"
}

func isPlaceholderJWTSecret(secret string) bool {
	secret = strings.TrimSpace(secret)
	return secret == "replace_with_a_random_secret_at_least_32_chars"
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

func intEnv(key string, fallback int) int {
	value, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		log.Printf("invalid integer env %s=%q, using default %d", key, value, fallback)
		return fallback
	}
	return parsed
}
