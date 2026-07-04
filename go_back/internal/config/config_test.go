package config

import "testing"

func TestShortOrDefaultJWTSecret(t *testing.T) {
	tests := []struct {
		name   string
		secret string
		want   bool
	}{
		{name: "short", secret: "short", want: true},
		{name: "default", secret: "please-change-this-secret-key-at-least-32-chars", want: true},
		{name: "placeholder but long enough", secret: "replace_with_a_random_secret_at_least_32_chars", want: false},
		{name: "random enough", secret: "a-real-random-secret-value-with-48-bytes", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isShortOrDefaultJWTSecret(tt.secret); got != tt.want {
				t.Fatalf("isShortOrDefaultJWTSecret(%q) = %v, want %v", tt.secret, got, tt.want)
			}
		})
	}
}

func TestPlaceholderJWTSecret(t *testing.T) {
	if !isPlaceholderJWTSecret("replace_with_a_random_secret_at_least_32_chars") {
		t.Fatal("expected placeholder JWT secret to be detected")
	}
	if isPlaceholderJWTSecret("a-real-random-secret-value-with-48-bytes") {
		t.Fatal("real-looking JWT secret was detected as placeholder")
	}
}

func TestUnsafeAdminPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{name: "empty", password: "", want: true},
		{name: "default", password: "admin123", want: true},
		{name: "placeholder", password: "replace_with_initial_admin_password", want: true},
		{name: "custom", password: "correct-horse-battery-staple", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isUnsafeAdminPassword(tt.password); got != tt.want {
				t.Fatalf("isUnsafeAdminPassword(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}
