package handler

import (
	"personal-website-go/internal/config"
	"strings"
	"testing"
	"time"
)

func TestNormalizeEmail(t *testing.T) {
	valid, err := normalizeEmail(" User@Example.COM ")
	if err != nil || valid != "user@example.com" {
		t.Fatalf("normalizeEmail() = %q, %v", valid, err)
	}
	for _, value := range []string{"", "not-an-email", "a@example.com\r\nBcc:x@y.com"} {
		if _, err := normalizeEmail(value); err == nil {
			t.Fatalf("normalizeEmail(%q) should fail", value)
		}
	}
}

func TestEmailCodeHashIsBoundToEmail(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: strings.Repeat("x", 32)}
	t.Cleanup(func() { config.AppConfig = previous })

	first := hashEmailCode("a@example.com", emailCodeRegister, "123456")
	if first == "" || first != hashEmailCode("a@example.com", emailCodeRegister, "123456") {
		t.Fatal("email code hash must be deterministic")
	}
	if first == hashEmailCode("b@example.com", emailCodeRegister, "123456") {
		t.Fatal("email code hash must be bound to the email address")
	}
	if first == hashEmailCode("a@example.com", emailCodeResetPassword, "123456") {
		t.Fatal("email code hash must be bound to its purpose")
	}
}

func TestValidUserPassword(t *testing.T) {
	for _, value := range []string{"password", "密码password"} {
		if !validUserPassword(value) {
			t.Fatalf("validUserPassword(%q) should pass", value)
		}
	}
	for _, value := range []string{"short", strings.Repeat("a", 73), "password\n"} {
		if validUserPassword(value) {
			t.Fatalf("validUserPassword(%q) should fail", value)
		}
	}
}

func TestLocalEmailCodeResendReplacesPreviousCode(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: strings.Repeat("x", 32)}
	t.Cleanup(func() { config.AppConfig = previous })

	localEmailCodes.Lock()
	previousEntries := localEmailCodes.entries
	previousRequests := localEmailCodes.requests
	localEmailCodes.entries = make(map[string]localEmailCode)
	localEmailCodes.requests = make(map[string][]time.Time)
	localEmailCodes.Unlock()
	t.Cleanup(func() {
		localEmailCodes.Lock()
		localEmailCodes.entries = previousEntries
		localEmailCodes.requests = previousRequests
		localEmailCodes.Unlock()
	})

	email := "resend@example.com"
	first := hashEmailCode(email, emailCodeRegister, "123456")
	second := hashEmailCode(email, emailCodeRegister, "654321")
	if err := storeEmailCode(email, emailCodeRegister, first, time.Minute); err != nil {
		t.Fatalf("store first email code: %v", err)
	}
	if err := storeEmailCode(email, emailCodeRegister, second, time.Minute); err != nil {
		t.Fatalf("store replacement email code: %v", err)
	}
	if result := verifyEmailCode(email, emailCodeRegister, first); result != 0 {
		t.Fatalf("old email code should fail after resend, got %d", result)
	}
	if result := verifyEmailCode(email, emailCodeRegister, second); result != 1 {
		t.Fatalf("replacement email code should pass, got %d", result)
	}
	if result := verifyEmailCode(email, emailCodeRegister, second); result != -1 {
		t.Fatalf("consumed email code should not be reusable, got %d", result)
	}
}

func TestLocalEmailCodeAttemptLimitKeepsLatestCodeBlocked(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: strings.Repeat("x", 32)}
	t.Cleanup(func() { config.AppConfig = previous })

	localEmailCodes.Lock()
	previousEntries := localEmailCodes.entries
	localEmailCodes.entries = make(map[string]localEmailCode)
	localEmailCodes.Unlock()
	t.Cleanup(func() {
		localEmailCodes.Lock()
		localEmailCodes.entries = previousEntries
		localEmailCodes.Unlock()
	})

	email := "attempt-limit@example.com"
	correct := hashEmailCode(email, emailCodeRegister, "123456")
	wrong := hashEmailCode(email, emailCodeRegister, "654321")
	if err := storeEmailCode(email, emailCodeRegister, correct, time.Minute); err != nil {
		t.Fatalf("store email code: %v", err)
	}
	for attempt := 1; attempt <= maxCodeAttempts; attempt++ {
		result := verifyEmailCode(email, emailCodeRegister, wrong)
		if attempt < maxCodeAttempts && result != 0 {
			t.Fatalf("wrong attempt %d should be rejected, got %d", attempt, result)
		}
		if attempt == maxCodeAttempts && result != -2 {
			t.Fatalf("last wrong attempt should block the code, got %d", result)
		}
	}
	if result := verifyEmailCode(email, emailCodeRegister, correct); result != -2 {
		t.Fatalf("blocked latest code should stay blocked until expiry, got %d", result)
	}
}

func TestLocalEmailCodeRequestRollbackAllowsImmediateRetry(t *testing.T) {
	localEmailCodes.Lock()
	previousEntries := localEmailCodes.entries
	previousRequests := localEmailCodes.requests
	localEmailCodes.entries = make(map[string]localEmailCode)
	localEmailCodes.requests = make(map[string][]time.Time)
	localEmailCodes.Unlock()
	t.Cleanup(func() {
		localEmailCodes.Lock()
		localEmailCodes.entries = previousEntries
		localEmailCodes.requests = previousRequests
		localEmailCodes.Unlock()
	})

	ip := "203.0.113.10"
	email := "retry@example.com"
	allowed, _, reservation := allowEmailCodeRequest(ip, email)
	if !allowed {
		t.Fatal("first email code request should pass")
	}
	if allowed, retryAfter, _ := allowEmailCodeRequest(ip, email); allowed || retryAfter <= 0 {
		t.Fatal("second immediate email code request should hit cooldown")
	}
	rollbackEmailCodeRequest(reservation)
	if allowed, _, _ := allowEmailCodeRequest(ip, email); !allowed {
		t.Fatal("retry should pass immediately after a failed send is rolled back")
	}
}

func TestLocalEmailCodeHourlyLimitDoesNotExtendOnRejectedRetry(t *testing.T) {
	localEmailCodes.Lock()
	previousEntries := localEmailCodes.entries
	previousRequests := localEmailCodes.requests
	localEmailCodes.entries = make(map[string]localEmailCode)
	localEmailCodes.requests = make(map[string][]time.Time)
	localEmailCodes.Unlock()
	t.Cleanup(func() {
		localEmailCodes.Lock()
		localEmailCodes.entries = previousEntries
		localEmailCodes.requests = previousRequests
		localEmailCodes.Unlock()
	})

	ip := "203.0.113.11"
	email := "hour-limit@example.com"
	emailIdentity := "email:" + hashedIdentity(email)
	ipIdentity := "ip:" + hashedIdentity(ip)
	startedAt := time.Now().Add(-30 * time.Minute)
	requests := make([]time.Time, emailCodeHourlyLimit)
	for index := range requests {
		requests[index] = startedAt.Add(time.Duration(index) * time.Minute)
	}
	localEmailCodes.Lock()
	localEmailCodes.requests[emailIdentity] = append([]time.Time(nil), requests...)
	localEmailCodes.requests[ipIdentity] = append([]time.Time(nil), requests...)
	localEmailCodes.Unlock()

	allowed, firstRetryAfter, _ := allowEmailCodeRequest(ip, email)
	if allowed || firstRetryAfter <= 0 {
		t.Fatal("hourly limited request should be rejected with a retry duration")
	}
	allowed, secondRetryAfter, _ := allowEmailCodeRequest(ip, email)
	if allowed {
		t.Fatal("repeated hourly limited request should remain rejected")
	}
	if secondRetryAfter > firstRetryAfter+time.Second {
		t.Fatalf("rejected retry extended the lockout: first=%v second=%v", firstRetryAfter, secondRetryAfter)
	}
	localEmailCodes.Lock()
	count := len(localEmailCodes.requests[emailIdentity])
	localEmailCodes.Unlock()
	if count != emailCodeHourlyLimit {
		t.Fatalf("rejected retry changed the hourly request count: got %d", count)
	}
}

func TestNormalizeCommentContent(t *testing.T) {
	if got, err := normalizeCommentContent("  hello\nworld  "); err != nil || got != "hello\nworld" {
		t.Fatalf("normalizeCommentContent() = %q, %v", got, err)
	}
	if _, err := normalizeCommentContent(""); err == nil {
		t.Fatal("empty comment should fail")
	}
	if _, err := normalizeCommentContent(strings.Repeat("a", maxCommentRunes+1)); err == nil {
		t.Fatal("oversized comment should fail")
	}
}
