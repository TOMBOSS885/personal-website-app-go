package handler

import (
	"errors"
	"net/http"
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

	article := model.Article{
		Title:              payload.Title,
		Summary:            payload.Summary,
		Content:            payload.Content,
		CoverImage:         payload.CoverImage,
		Category:           payload.Category,
		Tags:               payload.Tags,
		Published:          payload.Published,
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

	existing.Title = payload.Title
	existing.Summary = payload.Summary
	existing.Content = payload.Content
	existing.CoverImage = payload.CoverImage
	existing.Category = payload.Category
	existing.Tags = payload.Tags
	existing.Published = payload.Published
	existing.IsLocked = payload.IsLocked
	existing.AccessPasswordHash = hash

	if err := repository.UpdateArticle(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新文章失败")
		return
	}
	response.Success(c, existing)
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
