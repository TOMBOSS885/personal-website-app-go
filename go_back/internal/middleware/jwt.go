package middleware

import (
	"errors"
	"net/http"
	"personal-website-go/internal/config"
	"personal-website-go/internal/response"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func GenerateToken(username string) (string, error) {
	claims := jwt.MapClaims{
		"sub": username,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Duration(config.AppConfig.JWTExpireMs) * time.Millisecond).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "未登录或 token 无效")
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(config.AppConfig.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			response.Error(c, http.StatusUnauthorized, "未登录或 token 无效")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "未登录或 token 无效")
			c.Abort()
			return
		}
		username, _ := claims["sub"].(string)
		if username == "" {
			response.Error(c, http.StatusUnauthorized, "未登录或 token 无效")
			c.Abort()
			return
		}
		c.Set("username", username)
		c.Next()
	}
}
