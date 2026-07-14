package handler

import (
	"context"
	"log"
	"net/http"
	"personal-website-go/internal/config"
	"personal-website-go/internal/mailer"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Code     string `json:"code"`
}

const (
	adminLoginIPLookback = 90 * 24 * time.Hour
	emailCodeAdminLogin  = "admin-login"
)

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
	req.Username = user.Username

	ip := c.ClientIP()
	knownIP, err := repository.IsKnownAdminLoginIP(user.Username, ip, time.Now().Add(-adminLoginIPLookback))
	if err != nil {
		log.Printf("admin login IP check failed for username=%q: %v", req.Username, err)
		response.Error(c, http.StatusInternalServerError, "登录安全检查暂时不可用")
		return
	}
	if !knownIP {
		if !verifyUncommonAdminLogin(c, user.EmailPublic, req) {
			return
		}
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

func verifyUncommonAdminLogin(c *gin.Context, publicEmail string, req LoginRequest) bool {
	email, err := normalizeEmail(publicEmail)
	if err != nil {
		message := "检测到不常用 IP，但站长公开邮箱未正确配置"
		middleware.RecordAdminLogin2FAEvent(c, req.Username, "login_2fa_failed", message)
		middleware.LogOperation(c, req.Username, "login_2fa_failed", message, http.StatusServiceUnavailable)
		response.Error(c, http.StatusServiceUnavailable, "站长公开邮箱尚未配置或格式无效，请先在后台资料中设置")
		return false
	}
	purpose := adminLoginCodePurpose(c.ClientIP())
	code := strings.TrimSpace(req.Code)
	if code == "" {
		if !mailer.Configured() {
			message := "检测到不常用 IP，但 SMTP 邮件服务未配置"
			middleware.RecordAdminLogin2FAEvent(c, req.Username, "login_2fa_failed", message)
			middleware.LogOperation(c, req.Username, "login_2fa_failed", message, http.StatusServiceUnavailable)
			response.Error(c, http.StatusServiceUnavailable, "邮件服务尚未配置，无法完成后台安全验证")
			return false
		}
		return sendAdminLoginCode(c, req.Username, email, purpose)
	}
	if len(code) != 6 || strings.Trim(code, "0123456789") != "" {
		recordAdminLoginCodeFailure(c, req.Username, "邮箱验证码格式错误")
		response.Error(c, http.StatusUnauthorized, "请输入 6 位数字验证码")
		return false
	}

	result := verifyEmailCode(email, purpose, hashEmailCode(email, purpose, code))
	if result != 1 {
		message := "邮箱验证码错误或已失效"
		if result == -2 {
			message = "邮箱验证码错误次数过多，当前验证码已失效"
		}
		recordAdminLoginCodeFailure(c, req.Username, message)
		response.Error(c, http.StatusUnauthorized, message)
		return false
	}

	message := "不常用 IP 登录的邮箱验证已通过"
	middleware.RecordAdminLogin2FAEvent(c, req.Username, "login_2fa_success", message)
	middleware.LogOperation(c, req.Username, "login_2fa_success", message, http.StatusOK)
	return true
}

func sendAdminLoginCode(c *gin.Context, username, email, purpose string) bool {
	allowed, retryAfter, reservation := allowEmailCodeRequest(c.ClientIP(), email)
	if !allowed {
		retrySeconds := int64((retryAfter + time.Second - 1) / time.Second)
		if retrySeconds < 1 {
			retrySeconds = 1
		}
		c.Header("Retry-After", strconv.FormatInt(retrySeconds, 10))
		c.JSON(http.StatusTooManyRequests, gin.H{
			"verificationRequired": true,
			"maskedEmail":          maskedEmail(email),
			"message":              "验证码发送过于频繁，请稍后再试",
			"retryAfter":           retrySeconds,
		})
		return false
	}

	code, err := generateSixDigitCode()
	if err != nil {
		rollbackEmailCodeRequest(reservation)
		response.Error(c, http.StatusInternalServerError, "验证码生成失败")
		return false
	}
	ttl := time.Duration(config.AppConfig.EmailCodeTTLSeconds) * time.Second
	if err := storeEmailCode(email, purpose, hashEmailCode(email, purpose, code), ttl); err != nil {
		rollbackEmailCodeRequest(reservation)
		response.Error(c, http.StatusServiceUnavailable, "验证码服务暂时不可用")
		return false
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	if err := mailer.SendAdminLoginCode(ctx, email, code, c.ClientIP(), ttl); err != nil {
		deleteEmailCode(email, purpose)
		rollbackEmailCodeRequest(reservation)
		log.Printf("send admin login code failed for %s: %v", maskedEmail(email), err)
		message := "不常用 IP 登录验证码邮件发送失败"
		middleware.RecordAdminLogin2FAEvent(c, username, "login_2fa_failed", message)
		middleware.LogOperation(c, username, "login_2fa_failed", message, http.StatusBadGateway)
		response.Error(c, http.StatusBadGateway, "验证码邮件发送失败，请稍后重试")
		return false
	}

	message := "检测到不常用 IP，已向站长公开邮箱发送验证码"
	middleware.RecordAdminLogin2FAEvent(c, username, "login_2fa_required", message)
	middleware.LogOperation(c, username, "login_2fa_required", message, http.StatusAccepted)
	c.JSON(http.StatusAccepted, gin.H{
		"verificationRequired": true,
		"maskedEmail":          maskedEmail(email),
		"expiresIn":            int(ttl.Seconds()),
		"message":              "检测到不常用的登录 IP，验证码已发送",
	})
	return false
}

func recordAdminLoginCodeFailure(c *gin.Context, username, message string) {
	middleware.RecordAdminLogin2FAEvent(c, username, "login_2fa_failed", message)
	middleware.LogOperation(c, username, "login_2fa_failed", message, http.StatusUnauthorized)
}

func adminLoginCodePurpose(ip string) string {
	return emailCodeAdminLogin + ":" + hashedIdentity(ip)
}
