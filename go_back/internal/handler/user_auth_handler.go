package handler

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/mailer"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	maxEmailLength         = 254
	maxCodeAttempts        = 5
	emailCodeCooldown      = 60 * time.Second
	emailCodeHourlyLimit   = 6
	emailCodeIPHourlyLimit = 30
	emailCodeRegister      = "register"
	emailCodeResetPassword = "reset"
)

var usernamePattern = regexp.MustCompile(`^[\p{L}\p{N}_-]{2,30}$`)

var dummyUserPasswordHash = func() []byte {
	hash, err := bcrypt.GenerateFromPassword([]byte("invalid-user-password"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	return hash
}()

var emailCodeProcessNonce = func() []byte {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		panic(err)
	}
	return nonce
}()

type localEmailCode struct {
	Hash      string
	ExpiresAt time.Time
	Attempts  int
	Consumed  bool
}

type emailCodeRequestReservation struct {
	EmailIdentity string
	IPIdentity    string
	RequestedAt   time.Time
	RedisToken    string
	RedisPending  bool
	LocalRecorded bool
}

var localEmailCodes = struct {
	sync.Mutex
	entries  map[string]localEmailCode
	requests map[string][]time.Time
}{entries: make(map[string]localEmailCode), requests: make(map[string][]time.Time)}

var allowEmailCodeRequestScript = redis.NewScript(`
local cooldownTTL = redis.call('PTTL', KEYS[1])
if cooldownTTL > 0 then
  return {0, cooldownTTL}
end

local emailCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local ipCount = tonumber(redis.call('GET', KEYS[3]) or '0')
if emailCount >= tonumber(ARGV[2]) or ipCount >= tonumber(ARGV[3]) then
  local retryTTL = 0
  if emailCount >= tonumber(ARGV[2]) then
    local ttl = redis.call('PTTL', KEYS[2])
    if ttl <= 0 then
      ttl = tonumber(ARGV[4])
      redis.call('PEXPIRE', KEYS[2], ttl)
    end
    retryTTL = ttl
  end
  if ipCount >= tonumber(ARGV[3]) then
    local ttl = redis.call('PTTL', KEYS[3])
    if ttl <= 0 then
      ttl = tonumber(ARGV[4])
      redis.call('PEXPIRE', KEYS[3], ttl)
    end
    if ttl > retryTTL then retryTTL = ttl end
  end
  return {0, retryTTL}
end

redis.call('SET', KEYS[1], ARGV[5], 'PX', ARGV[1])
emailCount = redis.call('INCR', KEYS[2])
ipCount = redis.call('INCR', KEYS[3])
if emailCount == 1 or redis.call('PTTL', KEYS[2]) <= 0 then
  redis.call('PEXPIRE', KEYS[2], ARGV[4])
end
if ipCount == 1 or redis.call('PTTL', KEYS[3]) <= 0 then
  redis.call('PEXPIRE', KEYS[3], ARGV[4])
end
return {1, tonumber(ARGV[1])}
`)

var rollbackEmailCodeRequestScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
for index = 2, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[index]) or '0')
  if count <= 1 then
    redis.call('DEL', KEYS[index])
  else
    redis.call('DECR', KEYS[index])
  end
end
return 1
`)

func RequestUserEmailCode(c *gin.Context) {
	var req struct {
		Email   string `json:"email" binding:"required"`
		Purpose string `json:"purpose"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入有效邮箱")
		return
	}
	email, err := normalizeEmail(req.Email)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "请输入有效邮箱")
		return
	}
	purpose, err := normalizeEmailCodePurpose(req.Purpose)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "验证码用途无效")
		return
	}
	existing, findErr := repository.GetUserByEmail(email)
	if purpose == emailCodeRegister {
		if findErr == nil && existing != nil {
			response.Error(c, http.StatusConflict, "该邮箱已经注册，请直接登录或重设密码")
			return
		}
		if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
			response.Error(c, http.StatusInternalServerError, "账号状态检查失败")
			return
		}
	} else {
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			response.Error(c, http.StatusNotFound, "该邮箱尚未注册")
			return
		}
		if findErr != nil || existing == nil {
			response.Error(c, http.StatusInternalServerError, "账号状态检查失败")
			return
		}
		if strings.ToUpper(strings.TrimSpace(existing.Role)) == "ADMIN" {
			response.Error(c, http.StatusForbidden, "管理员账号请在后台管理密码")
			return
		}
		if strings.EqualFold(strings.TrimSpace(existing.Status), "disabled") {
			response.Error(c, http.StatusForbidden, "账号已被停用")
			return
		}
	}
	if !mailer.Configured() {
		response.Error(c, http.StatusServiceUnavailable, "邮件服务尚未配置，请联系站点管理员")
		return
	}
	allowed, retryAfter, reservation := allowEmailCodeRequest(c.ClientIP(), email)
	if !allowed {
		retrySeconds := int64((retryAfter + time.Second - 1) / time.Second)
		if retrySeconds < 1 {
			retrySeconds = 1
		}
		c.Header("Retry-After", strconv.FormatInt(retrySeconds, 10))
		c.JSON(http.StatusTooManyRequests, gin.H{
			"message":    "验证码发送过于频繁，请稍后再试",
			"retryAfter": retrySeconds,
		})
		return
	}
	code, err := generateSixDigitCode()
	if err != nil {
		rollbackEmailCodeRequest(reservation)
		response.Error(c, http.StatusInternalServerError, "验证码生成失败")
		return
	}
	ttl := time.Duration(config.AppConfig.EmailCodeTTLSeconds) * time.Second
	hash := hashEmailCode(email, purpose, code)
	if err := storeEmailCode(email, purpose, hash, ttl); err != nil {
		rollbackEmailCodeRequest(reservation)
		response.Error(c, http.StatusServiceUnavailable, "验证码服务暂时不可用")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	if err := mailer.SendLoginCode(ctx, email, code, ttl); err != nil {
		deleteEmailCode(email, purpose)
		rollbackEmailCodeRequest(reservation)
		log.Printf("send user login code failed for %s: %v", maskedEmail(email), err)
		response.Error(c, http.StatusBadGateway, "验证码邮件发送失败，请稍后重试")
		return
	}
	response.Success(c, gin.H{"message": "验证码已发送", "purpose": purpose, "expiresIn": int(ttl.Seconds())})
}

func RegisterUserByEmailCode(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Code     string `json:"code" binding:"required"`
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入邮箱、验证码、用户名和密码")
		return
	}
	email, err := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	username := strings.TrimSpace(req.Username)
	if err != nil || len(code) != 6 || !usernamePattern.MatchString(username) || !validUserPassword(req.Password) {
		response.Error(c, http.StatusBadRequest, "注册信息格式错误，密码需为 8-72 字节")
		return
	}
	if _, err := repository.GetUserByEmail(email); err == nil {
		response.Error(c, http.StatusConflict, "该邮箱已经注册")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		response.Error(c, http.StatusInternalServerError, "账号状态检查失败")
		return
	}
	exists, err := repository.UsernameExists(username, 0)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "用户名检查失败")
		return
	}
	if exists {
		response.Error(c, http.StatusConflict, "用户名已被使用")
		return
	}
	result := verifyEmailCode(email, emailCodeRegister, hashEmailCode(email, emailCodeRegister, code))
	if result <= 0 {
		message := "验证码错误"
		if result == -1 {
			message = "验证码已失效，请重新获取"
		} else if result == -2 {
			message = "验证码错误次数过多，请重新获取"
		}
		response.Error(c, http.StatusUnauthorized, message)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "密码设置失败")
		return
	}
	user := &model.User{
		Username: username, Email: email, Password: string(passwordHash), PasswordConfigured: true,
		Role: "USER", Status: "active", EmailVerified: true, TokenVersion: 1,
		Nickname: username, CoffeeCount: 0, StarsCount: 0,
	}
	if err := repository.CreateUser(user); err != nil {
		response.Error(c, http.StatusConflict, "邮箱或用户名已被使用")
		return
	}
	if _, ok := completeUserLogin(c, user, "register", "邮箱验证后完成注册", true); !ok {
		return
	}
	response.Success(c, publicUser(user))
}

func LoginUserByPassword(c *gin.Context) {
	user, ok := authenticateUserPassword(c)
	if !ok {
		return
	}
	if _, ok := completeUserLogin(c, user, "login", "用户名或邮箱密码登录", true); !ok {
		return
	}
	response.Success(c, publicUser(user))
}

func LoginDesktopUserByPassword(c *gin.Context) {
	user, ok := authenticateUserPassword(c)
	if !ok {
		return
	}
	session, ok := completeUserLogin(c, user, "desktop_login", "桌面客户端密码登录", false)
	if !ok {
		return
	}
	response.Success(c, newDesktopLoginResponse(session, user))
}

type desktopLoginResponse struct {
	AccessToken string `json:"accessToken"`
	TokenType   string `json:"tokenType"`
	ExpiresAt   string `json:"expiresAt"`
	ExpiresIn   int64  `json:"expiresIn"`
	User        gin.H  `json:"user"`
}

func newDesktopLoginResponse(session middleware.UserAccessToken, user *model.User) desktopLoginResponse {
	return desktopLoginResponse{
		AccessToken: session.Token,
		TokenType:   "Bearer",
		ExpiresAt:   session.ExpiresAt.UTC().Format(time.RFC3339),
		ExpiresIn:   int64(session.ExpiresAt.Sub(session.IssuedAt) / time.Second),
		User:        publicUser(user),
	}
}

func authenticateUserPassword(c *gin.Context) (*model.User, bool) {
	var req struct {
		Identifier string `json:"identifier" binding:"required"`
		Password   string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入用户名或邮箱和密码")
		return nil, false
	}
	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" || len(identifier) > 254 || len([]byte(req.Password)) == 0 || len([]byte(req.Password)) > 72 {
		response.Error(c, http.StatusBadRequest, "用户名、邮箱或密码格式错误")
		return nil, false
	}
	user, findErr := repository.GetMemberUserByIdentifier(identifier)
	lookupFailed := findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound)
	loginIdentity := identifier
	passwordHash := dummyUserPasswordHash
	eligible := findErr == nil && user != nil
	if user != nil {
		loginIdentity = fmt.Sprintf("member:%d", user.ID)
		if user.PasswordConfigured && strings.TrimSpace(user.Password) != "" {
			passwordHash = []byte(user.Password)
		} else {
			eligible = false
		}
		if strings.EqualFold(strings.TrimSpace(user.Status), "disabled") {
			eligible = false
		}
	}
	if !middleware.AllowLoginAttempt(c.ClientIP(), loginIdentity) {
		response.Error(c, http.StatusTooManyRequests, "登录失败次数过多，请稍后再试")
		return nil, false
	}
	passwordMatches := bcrypt.CompareHashAndPassword(passwordHash, []byte(req.Password)) == nil
	if lookupFailed {
		response.Error(c, http.StatusInternalServerError, "登录服务暂时不可用")
		return nil, false
	}
	if !passwordMatches || !eligible {
		middleware.RecordLoginFailure(c.ClientIP(), loginIdentity)
		response.Error(c, http.StatusUnauthorized, "用户名、邮箱或密码错误")
		return nil, false
	}
	middleware.RecordLoginSuccess(c.ClientIP(), loginIdentity)
	return user, true
}

func ResetUserPasswordByEmailCode(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入邮箱、验证码和新密码")
		return
	}
	email, err := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	if err != nil || len(code) != 6 || !validUserPassword(req.Password) {
		response.Error(c, http.StatusBadRequest, "重设信息格式错误，密码需为 8-72 字节")
		return
	}
	user, err := repository.GetUserByEmail(email)
	if err != nil || user == nil || strings.ToUpper(strings.TrimSpace(user.Role)) == "ADMIN" {
		response.Error(c, http.StatusNotFound, "普通用户账号不存在")
		return
	}
	if strings.EqualFold(strings.TrimSpace(user.Status), "disabled") {
		response.Error(c, http.StatusForbidden, "账号已被停用")
		return
	}
	result := verifyEmailCode(email, emailCodeResetPassword, hashEmailCode(email, emailCodeResetPassword, code))
	if result <= 0 {
		message := "验证码错误"
		if result == -1 {
			message = "验证码已失效，请重新获取"
		} else if result == -2 {
			message = "验证码错误次数过多，请重新获取"
		}
		response.Error(c, http.StatusUnauthorized, message)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "密码设置失败")
		return
	}
	rows, err := repository.ResetActiveMemberPassword(user.ID, string(hash))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "密码保存失败")
		return
	}
	if rows == 0 {
		response.Error(c, http.StatusForbidden, "账号状态已变化")
		return
	}
	middleware.ClearUserSessionCookie(c)
	recordUserActivity(c, user, "reset_password", "account", "邮箱验证码重设密码")
	response.Success(c, gin.H{"message": "密码已设置，请使用新密码登录"})
}

func completeUserLogin(c *gin.Context, user *model.User, action, detail string, setCookie bool) (middleware.UserAccessToken, bool) {
	now := time.Now()
	if err := repository.RecordUserLogin(user.ID, now); err != nil {
		response.Error(c, http.StatusInternalServerError, "登录状态保存失败")
		return middleware.UserAccessToken{}, false
	}
	user.LastLoginAt, user.LastActiveAt = &now, &now
	user.LoginCount++
	session, err := middleware.GenerateUserAccessToken(user)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "登录会话生成失败")
		return middleware.UserAccessToken{}, false
	}
	if setCookie {
		middleware.SetUserSessionCookie(c, session.Token)
	}
	recordUserActivity(c, user, action, "account", detail)
	return session, true
}

func GetCurrentUser(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	response.Success(c, publicUser(user))
}

func LogoutUser(c *gin.Context) {
	if user, ok := middleware.CurrentUser(c); ok {
		_ = repository.RevokeUserSessions(user.ID)
		recordUserActivity(c, user, "logout", "account", "退出登录")
	}
	middleware.ClearUserSessionCookie(c)
	response.Success(c, gin.H{"message": "已退出登录"})
}

func UpdateCurrentUsername(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	var req struct {
		Username string `json:"username" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入用户名")
		return
	}
	username := strings.TrimSpace(req.Username)
	if !usernamePattern.MatchString(username) {
		response.Error(c, http.StatusBadRequest, "用户名需为 2-30 位文字、字母、数字、下划线或短横线")
		return
	}
	exists, err := repository.UsernameExists(username, user.ID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "用户名检查失败")
		return
	}
	if exists {
		response.Error(c, http.StatusConflict, "用户名已被使用")
		return
	}
	old := user.Username
	rows, err := repository.UpdateActiveMemberUsername(user.ID, user.TokenVersion, username)
	if err != nil {
		response.Error(c, http.StatusConflict, "用户名已被使用")
		return
	}
	if rows == 0 {
		response.Error(c, http.StatusForbidden, "账号状态已变化，请重新登录")
		return
	}
	user.Username = username
	recordUserActivity(c, user, "change_username", "account", old+" -> "+username)
	response.Success(c, publicUser(user))
}

func publicUser(user *model.User) gin.H {
	return gin.H{
		"id": user.ID, "username": user.Username, "email": user.Email,
		"status": user.Status, "passwordConfigured": user.PasswordConfigured,
		"createdAt": user.CreatedAt, "lastActiveAt": user.LastActiveAt,
	}
}

func recordUserActivity(c *gin.Context, user *model.User, action, resource, detail string) {
	if user == nil {
		return
	}
	_ = repository.CreateUserActivity(&model.UserActivity{
		UserID: user.ID, Action: action, Resource: resource, Detail: detail,
		IP: c.ClientIP(), UserAgent: c.Request.UserAgent(),
	})
}

func normalizeEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || len(value) > maxEmailLength || strings.ContainsAny(value, "\r\n") {
		return "", errors.New("invalid email")
	}
	address, err := mail.ParseAddress(value)
	if err != nil || strings.ToLower(address.Address) != value || !strings.Contains(value, "@") {
		return "", errors.New("invalid email")
	}
	return value, nil
}

func normalizeEmailCodePurpose(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", emailCodeRegister:
		return emailCodeRegister, nil
	case emailCodeResetPassword:
		return emailCodeResetPassword, nil
	default:
		return "", errors.New("invalid email code purpose")
	}
}

func validUserPassword(value string) bool {
	length := len([]byte(value))
	if length < 8 || length > 72 {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func generateSixDigitCode() (string, error) {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	n := (uint32(bytes[0])<<24 | uint32(bytes[1])<<16 | uint32(bytes[2])<<8 | uint32(bytes[3])) % 1000000
	return fmt.Sprintf("%06d", n), nil
}

func hashEmailCode(email, purpose, code string) string {
	mac := hmac.New(sha256.New, []byte(config.AppConfig.JWTSecret))
	_, _ = mac.Write(emailCodeProcessNonce)
	_, _ = mac.Write([]byte(email + "|" + purpose + "|" + code))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func emailCodeKey(email, purpose string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(email) + "|" + purpose))
	return base64.RawURLEncoding.EncodeToString(sum[:18])
}

func hashedIdentity(value string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(value))))
	return base64.RawURLEncoding.EncodeToString(sum[:18])
}

func storeEmailCode(email, purpose, hash string, ttl time.Duration) error {
	key := emailCodeKey(email, purpose)
	localEmailCodes.Lock()
	defer localEmailCodes.Unlock()
	cleanupLocalEmailCodesLocked(time.Now())
	if len(localEmailCodes.entries) >= 20000 {
		if _, replacing := localEmailCodes.entries[key]; !replacing {
			return errors.New("local email code store full")
		}
	}
	localEmailCodes.entries[key] = localEmailCode{Hash: hash, ExpiresAt: time.Now().Add(ttl)}
	return nil
}

func verifyEmailCode(email, purpose, hash string) int64 {
	key := emailCodeKey(email, purpose)
	now := time.Now()
	localEmailCodes.Lock()
	entry, exists := localEmailCodes.entries[key]
	if exists && !now.Before(entry.ExpiresAt) {
		delete(localEmailCodes.entries, key)
		exists = false
	}
	if exists {
		result := int64(0)
		switch {
		case entry.Consumed:
			result = -1
		case entry.Attempts >= maxCodeAttempts:
			result = -2
		case subtle.ConstantTimeCompare([]byte(entry.Hash), []byte(hash)) != 1:
			entry.Attempts++
			localEmailCodes.entries[key] = entry
			if entry.Attempts >= maxCodeAttempts {
				result = -2
			}
		default:
			entry.Consumed = true
			localEmailCodes.entries[key] = entry
			result = 1
		}
		localEmailCodes.Unlock()
		return result
	}
	localEmailCodes.Unlock()
	return -1
}

func deleteEmailCode(email, purpose string) {
	key := emailCodeKey(email, purpose)
	localEmailCodes.Lock()
	delete(localEmailCodes.entries, key)
	localEmailCodes.Unlock()
}

func allowEmailCodeRequest(ip, email string) (bool, time.Duration, emailCodeRequestReservation) {
	now := time.Now()
	emailIdentity := "email:" + hashedIdentity(email)
	ipIdentity := "ip:" + hashedIdentity(strings.TrimSpace(ip))
	reservation := emailCodeRequestReservation{
		EmailIdentity: emailIdentity,
		IPIdentity:    ipIdentity,
		RequestedAt:   now,
		RedisToken:    uuid.NewString(),
	}
	localEmailCodes.Lock()
	if len(localEmailCodes.requests) >= 20000 {
		for key, times := range localEmailCodes.requests {
			if len(times) == 0 || times[len(times)-1].Before(now.Add(-time.Hour)) {
				delete(localEmailCodes.requests, key)
			}
		}
		if len(localEmailCodes.requests) >= 20000 {
			localEmailCodes.Unlock()
			return false, time.Minute, reservation
		}
	}
	cutoff := now.Add(-time.Hour)
	emailRequests := pruneRequestTimes(localEmailCodes.requests[emailIdentity], cutoff)
	ipRequests := pruneRequestTimes(localEmailCodes.requests[ipIdentity], cutoff)
	if len(emailRequests) > 0 && now.Sub(emailRequests[len(emailRequests)-1]) < emailCodeCooldown {
		localEmailCodes.requests[emailIdentity] = emailRequests
		localEmailCodes.Unlock()
		return false, emailCodeCooldown - now.Sub(emailRequests[len(emailRequests)-1]), reservation
	}
	if len(emailRequests) >= emailCodeHourlyLimit || len(ipRequests) >= emailCodeIPHourlyLimit {
		localEmailCodes.requests[emailIdentity] = emailRequests
		localEmailCodes.requests[ipIdentity] = ipRequests
		retryAfter := time.Duration(0)
		if len(emailRequests) >= emailCodeHourlyLimit {
			retryAfter = time.Until(emailRequests[0].Add(time.Hour))
		}
		if len(ipRequests) >= emailCodeIPHourlyLimit {
			ipRetryAfter := time.Until(ipRequests[0].Add(time.Hour))
			if ipRetryAfter > retryAfter {
				retryAfter = ipRetryAfter
			}
		}
		localEmailCodes.Unlock()
		return false, retryAfter, reservation
	}
	localEmailCodes.requests[emailIdentity] = append(emailRequests, now)
	localEmailCodes.requests[ipIdentity] = append(ipRequests, now)
	reservation.LocalRecorded = true
	localEmailCodes.Unlock()

	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		result, err := allowEmailCodeRequestScript.Run(ctx, cache.Client, []string{
			"auth:email-cooldown:" + emailIdentity,
			"auth:email-hour:" + emailIdentity,
			"auth:email-hour:" + ipIdentity,
		}, emailCodeCooldown.Milliseconds(), emailCodeHourlyLimit, emailCodeIPHourlyLimit, time.Hour.Milliseconds(), reservation.RedisToken).Int64Slice()
		cancel()
		if err == nil && len(result) == 2 {
			cache.MarkSuccess()
			retryAfter := time.Duration(result[1]) * time.Millisecond
			if retryAfter < 0 {
				retryAfter = 0
			}
			if result[0] == 1 {
				reservation.RedisPending = true
				return true, retryAfter, reservation
			}
			rollbackLocalEmailCodeRequest(reservation)
			reservation.LocalRecorded = false
			return false, retryAfter, reservation
		}
		if err != nil {
			cache.MarkFailure(err)
			reservation.RedisPending = true
		} else if len(result) != 2 {
			cache.MarkFailure(redis.ErrClosed)
			reservation.RedisPending = true
		}
	}
	return true, emailCodeCooldown, reservation
}

func rollbackEmailCodeRequest(reservation emailCodeRequestReservation) {
	if reservation.RedisPending && cache.Client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		_, err := rollbackEmailCodeRequestScript.Run(ctx, cache.Client, []string{
			"auth:email-cooldown:" + reservation.EmailIdentity,
			"auth:email-hour:" + reservation.EmailIdentity,
			"auth:email-hour:" + reservation.IPIdentity,
		}, reservation.RedisToken).Result()
		cancel()
		if err == nil {
			cache.MarkSuccess()
		} else {
			cache.MarkFailure(err)
		}
	}
	if reservation.LocalRecorded {
		rollbackLocalEmailCodeRequest(reservation)
	}
}

func rollbackLocalEmailCodeRequest(reservation emailCodeRequestReservation) {
	localEmailCodes.Lock()
	localEmailCodes.requests[reservation.EmailIdentity] = removeRequestAt(localEmailCodes.requests[reservation.EmailIdentity], reservation.RequestedAt)
	localEmailCodes.requests[reservation.IPIdentity] = removeRequestAt(localEmailCodes.requests[reservation.IPIdentity], reservation.RequestedAt)
	if len(localEmailCodes.requests[reservation.EmailIdentity]) == 0 {
		delete(localEmailCodes.requests, reservation.EmailIdentity)
	}
	if len(localEmailCodes.requests[reservation.IPIdentity]) == 0 {
		delete(localEmailCodes.requests, reservation.IPIdentity)
	}
	localEmailCodes.Unlock()
}

func removeRequestAt(requests []time.Time, requestedAt time.Time) []time.Time {
	for index := len(requests) - 1; index >= 0; index-- {
		if requests[index].Equal(requestedAt) {
			return append(requests[:index], requests[index+1:]...)
		}
	}
	return requests
}

func pruneRequestTimes(values []time.Time, cutoff time.Time) []time.Time {
	filtered := values[:0]
	for _, at := range values {
		if at.After(cutoff) {
			filtered = append(filtered, at)
		}
	}
	return filtered
}

func cleanupLocalEmailCodesLocked(now time.Time) {
	for key, entry := range localEmailCodes.entries {
		if !now.Before(entry.ExpiresAt) {
			delete(localEmailCodes.entries, key)
		}
	}
}

func maskedEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || len(parts[0]) < 2 {
		return "***"
	}
	return parts[0][:1] + "***@" + parts[1]
}
