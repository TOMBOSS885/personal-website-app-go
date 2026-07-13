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
	"os"
	"path/filepath"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/mailer"
	"personal-website-go/internal/media"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"regexp"
	"strings"
	"sync"
	"time"

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
	maxUserAvatarBytes     = 500 * 1024
)

var usernamePattern = regexp.MustCompile(`^[\p{L}\p{N}_-]{2,30}$`)

type localEmailCode struct {
	Hash      string
	ExpiresAt time.Time
	Attempts  int
}

var localEmailCodes = struct {
	sync.Mutex
	entries  map[string]localEmailCode
	requests map[string][]time.Time
}{entries: make(map[string]localEmailCode), requests: make(map[string][]time.Time)}

var verifyEmailCodeScript = redis.NewScript(`
local stored = redis.call('GET', KEYS[1])
if not stored then return -1 end
local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
if attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
  return -2
end
if stored ~= ARGV[1] then
  attempts = redis.call('INCR', KEYS[2])
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
  if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) end
  return 0
end
redis.call('DEL', KEYS[1], KEYS[2])
return 1
`)

func RequestUserEmailCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
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
	if !mailer.Configured() {
		response.Error(c, http.StatusServiceUnavailable, "邮件服务尚未配置，请联系站点管理员")
		return
	}
	if !allowEmailCodeRequest(c.ClientIP(), email) {
		response.Error(c, http.StatusTooManyRequests, "验证码发送过于频繁，请稍后再试")
		return
	}
	code, err := generateSixDigitCode()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "验证码生成失败")
		return
	}
	ttl := time.Duration(config.AppConfig.EmailCodeTTLSeconds) * time.Second
	hash := hashEmailCode(email, code)
	if err := storeEmailCode(email, hash, ttl); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "验证码服务暂时不可用")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	if err := mailer.SendLoginCode(ctx, email, code, ttl); err != nil {
		deleteEmailCode(email)
		log.Printf("send user login code failed for %s: %v", maskedEmail(email), err)
		response.Error(c, http.StatusBadGateway, "验证码邮件发送失败，请稍后重试")
		return
	}
	response.Success(c, gin.H{"message": "验证码已发送", "expiresIn": int(ttl.Seconds())})
}

func LoginUserByEmailCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
		Code  string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入邮箱和验证码")
		return
	}
	email, err := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	if err != nil || len(code) != 6 {
		response.Error(c, http.StatusBadRequest, "邮箱或验证码格式错误")
		return
	}
	result := verifyEmailCode(email, hashEmailCode(email, code))
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

	user, err := repository.GetUserByEmail(email)
	created := false
	if errors.Is(err, gorm.ErrRecordNotFound) {
		user, err = createEmailUser(email)
		created = err == nil
	}
	if err != nil || user == nil {
		response.Error(c, http.StatusInternalServerError, "登录失败")
		return
	}
	if strings.ToUpper(strings.TrimSpace(user.Role)) == "ADMIN" {
		response.Error(c, http.StatusForbidden, "管理员账号请使用后台登录")
		return
	}
	if strings.EqualFold(strings.TrimSpace(user.Status), "disabled") {
		response.Error(c, http.StatusForbidden, "账号已被停用")
		return
	}
	if err := repository.InitializeUserLoginState(user.ID); err != nil {
		response.Error(c, http.StatusInternalServerError, "账户状态更新失败")
		return
	}
	user, err = repository.GetUserByID(user.ID)
	if err != nil || user == nil {
		response.Error(c, http.StatusInternalServerError, "账户状态读取失败")
		return
	}
	if strings.ToUpper(strings.TrimSpace(user.Role)) == "ADMIN" {
		response.Error(c, http.StatusForbidden, "管理员账号请使用后台登录")
		return
	}
	if strings.EqualFold(strings.TrimSpace(user.Status), "disabled") {
		response.Error(c, http.StatusForbidden, "账号已被停用")
		return
	}
	now := time.Now()
	_ = repository.RecordUserLogin(user.ID, now)
	user.LastLoginAt, user.LastActiveAt = &now, &now
	user.LoginCount++
	token, err := middleware.GenerateUserToken(user)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "登录会话生成失败")
		return
	}
	middleware.SetUserSessionCookie(c, token)
	if created {
		recordUserActivity(c, user, "register", "account", "邮箱验证后自动注册")
	}
	recordUserActivity(c, user, "login", "account", "邮箱验证码登录")
	response.Success(c, publicUser(user))
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

func UploadCurrentUserAvatar(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	settings := getOrCreateUploadSettings()
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请选择头像图片")
		return
	}
	if file.Size > bytesFromMB(settings.AvatarImageMaxMB) {
		response.Error(c, http.StatusBadRequest, "头像原图超过上传限制")
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, avatarImageExts) {
		response.Error(c, http.StatusBadRequest, "头像仅支持 JPG、PNG 和 WebP")
		return
	}
	contentType, err := detectUploadedContentType(file)
	if err != nil || !avatarImageTypes[contentType] || !imageTypeMatchesExtension(ext, contentType) {
		response.Error(c, http.StatusBadRequest, "头像图片格式无效")
		return
	}
	if err := validateUploadedImageDimensions(file, settings.AvatarMinDimension, settings.AvatarMaxDimension, settings.AvatarMaxPixels); err != nil {
		response.Error(c, http.StatusBadRequest, "头像尺寸无效")
		return
	}
	dir := filepath.Join(config.AppConfig.UploadDir, "user-avatars")
	base := fmt.Sprintf("u%d-%s", user.ID, uuid.NewString())
	rawTarget := filepath.Join(dir, base+"-raw"+ext)
	if err := saveUploadedFile(c, file, dir, rawTarget); err != nil {
		response.Error(c, http.StatusInternalServerError, "头像上传失败")
		return
	}
	defer os.Remove(rawTarget)
	name := base + ".jpg"
	target := filepath.Join(dir, name)
	result, err := media.GenerateSquareJPEGUnderLimit(rawTarget, target, 512, maxUserAvatarBytes)
	if err != nil || result.Size > maxUserAvatarBytes {
		_ = os.Remove(target)
		response.Error(c, http.StatusInternalServerError, "头像压缩失败")
		return
	}
	oldAvatar := user.Avatar
	avatar := "/uploads/user-avatars/" + name
	rows, err := repository.UpdateActiveMemberAvatar(user.ID, user.TokenVersion, avatar)
	if err != nil {
		_ = os.Remove(target)
		response.Error(c, http.StatusInternalServerError, "头像保存失败")
		return
	}
	if rows == 0 {
		_ = os.Remove(target)
		response.Error(c, http.StatusForbidden, "账号状态已变化，请重新登录")
		return
	}
	user.Avatar = avatar
	removeUserAvatar(oldAvatar, user.ID)
	recordUserActivity(c, user, "upload_avatar", "account", fmt.Sprintf("头像已压缩至 %d KB", (result.Size+1023)/1024))
	response.Success(c, publicUser(user))
}

func createEmailUser(email string) (*model.User, error) {
	username, err := generateUniqueUsername(email)
	if err != nil {
		return nil, err
	}
	randomPassword := make([]byte, 32)
	if _, err := rand.Read(randomPassword); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(base64.RawURLEncoding.EncodeToString(randomPassword)), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &model.User{
		Username: username, Email: email, Password: string(hash), Role: "USER", Status: "active",
		EmailVerified: true, TokenVersion: 1, Nickname: username, CoffeeCount: 0, StarsCount: 0,
	}
	if err := repository.CreateUser(user); err != nil {
		if existing, findErr := repository.GetUserByEmail(email); findErr == nil {
			return existing, nil
		}
		return nil, err
	}
	return user, nil
}

func generateUniqueUsername(email string) (string, error) {
	local := strings.Split(email, "@")[0]
	var cleaned strings.Builder
	for _, r := range local {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			cleaned.WriteRune(r)
		}
	}
	base := strings.Trim(cleaned.String(), "_-")
	if len(base) < 2 {
		base = "user"
	}
	if len(base) > 20 {
		base = base[:20]
	}
	for i := 0; i < 10; i++ {
		suffix := strings.ReplaceAll(uuid.NewString()[:8], "-", "")
		candidate := base + "-" + suffix
		exists, err := repository.UsernameExists(candidate, 0)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", errors.New("unable to allocate username")
}

func publicUser(user *model.User) gin.H {
	return gin.H{
		"id": user.ID, "username": user.Username, "email": user.Email, "avatar": user.Avatar,
		"status": user.Status, "createdAt": user.CreatedAt, "lastActiveAt": user.LastActiveAt,
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

func generateSixDigitCode() (string, error) {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	n := (uint32(bytes[0])<<24 | uint32(bytes[1])<<16 | uint32(bytes[2])<<8 | uint32(bytes[3])) % 1000000
	return fmt.Sprintf("%06d", n), nil
}

func hashEmailCode(email, code string) string {
	mac := hmac.New(sha256.New, []byte(config.AppConfig.JWTSecret))
	_, _ = mac.Write([]byte(email + "|" + code))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func emailCodeKey(email string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(email)))
	return base64.RawURLEncoding.EncodeToString(sum[:18])
}

func storeEmailCode(email, hash string, ttl time.Duration) error {
	key := emailCodeKey(email)
	storedInRedis := false
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		pipe := cache.Client.TxPipeline()
		pipe.Set(ctx, "auth:email-code:"+key, hash, ttl)
		pipe.Del(ctx, "auth:email-attempts:"+key)
		if _, err := pipe.Exec(ctx); err == nil {
			cache.MarkSuccess()
			storedInRedis = true
		} else {
			cache.MarkFailure(err)
		}
	}
	localEmailCodes.Lock()
	defer localEmailCodes.Unlock()
	if storedInRedis {
		delete(localEmailCodes.entries, key)
		return nil
	}
	cleanupLocalEmailCodesLocked(time.Now())
	if len(localEmailCodes.entries) >= 20000 {
		if storedInRedis {
			return nil
		}
		return errors.New("local email code store full")
	}
	localEmailCodes.entries[key] = localEmailCode{Hash: hash, ExpiresAt: time.Now().Add(ttl)}
	return nil
}

func verifyEmailCode(email, hash string) int64 {
	key := emailCodeKey(email)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		result, err := verifyEmailCodeScript.Run(ctx, cache.Client,
			[]string{"auth:email-code:" + key, "auth:email-attempts:" + key},
			hash, maxCodeAttempts, config.AppConfig.EmailCodeTTLSeconds).Int64()
		if err == nil {
			cache.MarkSuccess()
			localEmailCodes.Lock()
			delete(localEmailCodes.entries, key)
			localEmailCodes.Unlock()
			return result
		}
		cache.MarkFailure(err)
	}
	localEmailCodes.Lock()
	defer localEmailCodes.Unlock()
	entry, ok := localEmailCodes.entries[key]
	if !ok || time.Now().After(entry.ExpiresAt) {
		delete(localEmailCodes.entries, key)
		return -1
	}
	if entry.Attempts >= maxCodeAttempts {
		delete(localEmailCodes.entries, key)
		return -2
	}
	if subtle.ConstantTimeCompare([]byte(entry.Hash), []byte(hash)) != 1 {
		entry.Attempts++
		if entry.Attempts >= maxCodeAttempts {
			delete(localEmailCodes.entries, key)
			return -2
		}
		localEmailCodes.entries[key] = entry
		return 0
	}
	delete(localEmailCodes.entries, key)
	return 1
}

func deleteEmailCode(email string) {
	key := emailCodeKey(email)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		_ = cache.Client.Del(ctx, "auth:email-code:"+key, "auth:email-attempts:"+key).Err()
		cancel()
	}
	localEmailCodes.Lock()
	delete(localEmailCodes.entries, key)
	localEmailCodes.Unlock()
}

func allowEmailCodeRequest(ip, email string) bool {
	now := time.Now()
	emailIdentity := "email:" + emailCodeKey(email)
	ipIdentity := "ip:" + emailCodeKey(strings.TrimSpace(ip))
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		cooldownKey := "auth:email-cooldown:" + emailIdentity
		ok, err := cache.Client.SetNX(ctx, cooldownKey, "1", emailCodeCooldown).Result()
		if err == nil && !ok {
			return false
		}
		if err == nil {
			emailHourKey := "auth:email-hour:" + emailIdentity
			ipHourKey := "auth:email-hour:" + ipIdentity
			pipe := cache.Client.TxPipeline()
			emailCountCmd := pipe.Incr(ctx, emailHourKey)
			ipCountCmd := pipe.Incr(ctx, ipHourKey)
			pipe.Expire(ctx, emailHourKey, time.Hour)
			pipe.Expire(ctx, ipHourKey, time.Hour)
			if _, incrErr := pipe.Exec(ctx); incrErr == nil {
				return emailCountCmd.Val() <= emailCodeHourlyLimit && ipCountCmd.Val() <= emailCodeIPHourlyLimit
			}
		}
	}
	localEmailCodes.Lock()
	defer localEmailCodes.Unlock()
	if len(localEmailCodes.requests) >= 20000 {
		for key, times := range localEmailCodes.requests {
			if len(times) == 0 || times[len(times)-1].Before(now.Add(-time.Hour)) {
				delete(localEmailCodes.requests, key)
			}
		}
		if len(localEmailCodes.requests) >= 20000 {
			return false
		}
	}
	cutoff := now.Add(-time.Hour)
	emailRequests := pruneRequestTimes(localEmailCodes.requests[emailIdentity], cutoff)
	ipRequests := pruneRequestTimes(localEmailCodes.requests[ipIdentity], cutoff)
	if len(emailRequests) > 0 && now.Sub(emailRequests[len(emailRequests)-1]) < emailCodeCooldown {
		localEmailCodes.requests[emailIdentity] = emailRequests
		return false
	}
	if len(emailRequests) >= emailCodeHourlyLimit || len(ipRequests) >= emailCodeIPHourlyLimit {
		localEmailCodes.requests[emailIdentity] = emailRequests
		localEmailCodes.requests[ipIdentity] = ipRequests
		return false
	}
	localEmailCodes.requests[emailIdentity] = append(emailRequests, now)
	localEmailCodes.requests[ipIdentity] = append(ipRequests, now)
	return true
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

func removeUserAvatar(avatar string, userID uint64) {
	prefix := "/uploads/user-avatars/u" + fmt.Sprint(userID) + "-"
	if !strings.HasPrefix(avatar, prefix) {
		return
	}
	target := filepath.Join(config.AppConfig.UploadDir, "user-avatars", filepath.Base(avatar))
	_ = os.Remove(target)
}
