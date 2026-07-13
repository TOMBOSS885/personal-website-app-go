package handler

import (
	"context"
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
	c.Header("Cache-Control", "no-store")
	checks := gin.H{
		"http":     "up",
		"database": "unknown",
		"uploads":  "unknown",
		"redis":    "disabled",
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()
	if err := db.DB.WithContext(ctx).Exec("SELECT 1").Error; err != nil {
		checks["database"] = "down"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "down",
			"checks": checks,
			"error":  "database check failed",
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
			"error":  "upload directory check failed",
		})
		return
	}

	testPath := filepath.Join(uploadDir, ".healthcheck")
	if err := os.WriteFile(testPath, []byte("ok"), 0644); err != nil {
		checks["uploads"] = "down"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "down",
			"checks": checks,
			"error":  "upload write check failed",
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
