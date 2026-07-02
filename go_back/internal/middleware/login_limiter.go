package middleware

import (
	"strings"
	"sync"
	"time"
)

const (
	loginLimitWindow   = 10 * time.Minute
	loginLimitMaxFails = 5
)

type loginAttempt struct {
	Failures int
	ResetAt  time.Time
}

var loginAttempts = struct {
	sync.Mutex
	entries map[string]loginAttempt
}{
	entries: map[string]loginAttempt{},
}

func AllowLoginAttempt(ip, username string) bool {
	key := loginAttemptKey(ip, username)
	now := time.Now()

	loginAttempts.Lock()
	defer loginAttempts.Unlock()

	entry, exists := loginAttempts.entries[key]
	if !exists || now.After(entry.ResetAt) {
		delete(loginAttempts.entries, key)
		return true
	}
	return entry.Failures < loginLimitMaxFails
}

func RecordLoginFailure(ip, username string) {
	key := loginAttemptKey(ip, username)
	now := time.Now()

	loginAttempts.Lock()
	defer loginAttempts.Unlock()

	entry, exists := loginAttempts.entries[key]
	if !exists || now.After(entry.ResetAt) {
		entry = loginAttempt{ResetAt: now.Add(loginLimitWindow)}
	}
	entry.Failures++
	loginAttempts.entries[key] = entry
}

func RecordLoginSuccess(ip, username string) {
	key := loginAttemptKey(ip, username)
	loginAttempts.Lock()
	defer loginAttempts.Unlock()
	delete(loginAttempts.entries, key)
}

func loginAttemptKey(ip, username string) string {
	return strings.TrimSpace(ip) + "|" + strings.ToLower(strings.TrimSpace(username))
}
