package handler

import (
	"context"
	"fmt"
	"net/http"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	articleUnlockCategory   = "article-unlock"
	maxArticlePasswordBytes = 256
)

type articleUnlockPolicy struct {
	MaxFailures       int
	Penalty           time.Duration
	DailyBanThreshold int
	BanDuration       time.Duration
}

type articleUnlockLocalEntry struct {
	Failures int
	Blocked  bool
	ResetAt  time.Time
}

var articleUnlockLocalStore = struct {
	sync.Mutex
	entries map[string]articleUnlockLocalEntry
}{
	entries: map[string]articleUnlockLocalEntry{},
}

func GetProtectedArticle(c *gin.Context) {
	setPrivateArticleResponseHeaders(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	article, err := repository.GetArticleAccessByID(id)
	if err != nil || !article.Published {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	if article.RequiresLogin {
		if _, authenticated := middleware.CurrentUser(c); !authenticated {
			response.Success(c, publicArticlePayload(article, false, true, c.ClientIP()))
			return
		}
	}
	if article.IsLocked {
		response.Success(c, publicArticlePayload(article, false, false, c.ClientIP()))
		return
	}
	if err := repository.LoadArticleContent(article); err != nil {
		response.Error(c, http.StatusInternalServerError, "文章加载失败")
		return
	}
	incrementArticleViews(article)
	response.Success(c, publicArticlePayload(article, true, false, c.ClientIP()))
}

func UnlockArticle(c *gin.Context) {
	setPrivateArticleResponseHeaders(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	article, err := repository.GetArticleAccessByID(id)
	if err != nil || !article.Published {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	if article.RequiresLogin {
		if _, authenticated := middleware.CurrentUser(c); !authenticated {
			response.Error(c, http.StatusUnauthorized, "登录后才能解锁这篇文章")
			return
		}
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入文章密码")
		return
	}
	password := strings.TrimSpace(req.Password)
	if password == "" {
		response.Error(c, http.StatusBadRequest, "请输入文章密码")
		return
	}
	if len([]byte(password)) > maxArticlePasswordBytes {
		response.Error(c, http.StatusBadRequest, "文章密码过长")
		return
	}

	if article.IsLocked {
		policy := currentArticleUnlockPolicy()
		if blocked, remaining := articleUnlockBlocked(c.ClientIP(), article.ID); blocked {
			c.Header("Retry-After", strconv.Itoa(int(remaining.Seconds())))
			response.Error(c, http.StatusTooManyRequests, "密码错误次数过多，请稍后再试")
			return
		}
		if article.AccessPasswordHash == "" ||
			bcrypt.CompareHashAndPassword([]byte(article.AccessPasswordHash), []byte(password)) != nil {
			recordArticleUnlockFailure(c, article, policy)
			response.Error(c, http.StatusUnauthorized, "文章密码错误")
			return
		}
		clearArticleUnlockFailures(c.ClientIP(), article.ID)
	}
	if err := repository.LoadArticleContent(article); err != nil {
		response.Error(c, http.StatusInternalServerError, "文章加载失败")
		return
	}

	incrementArticleViews(article)
	response.Success(c, publicArticlePayload(article, true, false, c.ClientIP()))
}

func setPrivateArticleResponseHeaders(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	c.Header("Pragma", "no-cache")
	c.Header("Vary", "Cookie, Authorization")
}

func incrementArticleViews(article *model.Article) {
	if delta, err := repository.IncrementArticleViewsBuffered(article.ID); err == nil {
		article.Views += int(delta)
		return
	}
	article.Views++
}

func publicArticlePayload(article *model.Article, includeContent, loginRequired bool, clientIP string) gin.H {
	content := ""
	staticSiteURL := ""
	summary := article.Summary
	if includeContent {
		if normalizeArticleContentType(article.ContentType) == "static" {
			staticSiteURL = signedArticleSiteURL(article, clientIP)
		} else {
			content = article.Content
		}
	} else if article.IsLocked {
		summary = ""
	}
	return gin.H{
		"id":               article.ID,
		"title":            article.Title,
		"summary":          summary,
		"content":          content,
		"contentType":      normalizeArticleContentType(article.ContentType),
		"staticSiteUrl":    staticSiteURL,
		"staticSiteName":   article.StaticSiteName,
		"coverImage":       article.CoverImage,
		"category":         article.Category,
		"tags":             article.Tags,
		"views":            article.Views,
		"published":        article.Published,
		"isLocked":         article.IsLocked,
		"requiresLogin":    article.RequiresLogin,
		"loginRequired":    loginRequired,
		"requiresPassword": article.IsLocked && !includeContent && !loginRequired,
		"createdAt":        article.CreatedAt,
		"updatedAt":        article.UpdatedAt,
	}
}

func sanitizePublicArticleSummaries(articles []model.Article) []model.Article {
	for i := range articles {
		articles[i].Content = ""
		if articles[i].IsLocked {
			articles[i].Summary = ""
		}
	}
	return articles
}

func articleUnlockBlocked(ip string, articleID uint64) (bool, time.Duration) {
	key := articleUnlockLocalKey(ip, articleID)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		ttl, err := cache.Client.TTL(ctx, articleUnlockBlockKey(key)).Result()
		if err == nil && ttl > 0 {
			return true, ttl
		}
	}

	now := time.Now()
	articleUnlockLocalStore.Lock()
	defer articleUnlockLocalStore.Unlock()
	entry, exists := articleUnlockLocalStore.entries[key]
	if !exists || now.After(entry.ResetAt) {
		if exists {
			delete(articleUnlockLocalStore.entries, key)
		}
		return false, 0
	}
	if entry.Blocked {
		return true, time.Until(entry.ResetAt)
	}
	return false, 0
}

func recordArticleUnlockFailure(c *gin.Context, article *model.Article, policy articleUnlockPolicy) {
	ip := c.ClientIP()
	key := articleUnlockLocalKey(ip, article.ID)
	blocked := false
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		failKey := articleUnlockFailKey(key)
		count, err := cache.Client.Incr(ctx, failKey).Result()
		if err == nil {
			_ = cache.Client.Expire(ctx, failKey, policy.Penalty).Err()
			if count >= int64(policy.MaxFailures) {
				_ = cache.Client.Set(ctx, articleUnlockBlockKey(key), article.Title, policy.Penalty).Err()
				_ = cache.Client.Del(ctx, failKey).Err()
				blocked = true
			}
			if blocked {
				recordArticleUnlockBlocked(c, article, policy)
			}
			return
		}
	}

	now := time.Now()
	articleUnlockLocalStore.Lock()
	entry, exists := articleUnlockLocalStore.entries[key]
	if !exists || now.After(entry.ResetAt) {
		entry = articleUnlockLocalEntry{ResetAt: now.Add(policy.Penalty)}
	}
	entry.Failures++
	if entry.Failures >= policy.MaxFailures {
		entry.Blocked = true
		entry.ResetAt = now.Add(policy.Penalty)
		blocked = true
	}
	articleUnlockLocalStore.entries[key] = entry
	articleUnlockLocalStore.Unlock()

	if blocked {
		recordArticleUnlockBlocked(c, article, policy)
	}
}

func clearArticleUnlockFailures(ip string, articleID uint64) {
	key := articleUnlockLocalKey(ip, articleID)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		_ = cache.Client.Del(ctx, articleUnlockFailKey(key), articleUnlockBlockKey(key)).Err()
	}

	articleUnlockLocalStore.Lock()
	delete(articleUnlockLocalStore.entries, key)
	articleUnlockLocalStore.Unlock()
}

func currentArticleUnlockPolicy() articleUnlockPolicy {
	policy := articleUnlockPolicy{
		MaxFailures:       5,
		Penalty:           10 * time.Minute,
		DailyBanThreshold: 5,
		BanDuration:       30 * 24 * time.Hour,
	}
	settings, err := repository.GetOrCreateRateLimitSettings()
	if err != nil || settings == nil {
		return policy
	}
	if settings.ArticleUnlockMaxFailures > 0 {
		policy.MaxFailures = settings.ArticleUnlockMaxFailures
	}
	if settings.ArticleUnlockPenaltySeconds > 0 {
		policy.Penalty = time.Duration(settings.ArticleUnlockPenaltySeconds) * time.Second
	}
	if settings.DailyLimitTriggerThreshold > 0 {
		policy.DailyBanThreshold = settings.DailyLimitTriggerThreshold
	}
	if settings.BanDays > 0 {
		policy.BanDuration = time.Duration(settings.BanDays) * 24 * time.Hour
	}
	return policy
}

func recordArticleUnlockBlocked(c *gin.Context, article *model.Article, policy articleUnlockPolicy) {
	ip := c.ClientIP()
	repository.RecordSecurityAccess(model.SecurityAccessStat{
		Date:         time.Now().Format("20060102"),
		IP:           ip,
		Category:     articleUnlockCategory,
		LimitedCount: 1,
	})
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:             "article_unlock_blocked",
		Severity:         "high",
		IP:               ip,
		Category:         articleUnlockCategory,
		Path:             c.Request.URL.RequestURI(),
		Method:           c.Request.Method,
		UserAgent:        c.Request.UserAgent(),
		Message:          fmt.Sprintf("文章解锁密码连续输错，文章：%s", article.Title),
		Count:            int64(policy.MaxFailures),
		Limit:            policy.MaxFailures,
		RemainingSeconds: int64(policy.Penalty.Seconds()),
	})
	recordArticleUnlockBanIfNeeded(c, policy)
}

func recordArticleUnlockBanIfNeeded(c *gin.Context, policy articleUnlockPolicy) {
	if policy.DailyBanThreshold <= 0 || policy.BanDuration <= 0 {
		return
	}
	ip := c.ClientIP()
	count, err := repository.CountDailySecurityEvents(ip, "article_unlock_blocked", time.Now())
	if err != nil || count < int64(policy.DailyBanThreshold) {
		return
	}
	if activeBan, err := repository.FindActiveBan(ip); err == nil && activeBan != nil {
		return
	}

	expiresAt := time.Now().Add(policy.BanDuration)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		_ = cache.Client.Set(ctx, "ban:ip:"+strings.TrimSpace(ip), articleUnlockCategory, time.Until(expiresAt)).Err()
	}
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:      "ban",
		Severity:  "critical",
		IP:        ip,
		Category:  articleUnlockCategory,
		Path:      c.Request.URL.RequestURI(),
		Method:    c.Request.Method,
		UserAgent: c.Request.UserAgent(),
		Message:   fmt.Sprintf("该 IP 当天触发文章密码锁定 %d 次，已封禁", policy.DailyBanThreshold),
		Count:     count,
		Limit:     policy.DailyBanThreshold,
		ExpiresAt: &expiresAt,
		CreatedAt: time.Now(),
	})
}

func articleUnlockLocalKey(ip string, articleID uint64) string {
	return fmt.Sprintf("%s:%d", strings.TrimSpace(ip), articleID)
}

func articleUnlockFailKey(key string) string {
	return "article:unlock:fail:" + key
}

func articleUnlockBlockKey(key string) string {
	return "article:unlock:block:" + key
}
