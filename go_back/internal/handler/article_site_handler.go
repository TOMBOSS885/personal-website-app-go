package handler

import (
	"archive/zip"
	"context"
	"crypto/hmac"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const articleSiteDirName = "article-sites"

const (
	articleSiteMaxHTMLBytes = 10 << 20
	articleSiteMaxFileBytes = 256 << 20
	articleSiteRedisTTL     = 30 * time.Second
	articleSiteLocalTTL     = 5 * time.Second
	articleSiteFallbackTTL  = 30 * time.Second
)

type articleSiteAccessEntry struct {
	SiteKey    string
	Version    int64
	ValidUntil time.Time
}

var articleSiteAccessCache = struct {
	sync.RWMutex
	entries map[uint64]articleSiteAccessEntry
}{entries: make(map[uint64]articleSiteAccessEntry)}

var articleSiteAllowedExts = map[string]bool{
	".html": true, ".htm": true, ".css": true, ".js": true, ".mjs": true,
	".json": true, ".map": true, ".txt": true, ".xml": true, ".webmanifest": true,
	".csv": true, ".yaml": true, ".yml": true, ".pdf": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	".avif": true, ".svg": true, ".ico": true, ".cur": true,
	".woff": true, ".woff2": true, ".ttf": true, ".otf": true, ".eot": true,
	".mp3": true, ".wav": true, ".ogg": true, ".m4a": true, ".aac": true,
	".mp4": true, ".webm": true, ".mov": true, ".vtt": true, ".srt": true,
	".wasm": true, ".gltf": true, ".glb": true, ".bin": true,
}

type articleSiteUploadResponse struct {
	SiteKey   string `json:"siteKey"`
	Name      string `json:"name"`
	FileCount int    `json:"fileCount"`
	TotalSize int64  `json:"totalSize"`
}

func AdminUploadArticleSite(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请选择 ZIP 静态前端包")
		return
	}
	settings := getOrCreateUploadSettings()
	if file.Size <= 0 || file.Size > bytesFromMB(settings.ArticleSiteZipMaxMB) {
		response.Error(c, http.StatusBadRequest, "静态前端压缩包超过上传限制")
		return
	}
	if strings.ToLower(filepath.Ext(file.Filename)) != ".zip" {
		response.Error(c, http.StatusBadRequest, "静态前端必须上传 ZIP 文件")
		return
	}

	src, err := file.Open()
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无法读取 ZIP 文件")
		return
	}
	defer src.Close()

	reader, err := zip.NewReader(src, file.Size)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "ZIP 文件损坏或格式不正确")
		return
	}
	prefix, err := articleSiteRootPrefix(reader.File)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	key := uuid.NewString()
	root := filepath.Join(config.AppConfig.UploadDir, articleSiteDirName)
	stage := filepath.Join(root, ".tmp-"+key)
	target := filepath.Join(root, key)
	if err := os.MkdirAll(stage, 0755); err != nil {
		response.Error(c, http.StatusInternalServerError, "无法创建静态前端目录")
		return
	}
	defer os.RemoveAll(stage)

	count, total, err := extractArticleSite(reader.File, prefix, stage, settings)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := os.Stat(filepath.Join(stage, "index.html")); err != nil {
		response.Error(c, http.StatusBadRequest, "ZIP 中必须包含 index.html")
		return
	}
	if err := os.Rename(stage, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存静态前端失败")
		return
	}
	response.Success(c, articleSiteUploadResponse{
		SiteKey: key, Name: filepath.Base(file.Filename), FileCount: count, TotalSize: total,
	})
}

func ServeArticleSiteFile(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	siteKey := strings.TrimSpace(c.Param("siteKey"))
	version, err := strconv.ParseInt(c.Param("version"), 10, 64)
	if err != nil || version <= 0 || !validArticleSiteKey(siteKey) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	expires, err := strconv.ParseInt(c.Param("expires"), 10, 64)
	if err != nil || expires < time.Now().Unix() {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	expected := signMediaValue(articleSiteSignaturePayload(id, siteKey, version, expires))
	if !hmac.Equal([]byte(expected), []byte(c.Param("sign"))) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if !articleSiteAccessAllowed(c.Request.Context(), id, siteKey, version) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	requested, err := cleanArticleSitePath(c.Param("filepath"))
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	root := filepath.Join(config.AppConfig.UploadDir, articleSiteDirName, siteKey)
	target, err := safeArticleSiteTarget(root, requested)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	info, statErr := os.Stat(target)
	if statErr == nil && info.IsDir() {
		target = filepath.Join(target, "index.html")
		statErr = nil
	}
	if statErr != nil || info == nil {
		if filepath.Ext(requested) == "" {
			target = filepath.Join(root, "index.html")
		} else {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
	}
	setArticleSiteSecurityHeaders(c, expires)
	if strings.EqualFold(filepath.Ext(target), ".html") || strings.EqualFold(filepath.Ext(target), ".htm") {
		serveArticleSiteHTML(c, target, articleSiteBaseURL(id, siteKey, version, expires, c.Param("sign")))
		return
	}
	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(target))); contentType != "" {
		c.Header("Content-Type", contentType)
	}
	http.ServeFile(c.Writer, c.Request, target)
}

func signedArticleSiteURL(article *model.Article) string {
	if article == nil || normalizeArticleContentType(article.ContentType) != "static" || !validArticleSiteKey(article.StaticSiteKey) {
		return ""
	}
	ttl := articleSiteURLTTL()
	if article.IsLocked && ttl > 10*time.Minute {
		ttl = 10 * time.Minute
	}
	expires := articleSiteExpiry(time.Now(), ttl).Unix()
	version := article.UpdatedAt.UnixNano()
	signature := signMediaValue(articleSiteSignaturePayload(article.ID, article.StaticSiteKey, version, expires))
	return articleSiteBaseURL(article.ID, article.StaticSiteKey, version, expires, signature) + "index.html"
}

func articleSiteBaseURL(id uint64, siteKey string, version, expires int64, signature string) string {
	return fmt.Sprintf("/api/public/article-sites/%d/%s/%d/%d/%s/", id, siteKey, version, expires, signature)
}

func articleSiteSignaturePayload(id uint64, siteKey string, version, expires int64) string {
	return fmt.Sprintf("article-site|%d|%s|%d|%d", id, siteKey, version, expires)
}

func articleSiteURLTTL() time.Duration {
	seconds := 3600
	if config.AppConfig != nil && config.AppConfig.ArticleSiteURLTTLSeconds > 0 {
		seconds = config.AppConfig.ArticleSiteURLTTLSeconds
	}
	if seconds < 300 {
		seconds = 300
	}
	if seconds > 86400 {
		seconds = 86400
	}
	return time.Duration(seconds) * time.Second
}

func articleSiteExpiry(now time.Time, ttl time.Duration) time.Time {
	bucket := 5 * time.Minute
	if ttl < 10*time.Minute {
		bucket = time.Minute
	}
	expiresUnix := now.Add(ttl).Unix()
	bucketSeconds := int64(bucket / time.Second)
	if remainder := expiresUnix % bucketSeconds; remainder != 0 {
		expiresUnix += bucketSeconds - remainder
	}
	return time.Unix(expiresUnix, 0)
}

func serveArticleSiteHTML(c *gin.Context, target, baseURL string) {
	info, err := os.Stat(target)
	if err != nil || info.IsDir() || info.Size() > articleSiteMaxHTMLBytes {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	data, err := os.ReadFile(target)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	html := string(data)
	if !strings.Contains(strings.ToLower(html), "<base ") {
		base := `<base href="` + baseURL + `">`
		lower := strings.ToLower(html)
		if index := strings.Index(lower, "<head>"); index >= 0 {
			html = html[:index+len("<head>")] + base + html[index+len("<head>"):]
		} else {
			html = base + html
		}
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func articleSiteAccessAllowed(requestCtx context.Context, id uint64, siteKey string, version int64) bool {
	now := time.Now()
	articleSiteAccessCache.RLock()
	entry, ok := articleSiteAccessCache.entries[id]
	articleSiteAccessCache.RUnlock()
	if ok && entry.SiteKey == siteKey && entry.Version == version && now.Before(entry.ValidUntil) {
		return true
	}
	if articleSiteRedisReady() {
		ctx, cancel := context.WithTimeout(requestCtx, 300*time.Millisecond)
		cached, err := cache.Client.Get(ctx, articleSiteAccessRedisKey(id)).Result()
		cancel()
		if err == nil && hmac.Equal([]byte(cached), []byte(articleSiteAccessValue(siteKey, version))) {
			storeArticleSiteLocalAccess(id, siteKey, version, now.Add(articleSiteLocalTTL))
			return true
		}
	}

	article, err := repository.GetArticleSiteAccessByID(id)
	if err != nil || !article.Published || normalizeArticleContentType(article.ContentType) != "static" ||
		article.StaticSiteKey != siteKey || article.UpdatedAt.UnixNano() != version {
		return false
	}
	localTTL := articleSiteFallbackTTL
	if articleSiteRedisReady() {
		localTTL = articleSiteLocalTTL
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		_ = cache.Client.Set(ctx, articleSiteAccessRedisKey(id), articleSiteAccessValue(siteKey, version), articleSiteRedisTTL).Err()
		cancel()
	}
	storeArticleSiteLocalAccess(id, siteKey, version, now.Add(localTTL))
	return true
}

func storeArticleSiteLocalAccess(id uint64, siteKey string, version int64, validUntil time.Time) {
	articleSiteAccessCache.Lock()
	articleSiteAccessCache.entries[id] = articleSiteAccessEntry{SiteKey: siteKey, Version: version, ValidUntil: validUntil}
	articleSiteAccessCache.Unlock()
}

func invalidateArticleSiteAccess(id uint64) {
	articleSiteAccessCache.Lock()
	delete(articleSiteAccessCache.entries, id)
	articleSiteAccessCache.Unlock()
	if articleSiteRedisReady() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		_ = cache.Client.Del(ctx, articleSiteAccessRedisKey(id)).Err()
		cancel()
	}
}

func articleSiteRedisReady() bool {
	return config.AppConfig != nil && config.AppConfig.CacheEnabled && cache.Ready()
}

func articleSiteAccessRedisKey(id uint64) string {
	return fmt.Sprintf("cache:article-site-access:v1:%d", id)
}

func articleSiteAccessValue(siteKey string, version int64) string {
	return siteKey + "|" + strconv.FormatInt(version, 10)
}

func setArticleSiteSecurityHeaders(c *gin.Context, expires int64) {
	remaining := expires - time.Now().Unix()
	if remaining < 0 {
		remaining = 0
	}
	if remaining > 3600 {
		remaining = 3600
	}
	c.Header("Cache-Control", fmt.Sprintf("private, max-age=%d", remaining))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("Content-Security-Policy", "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https:")
}

func articleSiteRootPrefix(files []*zip.File) (string, error) {
	for _, file := range files {
		name := normalizedZipName(file.Name)
		if name == "index.html" {
			return "", nil
		}
	}
	candidates := make([]string, 0, 1)
	for _, file := range files {
		name := normalizedZipName(file.Name)
		if strings.HasSuffix(strings.ToLower(name), "/index.html") {
			candidates = append(candidates, strings.TrimSuffix(name, "index.html"))
		}
	}
	if len(candidates) != 1 {
		return "", errors.New("ZIP 根目录必须包含 index.html，或只包含一个带 index.html 的项目目录")
	}
	return candidates[0], nil
}

func extractArticleSite(files []*zip.File, prefix, stage string, settings *model.UploadSettings) (int, int64, error) {
	maxFiles := settings.ArticleSiteFileCount
	maxTotal := bytesFromMB(settings.ArticleSiteTotalMB)
	count := 0
	var total int64
	for _, file := range files {
		name := normalizedZipName(file.Name)
		if strings.HasPrefix(name, "/") || strings.Contains(strings.SplitN(name, "/", 2)[0], ":") {
			return 0, 0, errors.New("ZIP 包含绝对路径")
		}
		if name == "" || ignoredArticleSiteEntry(name) || (prefix != "" && !strings.HasPrefix(name, prefix)) {
			continue
		}
		name = strings.TrimPrefix(name, prefix)
		name = strings.TrimPrefix(name, "/")
		if name == "" {
			continue
		}
		if file.FileInfo().Mode()&os.ModeSymlink != 0 {
			return 0, 0, errors.New("ZIP 不允许包含软链接")
		}
		cleaned, err := cleanArticleSitePath(name)
		if err != nil {
			return 0, 0, errors.New("ZIP 包含不安全路径")
		}
		target, err := safeArticleSiteTarget(stage, cleaned)
		if err != nil {
			return 0, 0, errors.New("ZIP 包含不安全路径")
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return 0, 0, err
			}
			continue
		}
		if !articleSiteAllowedExts[strings.ToLower(filepath.Ext(cleaned))] {
			return 0, 0, fmt.Errorf("不支持静态文件类型：%s", filepath.Ext(cleaned))
		}
		fileLimit := int64(articleSiteMaxFileBytes)
		if ext := strings.ToLower(filepath.Ext(cleaned)); ext == ".html" || ext == ".htm" {
			fileLimit = articleSiteMaxHTMLBytes
		}
		if int64(file.UncompressedSize64) > fileLimit {
			return 0, 0, fmt.Errorf("静态前端单个文件过大：%s", cleaned)
		}
		count++
		if count > maxFiles {
			return 0, 0, errors.New("静态前端文件数量超过限制")
		}
		if int64(file.UncompressedSize64) > maxTotal-total {
			return 0, 0, errors.New("静态前端解压总大小超过限制")
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return 0, 0, err
		}
		src, err := file.Open()
		if err != nil {
			return 0, 0, errors.New("无法读取 ZIP 内文件")
		}
		dst, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
		if err != nil {
			src.Close()
			return 0, 0, err
		}
		written, copyErr := io.Copy(dst, io.LimitReader(src, maxTotal-total+1))
		closeErr := dst.Close()
		src.Close()
		if copyErr != nil || closeErr != nil || written > maxTotal-total {
			return 0, 0, errors.New("静态前端解压失败或超过大小限制")
		}
		total += written
	}
	return count, total, nil
}

func normalizedZipName(name string) string {
	return strings.TrimPrefix(strings.ReplaceAll(name, "\\", "/"), "./")
}

func ignoredArticleSiteEntry(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasPrefix(lower, "__macosx/") || strings.HasSuffix(lower, "/.ds_store") || lower == ".ds_store"
}

func cleanArticleSitePath(value string) (string, error) {
	value = strings.ReplaceAll(value, "\\", "/")
	firstPart := strings.SplitN(value, "/", 2)[0]
	if strings.HasPrefix(value, "/") || path.IsAbs(value) || strings.Contains(firstPart, ":") {
		return "", errors.New("absolute paths are not allowed")
	}
	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == "" {
		return "index.html", nil
	}
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") || path.IsAbs(cleaned) || strings.Contains(cleaned, "\x00") {
		return "", errors.New("invalid path")
	}
	for _, part := range strings.Split(cleaned, "/") {
		if strings.HasPrefix(part, ".") {
			return "", errors.New("hidden paths are not allowed")
		}
	}
	return cleaned, nil
}

func safeArticleSiteTarget(root, relative string) (string, error) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(filepath.Join(rootAbs, filepath.FromSlash(relative)))
	if err != nil {
		return "", err
	}
	if targetAbs != rootAbs && !strings.HasPrefix(targetAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("invalid target")
	}
	return targetAbs, nil
}

func validArticleSiteKey(key string) bool {
	_, err := uuid.Parse(strings.TrimSpace(key))
	return err == nil
}

func articleSiteExists(key string) bool {
	if !validArticleSiteKey(key) {
		return false
	}
	info, err := os.Stat(filepath.Join(config.AppConfig.UploadDir, articleSiteDirName, key, "index.html"))
	return err == nil && !info.IsDir()
}

func removeArticleSite(key string) error {
	if !validArticleSiteKey(key) {
		return nil
	}
	root := filepath.Join(config.AppConfig.UploadDir, articleSiteDirName)
	target, err := safeArticleSiteTarget(root, key)
	if err != nil {
		return err
	}
	return os.RemoveAll(target)
}
