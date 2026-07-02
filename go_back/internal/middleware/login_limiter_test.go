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
