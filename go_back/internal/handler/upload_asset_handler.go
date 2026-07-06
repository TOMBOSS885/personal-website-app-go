package handler

import (
	"net/http"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"

	"github.com/gin-gonic/gin"
)

func AdminCleanupUploadAssets(c *gin.Context) {
	kind := strings.TrimSpace(c.Query("kind"))
	if kind != "" && kind != repository.UploadAssetArticleImage && kind != repository.UploadAssetThemeBackground {
		response.Error(c, http.StatusBadRequest, "unsupported upload asset kind")
		return
	}

	removed, err := repository.CleanupMissingUploadAssets(kind)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "清理失效资源失败")
		return
	}
	response.Success(c, gin.H{
		"removed": removed,
	})
}
