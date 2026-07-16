package handler

import (
	"net/url"
	"personal-website-go/internal/model"
	"strings"
	"testing"
	"time"
)

func TestMusicSignatureIsBoundToClientIP(t *testing.T) {
	music := &model.Music{ID: 7, FileURL: "/uploads/music/track.mp3"}
	expires := time.Now().Add(time.Minute).Unix()
	signed := signedMusicURL(music, "public", expires, "203.0.113.10")
	parsed, err := url.Parse(signed)
	if err != nil {
		t.Fatal(err)
	}
	signature := parsed.Query().Get("sign")
	if !validMusicSignature(music, "public", expires, "203.0.113.10", signature) {
		t.Fatal("signature was rejected for the issuing IP")
	}
	if validMusicSignature(music, "public", expires, "203.0.113.11", signature) {
		t.Fatal("signature remained valid after changing client IP")
	}
}

func TestArticleSiteSignatureIsBoundToClientIP(t *testing.T) {
	payload := articleSiteSignaturePayload(8, "site-key", 99, 12345, "203.0.113.10")
	if strings.Contains(payload, "203.0.113.11") {
		t.Fatal("test payload unexpectedly contains another IP")
	}
	if payload == articleSiteSignaturePayload(8, "site-key", 99, 12345, "203.0.113.11") {
		t.Fatal("article site signature payload is not bound to client IP")
	}
}
