package middleware

import "testing"

func TestLoginLimiterBlocksAfterFailuresAndClearsOnSuccess(t *testing.T) {
	loginAttempts.Lock()
	loginAttempts.entries = map[string]loginAttempt{}
	loginAttempts.Unlock()

	ip := "192.0.2.10"
	username := "Admin"

	for i := 0; i < loginLimitMaxFails; i++ {
		if !AllowLoginAttempt(ip, username) {
			t.Fatalf("attempt %d was blocked before the limit", i+1)
		}
		RecordLoginFailure(ip, username)
	}

	if AllowLoginAttempt(ip, username) {
		t.Fatal("login attempt was allowed after the failure limit")
	}

	RecordLoginSuccess(ip, username)
	if !AllowLoginAttempt(ip, username) {
		t.Fatal("login attempt stayed blocked after a successful login reset")
	}
}

func TestLoginLimiterAlsoBlocksUsernameRotationFromSameIP(t *testing.T) {
	loginAttempts.Lock()
	loginAttempts.entries = map[string]loginAttempt{}
	loginAttempts.Unlock()

	ip := "192.0.2.20"
	for i := 0; i < loginLimitMaxFails; i++ {
		RecordLoginFailure(ip, "user"+string(rune('a'+i)))
	}
	if AllowLoginAttempt(ip, "different-user") {
		t.Fatal("rotating usernames bypassed the per-IP login limit")
	}
}

func TestLoginLimiterBlocksDistributedAccountAttack(t *testing.T) {
	loginAttempts.Lock()
	loginAttempts.entries = map[string]loginAttempt{}
	loginAttempts.Unlock()

	username := "admin"
	for i := 0; i < loginLimitMaxFails*5; i++ {
		RecordLoginFailure("192.0.2."+string(rune(30+i)), username)
	}
	if AllowLoginAttempt("198.51.100.10", username) {
		t.Fatal("distributed IPs bypassed the account login limit")
	}
}
