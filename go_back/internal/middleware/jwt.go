package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const jwtIssuer = "personal-website-admin"
const jwtAudience = "personal-website-admin-api"
const userJWTIssuer = "personal-website-user"
const userJWTAudience = "personal-website-user-api"
const UserSessionCookie = "pw_user_session"

type adminClaims struct {
	UserID              uint64 `json:"uid"`
	Role                string `json:"role"`
	PasswordFingerprint string `json:"pwd"`
	jwt.RegisteredClaims
}

type userClaims struct {
	UserID       uint64 `json:"uid"`
	Role         string `json:"role"`
	TokenVersion uint64 `json:"ver"`
	jwt.RegisteredClaims
}

var activeTouchCache = struct {
	sync.Mutex
	entries map[uint64]time.Time
}{entries: make(map[uint64]time.Time)}

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

func GenerateUserToken(user *model.User) (string, error) {
	if user == nil || user.ID == 0 || strings.TrimSpace(user.Email) == "" {
		return "", errors.New("cannot generate a token for an empty user")
	}
	now := time.Now()
	version := user.TokenVersion
	if version == 0 {
		version = 1
	}
	claims := userClaims{
		UserID:       user.ID,
		Role:         "USER",
		TokenVersion: version,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    userJWTIssuer,
			Audience:  jwt.ClaimStrings{userJWTAudience},
			Subject:   strings.ToLower(strings.TrimSpace(user.Email)),
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

func OptionalUserAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if user, err := authenticateUser(c); err == nil && user != nil {
			setCurrentUser(c, user)
		}
		c.Next()
	}
}

func UserAuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		user, err := authenticateUser(c)
		if err != nil || user == nil {
			unauthorized(c, "请先登录后再继续")
			return
		}
		if !isSameOriginMutation(c) {
			response.Error(c, http.StatusForbidden, "请求来源无效")
			c.Abort()
			return
		}
		setCurrentUser(c, user)
		c.Next()
	}
}

func SameOriginMutation() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isSameOriginMutation(c) {
			response.Error(c, http.StatusForbidden, "请求来源无效")
			c.Abort()
			return
		}
		c.Next()
	}
}

func PublicMediaAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.EqualFold(strings.TrimSpace(c.Query("scope")), "admin") {
			c.Next()
			return
		}
		user, err := authenticateUser(c)
		if err != nil || user == nil {
			unauthorized(c, "登录后才能使用音乐功能")
			return
		}
		setCurrentUser(c, user)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) (*model.User, bool) {
	value, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := value.(*model.User)
	return user, ok && user != nil
}

func SetUserSessionCookie(c *gin.Context, token string) {
	secure := c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
	c.SetSameSite(http.SameSiteStrictMode)
	maxAge := int(time.Duration(config.AppConfig.JWTExpireMs) * time.Millisecond / time.Second)
	c.SetCookie(UserSessionCookie, token, maxAge, "/api", "", secure, true)
}

func ClearUserSessionCookie(c *gin.Context) {
	secure := c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(UserSessionCookie, "", -1, "/api", "", secure, true)
}

func authenticateUser(c *gin.Context) (*model.User, error) {
	raw, err := c.Cookie(UserSessionCookie)
	if err != nil || strings.TrimSpace(raw) == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			raw = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		}
	}
	if raw == "" {
		return nil, errors.New("missing user session")
	}
	claims := &userClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.AppConfig.JWTSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(userJWTIssuer), jwt.WithAudience(userJWTAudience), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || claims.UserID == 0 || strings.ToUpper(claims.Role) != "USER" {
		return nil, errors.New("invalid user session")
	}
	user, err := repository.GetUserByEmail(claims.Subject)
	if err != nil || user == nil || user.ID != claims.UserID {
		return nil, errors.New("user not found")
	}
	if strings.ToLower(strings.TrimSpace(user.Status)) != "active" || strings.ToUpper(strings.TrimSpace(user.Role)) == "ADMIN" {
		return nil, errors.New("user disabled")
	}
	version := user.TokenVersion
	if version == 0 {
		version = 1
	}
	if claims.TokenVersion != version {
		return nil, errors.New("session revoked")
	}
	return user, nil
}

func setCurrentUser(c *gin.Context, user *model.User) {
	c.Set("user", user)
	c.Set("userID", user.ID)
	c.Set("username", user.Username)
	markUserActive(user.ID)
}

func markUserActive(userID uint64) {
	if userID == 0 {
		return
	}
	now := time.Now()
	activeTouchCache.Lock()
	if next, ok := activeTouchCache.entries[userID]; ok && now.Before(next) {
		activeTouchCache.Unlock()
		return
	}
	if len(activeTouchCache.entries) > 20000 {
		for id, expiry := range activeTouchCache.entries {
			if !now.Before(expiry) {
				delete(activeTouchCache.entries, id)
			}
		}
	}
	activeTouchCache.entries[userID] = now.Add(2 * time.Minute)
	activeTouchCache.Unlock()

	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		ok, err := cache.Client.SetNX(ctx, "user:active:"+base64.RawURLEncoding.EncodeToString([]byte(claimID(userID))), "1", 2*time.Minute).Result()
		cancel()
		if err == nil && !ok {
			return
		}
	}
	_ = repository.TouchUserActivity(userID, now)
}

func claimID(id uint64) string {
	return string([]byte{
		byte(id >> 56), byte(id >> 48), byte(id >> 40), byte(id >> 32),
		byte(id >> 24), byte(id >> 16), byte(id >> 8), byte(id),
	})
}

func isSameOriginMutation(c *gin.Context) bool {
	if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
		return true
	}
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if origin != "" {
		return requestOriginMatches(origin, c.Request.Host)
	}
	referer := strings.TrimSpace(c.GetHeader("Referer"))
	if referer != "" {
		return requestOriginMatches(referer, c.Request.Host)
	}
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("Sec-Fetch-Site")), "same-origin") {
		return true
	}
	// Non-browser API clients may use a user bearer token instead of a Cookie.
	_, cookieErr := c.Cookie(UserSessionCookie)
	return cookieErr != nil && strings.HasPrefix(c.GetHeader("Authorization"), "Bearer ")
}

func requestOriginMatches(raw, host string) bool {
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return false
	}
	return strings.EqualFold(parsed.Host, host)
}

func unauthorized(c *gin.Context, message string) {
	response.Error(c, http.StatusUnauthorized, message)
	c.Abort()
}

func passwordFingerprint(passwordHash string) string {
	sum := sha256.Sum256([]byte(passwordHash))
	return base64.RawURLEncoding.EncodeToString(sum[:16])
}
