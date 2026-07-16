package handler

import (
	"personal-website-go/internal/model"
	"testing"
)

func TestPublicArticlePayloadRequiresLoginBeforePassword(t *testing.T) {
	article := &model.Article{
		ID:            9,
		Title:         "Private article",
		Summary:       "Public summary",
		Content:       "secret body",
		ContentType:   "markdown",
		IsLocked:      true,
		RequiresLogin: true,
	}

	payload := publicArticlePayload(article, false, true)
	if payload["content"] != "" || payload["staticSiteUrl"] != "" {
		t.Fatal("login-required payload leaked protected content")
	}
	if payload["loginRequired"] != true || payload["requiresLogin"] != true {
		t.Fatal("login-required state is missing")
	}
	if payload["requiresPassword"] != false {
		t.Fatal("password prompt must not be exposed before login")
	}
}

func TestPublicArticlePayloadRequiresPasswordAfterLogin(t *testing.T) {
	article := &model.Article{IsLocked: true, RequiresLogin: true, Content: "secret body"}
	payload := publicArticlePayload(article, false, false)
	if payload["requiresPassword"] != true || payload["loginRequired"] != false {
		t.Fatal("authenticated reader should be prompted for the article password")
	}
	if payload["content"] != "" {
		t.Fatal("locked payload leaked protected content")
	}
}

func TestSanitizePublicArticleSummariesAlwaysRemovesContent(t *testing.T) {
	articles := sanitizePublicArticleSummaries([]model.Article{
		{Summary: "visible", Content: "secret", RequiresLogin: true},
		{Summary: "hidden", Content: "secret", IsLocked: true},
	})
	if articles[0].Content != "" || articles[0].Summary != "visible" {
		t.Fatal("login-required summary sanitization is incorrect")
	}
	if articles[1].Content != "" || articles[1].Summary != "" {
		t.Fatal("password-locked summary sanitization is incorrect")
	}
}
