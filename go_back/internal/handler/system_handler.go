package handler

import (
	"net/http"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/response"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	APIServiceName        = "personal-website-api"
	APIVersion            = 1
	MinimumDesktopVersion = "0.1.0"
)

type adminIdentity struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

func Meta(c *gin.Context) {
	response.Success(c, gin.H{
		"service":           APIServiceName,
		"apiVersion":        APIVersion,
		"minDesktopVersion": MinimumDesktopVersion,
		"serverTime":        time.Now().UTC().Format(time.RFC3339),
	})
}

func AdminSession(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid admin session")
		return
	}
	session, ok := middleware.CurrentAdminSession(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid admin session")
		return
	}

	response.Success(c, gin.H{
		"user": adminIdentity{
			ID:       user.ID,
			Username: user.Username,
			Role:     strings.ToUpper(strings.TrimSpace(user.Role)),
			Nickname: user.Nickname,
			Avatar:   user.Avatar,
		},
		"session": session,
	})
}
