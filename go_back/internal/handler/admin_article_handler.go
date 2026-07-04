package handler

import (
	"net/http"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"

	"github.com/gin-gonic/gin"
)

func AdminGetArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "10"))
	page, size = normalizePagination(page, size, 100)

	articles, total, err := repository.GetArticles(page, size, "", false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取文章失败")
		return
	}
	response.Page(c, articles, total, size, page)
}

func AdminCreateArticle(c *gin.Context) {
	var article model.Article
	if err := c.ShouldBindJSON(&article); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if article.Title == "" {
		response.Error(c, http.StatusBadRequest, "标题必填")
		return
	}

	if err := repository.CreateArticle(&article); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存文章失败")
		return
	}
	response.Success(c, article)
}

func AdminUpdateArticle(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetArticleByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}

	var payload model.Article
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Title = payload.Title
	existing.Summary = payload.Summary
	existing.Content = payload.Content
	existing.CoverImage = payload.CoverImage
	existing.Category = payload.Category
	existing.Tags = payload.Tags
	existing.Published = payload.Published

	if err := repository.UpdateArticle(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新文章失败")
		return
	}
	response.Success(c, existing)
}

func AdminDeleteArticle(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	_ = repository.DeleteArticle(id)
	response.Success(c, nil)
}
