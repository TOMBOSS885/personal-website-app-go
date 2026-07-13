package handler

import (
	"net/http"
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
