package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/response"
	"time"

	"github.com/gin-gonic/gin"
)

func Health(c *gin.Context) {
	response.Success(c, gin.H{
		"status": "up",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func FullHealth(c *gin.Context) {
	checks := gin.H{
		"http":     "up",
		"database": "unknown",
		"uploads":  "unknown",
		"redis":    "disabled",
	}

	if err := db.DB.Exec("SELECT 1").Error; err != nil {
		checks["database"] = "down"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "down",
			"checks": checks,
			"error":  err.Error(),
		})
		return
	}
	checks["database"] = "up"

	uploadDir := config.AppConfig.UploadDir
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		checks["uploads"] = "down"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "down",
			"checks": checks,
			"error":  err.Error(),
		})
		return
	}

	testPath := filepath.Join(uploadDir, ".healthcheck")
	if err := os.WriteFile(testPath, []byte("ok"), 0644); err != nil {
		checks["uploads"] = "down"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "down",
			"checks": checks,
			"error":  err.Error(),
		})
		return
	}
	_ = os.Remove(testPath)
	checks["uploads"] = "up"

	if config.AppConfig.RedisEnabled {
		if !cache.Ready() {
			checks["redis"] = "down"
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "down",
				"checks": checks,
				"error":  "redis is enabled but unavailable",
			})
			return
		}
		checks["redis"] = "up"
	}

	response.Success(c, gin.H{
		"status": "up",
		"checks": checks,
		"time":   time.Now().Format(time.RFC3339),
	})
}
