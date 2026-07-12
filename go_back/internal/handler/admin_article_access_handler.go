package handler

import (
	"errors"
	"net/http"
	"path/filepath"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
