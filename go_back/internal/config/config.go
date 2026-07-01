package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort  string
	MySQLDSN    string
	JWTSecret   string
	JWTExpireMs int64
	UploadDir   string
	GinMode     string
}

var AppConfig *Config

func InitConfig() {
	// 尝试加载 .env 文件，如果失败则静默（可能在生产环境直接使用环境变量）
	_ = godotenv.Load()

	serverPort := getEnv("SERVER_PORT", "8080")
	mysqlHost := getEnv("MYSQL_HOST", "127.0.0.1")
	mysqlPort := getEnv("MYSQL_PORT", "3306")
	mysqlDatabase := getEnv("MYSQL_DATABASE", "personal_website")
	mysqlUsername := getEnv("MYSQL_USERNAME", "root")
	mysqlPassword := getEnv("MYSQL_PASSWORD", "")

	// 构建 DSN
	dsn := mysqlUsername + ":" + mysqlPassword + "@tcp(" + mysqlHost + ":" + mysqlPort + ")/" + mysqlDatabase + "?charset=utf8mb4&parseTime=true&loc=Local"

	jwtExpireMs, err := strconv.ParseInt(getEnv("JWT_EXPIRATION", "86400000"), 10, 64)
	if err != nil {
		log.Printf("Invalid JWT_EXPIRATION, using default 86400000: %v", err)
		jwtExpireMs = 86400000
	}

	AppConfig = &Config{
		ServerPort:  serverPort,
		MySQLDSN:    dsn,
		JWTSecret:   getEnv("JWT_SECRET", "please-change-this-secret-key-at-least-32-chars"),
		JWTExpireMs: jwtExpireMs,
		UploadDir:   getEnv("APP_UPLOAD_DIR", "uploads"),
		GinMode:     getEnv("GIN_MODE", "debug"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
