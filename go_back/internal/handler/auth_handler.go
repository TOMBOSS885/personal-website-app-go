package handler

import (
	"log"
	"net/http"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"

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
	if !middleware.AllowLoginAttempt(c.ClientIP(), req.Username) {
		response.Error(c, http.StatusTooManyRequests, "登录失败次数过多，请稍后再试")
		return
	}

	user, err := repository.GetUserByUsername(req.Username)
	if err != nil || user == nil {
		log.Printf("login failed for username=%q: user not found", req.Username)
		middleware.RecordLoginFailure(c.ClientIP(), req.Username)
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		log.Printf("login failed for username=%q: password mismatch", req.Username)
		middleware.RecordLoginFailure(c.ClientIP(), req.Username)
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	middleware.RecordLoginSuccess(c.ClientIP(), req.Username)

	token, err := middleware.GenerateToken(user.Username)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Token 生成失败")
		return
	}
	response.Success(c, gin.H{"token": token})
}
