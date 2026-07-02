package handler

import (
	"net/http"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxThemeBackgroundSize = 10 * 1024 * 1024

type themeSaveRequest struct {
	Preset string             `json:"preset"`
	Custom *model.CustomTheme `json:"custom"`
}

func AdminSaveTheme(c *gin.Context) {
	var req themeSaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	_ = repository.DeactivateAllThemes()
	theme := model.Theme{IsActive: true}
	if req.Preset != "" {
		theme.Name = "Preset: " + req.Preset
		theme.PresetKey = req.Preset
	}
	if req.Custom != nil {
		theme.Name = "Custom Theme"
		theme.PrimaryColor = req.Custom.Primary
		theme.SecondaryColor = req.Custom.Secondary
		theme.AccentColor = req.Custom.Accent
		theme.Background = req.Custom.Background
		theme.BackgroundStyle = req.Custom.BackgroundStyle
		theme.BackgroundImage = req.Custom.BackgroundImage
		theme.CardBg = req.Custom.CardBg
		theme.TextPrimary = req.Custom.TextPrimary
		theme.TextSecondary = req.Custom.TextSecondary
	}
	if err := repository.CreateTheme(&theme); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存主题失败")
		return
	}
	writeThemeResponse(c, &theme)
}

func AdminGetThemes(c *gin.Context) {
	themes, err := repository.GetAllThemes()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取主题失败")
		return
	}
	response.Success(c, themes)
}

func AdminUploadThemeBackground(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "Please upload an image file.")
		return
	}
	if file.Size > maxThemeBackgroundSize {
		response.Error(c, http.StatusBadRequest, "Image must not exceed 10MB.")
		return
	}
	contentType, err := detectUploadedContentType(file)
	if err != nil || !strings.HasPrefix(contentType, "image/") {
		response.Error(c, http.StatusBadRequest, "Only image files are supported.")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}) {
		response.Error(c, http.StatusBadRequest, "Unsupported image type.")
		return
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "theme-backgrounds")
	name := uuid.NewString() + ext
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "上传失败")
		return
	}
	response.Success(c, gin.H{"url": "/uploads/theme-backgrounds/" + name})
}

func writeThemeResponse(c *gin.Context, theme *model.Theme) {
	if theme.PresetKey != "" {
		response.Success(c, gin.H{
			"id":     theme.ID,
			"name":   theme.Name,
			"preset": theme.PresetKey,
		})
		return
	}
	response.Success(c, gin.H{
		"id":   theme.ID,
		"name": theme.Name,
		"custom": gin.H{
			"primary":         theme.PrimaryColor,
			"secondary":       theme.SecondaryColor,
			"accent":          theme.AccentColor,
			"background":      theme.Background,
			"backgroundStyle": theme.BackgroundStyle,
			"backgroundImage": theme.BackgroundImage,
			"cardBg":          theme.CardBg,
			"textPrimary":     theme.TextPrimary,
			"textSecondary":   theme.TextSecondary,
		},
	})
}
