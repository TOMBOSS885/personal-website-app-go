package middleware

import (
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"strings"

	"github.com/gin-gonic/gin"
)

func OperationLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			return
		}
		if c.Writer.Status() >= 500 {
			return
		}

		username, _ := c.Get("username")
		action := actionFromRequest(c.Request.Method, c.FullPath())
		_ = repository.CreateOperationLog(&model.OperationLog{
			Username:  stringValue(username),
			Action:    action,
			Method:    c.Request.Method,
			Path:      c.FullPath(),
			Target:    strings.Trim(c.Param("id")+" "+c.Param("name"), " "),
			IP:        c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			Status:    c.Writer.Status(),
			RequestID: GetRequestID(c),
		})
	}
}

func LogOperation(c *gin.Context, username, action, message string, status int) {
	_ = repository.CreateOperationLog(&model.OperationLog{
		Username:  username,
		Action:    action,
		Method:    c.Request.Method,
		Path:      c.FullPath(),
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		Status:    status,
		Message:   message,
		RequestID: GetRequestID(c),
	})
}

func actionFromRequest(method, path string) string {
	path = strings.ToLower(path)
	switch {
	case strings.Contains(path, "article-images"):
		return "upload_article_image"
	case strings.Contains(path, "article-sites"):
		return "upload_article_site"
	case strings.Contains(path, "theme/background-image"):
		if method == "DELETE" {
			return "delete_background_image"
		}
		return "upload_background_image"
	case strings.Contains(path, "profile/avatar"):
		return "upload_avatar"
	case strings.Contains(path, "live2d-models"):
		if method == "DELETE" {
			return "delete_live2d_model"
		}
		return "change_live2d_model"
	case strings.Contains(path, "music"):
		if strings.Contains(path, "lyrics") {
			if method == "DELETE" {
				return "delete_music_lyrics"
			}
			return "upload_music_lyrics"
		}
		if method == "DELETE" {
			return "delete_music"
		}
		if method == "PATCH" || method == "PUT" {
			return "save_music_settings"
		}
		return "upload_music"
	case strings.Contains(path, "articles"):
		if method == "DELETE" {
			return "delete_article"
		}
		return "save_article"
	case strings.Contains(path, "projects"):
		if method == "DELETE" {
			return "delete_project"
		}
		return "save_project"
	case strings.Contains(path, "skills"):
		if method == "DELETE" {
			return "delete_skill"
		}
		return "save_skill"
	case strings.Contains(path, "feature-cards"):
		if method == "DELETE" {
			return "delete_feature_card"
		}
		return "save_feature_card"
	case strings.Contains(path, "theme"):
		return "save_theme"
	case strings.Contains(path, "profile"):
		return "save_profile"
	case strings.Contains(path, "account/password"):
		return "change_password"
	case strings.Contains(path, "upload-settings"):
		return "save_upload_settings"
	case strings.Contains(path, "client-download"):
		return "save_client_download"
	default:
		return strings.ToLower(method)
	}
}

func stringValue(value interface{}) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}
