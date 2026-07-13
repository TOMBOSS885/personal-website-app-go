package middleware

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const jwtIssuer = "personal-website-admin"
const jwtAudience = "personal-website-admin-api"

type adminClaims struct {
	UserID              uint64 `json:"uid"`
	Role                string `json:"role"`
	PasswordFingerprint string `json:"pwd"`
	jwt.RegisteredClaims
}

func GenerateToken(user *model.User) (string, error) {
	if user == nil || strings.TrimSpace(user.Username) == "" {
		return "", errors.New("cannot generate a token for an empty user")
	}
	now := time.Now()
	claims := adminClaims{
		UserID:              user.ID,
		Role:                strings.ToUpper(strings.TrimSpace(user.Role)),
		PasswordFingerprint: passwordFingerprint(user.Password),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtAudience},
			Subject:   user.Username,
			ID:        uuid.NewString(),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-5 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(config.AppConfig.JWTExpireMs) * time.Millisecond)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			unauthorized(c, "未登录或 token 无效")
			return
		}

		claims := &adminClaims{}
		token, err := jwt.ParseWithClaims(strings.TrimPrefix(authHeader, "Bearer "), claims, func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(config.AppConfig.JWTSecret), nil
		}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(jwtIssuer), jwt.WithAudience(jwtAudience), jwt.WithExpirationRequired())
		if err != nil || !token.Valid {
			unauthorized(c, "未登录或 token 无效")
			return
		}

		username := strings.TrimSpace(claims.Subject)
		if username == "" {
			unauthorized(c, "未登录或 token 无效")
			return
		}
		user, err := repository.GetUserByUsername(username)
		if err != nil || user == nil {
			unauthorized(c, "登录状态已失效")
			return
		}
		role := strings.ToUpper(strings.TrimSpace(user.Role))
		if role == "" && user.Username == config.AppConfig.AdminUsername {
			user.Role = "ADMIN"
			if err := repository.UpdateUser(user); err == nil {
				role = "ADMIN"
			}
		}
		if claims.UserID != user.ID || role != "ADMIN" || strings.ToUpper(strings.TrimSpace(claims.Role)) != "ADMIN" ||
			claims.PasswordFingerprint == "" || claims.PasswordFingerprint != passwordFingerprint(user.Password) {
			unauthorized(c, "登录状态已失效")
			return
		}

		c.Set("username", username)
		c.Set("user", user)
		c.Next()
	}
}

func unauthorized(c *gin.Context, message string) {
	response.Error(c, http.StatusUnauthorized, message)
	c.Abort()
}

func passwordFingerprint(passwordHash string) string {
	sum := sha256.Sum256([]byte(passwordHash))
	return base64.RawURLEncoding.EncodeToString(sum[:16])
}
