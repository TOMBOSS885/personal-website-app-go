package handler

import (
	"personal-website-go/internal/config"
	"strings"
	"testing"
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

	first := hashEmailCode("a@example.com", "123456")
	if first == "" || first != hashEmailCode("a@example.com", "123456") {
		t.Fatal("email code hash must be deterministic")
	}
	if first == hashEmailCode("b@example.com", "123456") {
		t.Fatal("email code hash must be bound to the email address")
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
