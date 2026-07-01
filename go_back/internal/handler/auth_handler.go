package handler

import (
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

	user, err := repository.GetUserByUsername(req.Username)
	if err != nil || user == nil {
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "用户名或密码错误")
		return
	}

	token, err := middleware.GenerateToken(user.Username)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Token 生成失败")
		return
	}

	response.Success(c, gin.H{"token": token})
}
