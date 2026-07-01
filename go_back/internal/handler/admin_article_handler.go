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
		response.Error(c, http.StatusInternalServerError, "保存失败")
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
	
	var updateData model.Article
	if err := c.ShouldBindJSON(&updateData); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	
	existing.Title = updateData.Title
	existing.Summary = updateData.Summary
	existing.Content = updateData.Content
	existing.CoverImage = updateData.CoverImage
	existing.Category = updateData.Category
	existing.Tags = updateData.Tags
	existing.Published = updateData.Published
	
	if err := repository.UpdateArticle(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新失败")
		return
	}
	response.Success(c, existing)
}

func AdminDeleteArticle(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	repository.DeleteArticle(id)
	response.Success(c, nil)
}

// TODO: Other Admin Handlers for Project, Skill, Theme, etc.
