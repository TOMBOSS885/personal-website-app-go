package handler

import (
	"log"
	"net/http"
	"personal-website-go/internal/config"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || len(req.Username) > 255 || len(req.Password) > 72 {
		response.Error(c, http.StatusBadRequest, "用户名或密码格式错误")
		return
	}

	if !middleware.AllowLoginAttempt(c.ClientIP(), req.Username) {
		middleware.LogOperation(c, req.Username, "login_blocked", "too many failed attempts", http.StatusTooManyRequests)
		middleware.WriteTooManyLogin(c, req.Username)
		return
	}

	user, err := repository.GetUserByUsername(req.Username)
	if err != nil || user == nil {
		log.Printf("login failed for username=%q: user not found", req.Username)
		middleware.RecordLoginFailure(c.ClientIP(), req.Username)
		middleware.RecordLoginSecurityEvent(c, req.Username, false, "user not found")
		middleware.LogOperation(c, req.Username, "login_failed", "user not found", http.StatusUnauthorized)
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		log.Printf("login failed for username=%q: password mismatch", req.Username)
		middleware.RecordLoginFailure(c.ClientIP(), req.Username)
		middleware.RecordLoginSecurityEvent(c, req.Username, false, "password mismatch")
		middleware.LogOperation(c, req.Username, "login_failed", "password mismatch", http.StatusUnauthorized)
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	role := strings.ToUpper(strings.TrimSpace(user.Role))
	if role == "" && user.Username == config.AppConfig.AdminUsername {
		user.Role = "ADMIN"
		if err := repository.UpdateUser(user); err != nil {
			response.Error(c, http.StatusInternalServerError, "账号状态更新失败")
			return
		}
		role = "ADMIN"
	}
	if role != "ADMIN" {
		middleware.RecordLoginFailure(c.ClientIP(), req.Username)
		response.Error(c, http.StatusUnauthorized, "该账号无后台访问权限")
		return
	}

	middleware.RecordLoginSuccess(c.ClientIP(), req.Username)
	middleware.RecordLoginSecurityEvent(c, req.Username, true, "login success")
	middleware.LogOperation(c, req.Username, "login_success", "", http.StatusOK)

	token, err := middleware.GenerateToken(user)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Token 生成失败")
		return
	}
	response.Success(c, gin.H{"token": token})
}
