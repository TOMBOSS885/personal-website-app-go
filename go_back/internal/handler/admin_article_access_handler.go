package handler

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type articleRequest struct {
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	Content        string `json:"content"`
	CoverImage     string `json:"coverImage"`
	Category       string `json:"category"`
	Tags           string `json:"tags"`
	Published      bool   `json:"published"`
	ContentType    string `json:"contentType"`
	StaticSiteKey  string `json:"staticSiteKey"`
	StaticSiteName string `json:"staticSiteName"`
	IsLocked       bool   `json:"isLocked"`
	RequiresLogin  *bool  `json:"requiresLogin"`
	AccessPassword string `json:"accessPassword"`
}

func AdminCreateArticleSecure(c *gin.Context) {
	var payload articleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if strings.TrimSpace(payload.Title) == "" {
		response.Error(c, http.StatusBadRequest, "标题必填")
		return
	}
	hash, err := articlePasswordHash(payload.IsLocked, payload.AccessPassword, "")
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	contentType, siteKey, siteName, err := validateArticleContent(payload.ContentType, payload.StaticSiteKey, payload.StaticSiteName)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	content := payload.Content
	if contentType == "static" {
		content = ""
	}
	article := model.Article{
		Title:              payload.Title,
		Summary:            payload.Summary,
		Content:            content,
		CoverImage:         payload.CoverImage,
		Category:           payload.Category,
		Tags:               payload.Tags,
		Published:          payload.Published,
		ContentType:        contentType,
		StaticSiteKey:      siteKey,
		StaticSiteName:     siteName,
		IsLocked:           payload.IsLocked,
		RequiresLogin:      payload.RequiresLogin != nil && *payload.RequiresLogin,
		AccessPasswordHash: hash,
	}
	if err := repository.CreateArticle(&article); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存文章失败")
		return
	}
	response.Success(c, article)
}

func AdminUpdateArticleSecure(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetArticleByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}

	var payload articleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if strings.TrimSpace(payload.Title) == "" {
		response.Error(c, http.StatusBadRequest, "标题必填")
		return
	}
	hash, err := articlePasswordHash(payload.IsLocked, payload.AccessPassword, existing.AccessPasswordHash)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	contentType, siteKey, siteName, err := validateArticleContent(payload.ContentType, payload.StaticSiteKey, payload.StaticSiteName)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	oldSiteKey := existing.StaticSiteKey
	content := payload.Content
	if contentType == "static" {
		content = ""
	}
	existing.Title = payload.Title
	existing.Summary = payload.Summary
	existing.Content = content
	existing.CoverImage = payload.CoverImage
	existing.Category = payload.Category
	existing.Tags = payload.Tags
	existing.Published = payload.Published
	existing.ContentType = contentType
	existing.StaticSiteKey = siteKey
	existing.StaticSiteName = siteName
	existing.IsLocked = payload.IsLocked
	if payload.RequiresLogin != nil {
		existing.RequiresLogin = *payload.RequiresLogin
	}
	existing.AccessPasswordHash = hash

	if err := repository.UpdateArticle(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新文章失败")
		return
	}
	invalidateArticleSiteAccess(existing.ID)
	if oldSiteKey != "" && oldSiteKey != siteKey {
		_ = removeArticleSite(oldSiteKey)
	}
	response.Success(c, existing)
}

func AdminUpdateArticlesAccess(c *gin.Context) {
	var payload struct {
		IDs           []uint64 `json:"ids"`
		RequiresLogin *bool    `json:"requiresLogin"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.RequiresLogin == nil {
		response.Error(c, http.StatusBadRequest, "批量访问设置参数无效")
		return
	}
	if len(payload.IDs) == 0 || len(payload.IDs) > 100 {
		response.Error(c, http.StatusBadRequest, "每次请选择 1 到 100 篇文章")
		return
	}

	unique := make([]uint64, 0, len(payload.IDs))
	seen := make(map[uint64]struct{}, len(payload.IDs))
	for _, id := range payload.IDs {
		if id == 0 {
			response.Error(c, http.StatusBadRequest, "文章参数无效")
			return
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}

	updated, err := repository.UpdateArticlesRequiresLogin(unique, *payload.RequiresLogin)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Error(c, http.StatusConflict, "部分文章已不存在，请刷新列表后重试")
			return
		}
		response.Error(c, http.StatusInternalServerError, "批量更新文章访问权限失败")
		return
	}
	for _, id := range unique {
		invalidateArticleSiteAccess(id)
	}
	username, _ := c.Get("username")
	middleware.LogOperation(c, fmt.Sprint(username), "batch_update_article_access",
		fmt.Sprintf("ids=%v requiresLogin=%t", unique, *payload.RequiresLogin), http.StatusOK)
	response.Success(c, gin.H{
		"requested":     len(unique),
		"updated":       updated,
		"requiresLogin": *payload.RequiresLogin,
	})
}

func AdminDeleteArticleSecure(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	article, err := repository.GetArticleByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	if err := repository.DeleteArticle(id); err != nil {
		response.Error(c, http.StatusInternalServerError, "删除文章失败")
		return
	}
	invalidateArticleSiteAccess(article.ID)
	_ = removeArticleSite(article.StaticSiteKey)
	response.Success(c, nil)
}

func validateArticleContent(contentType, siteKey, siteName string) (string, string, string, error) {
	contentType = normalizeArticleContentType(contentType)
	if contentType == "markdown" {
		return contentType, "", "", nil
	}
	siteKey = strings.TrimSpace(siteKey)
	if !articleSiteExists(siteKey) {
		return "", "", "", errors.New("请先上传包含 index.html 的静态前端 ZIP")
	}
	return contentType, siteKey, strings.TrimSpace(filepath.Base(siteName)), nil
}

func normalizeArticleContentType(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "static") {
		return "static"
	}
	return "markdown"
}

func articlePasswordHash(locked bool, plainPassword, currentHash string) (string, error) {
	if !locked {
		return "", nil
	}
	plainPassword = strings.TrimSpace(plainPassword)
	if plainPassword == "" {
		if currentHash != "" {
			return currentHash, nil
		}
		return "", errors.New("锁定文章需要设置访问密码")
	}
	if len([]rune(plainPassword)) < 4 {
		return "", errors.New("文章访问密码至少需要 4 个字符")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", errors.New("生成文章密码失败")
	}
	return string(hash), nil
}
