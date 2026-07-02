package handler

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxThemeBackgroundSize = 10 * 1024 * 1024

var themeBackgroundExts = []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}

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

func AdminListThemeBackgrounds(c *gin.Context) {
	root := filepath.Join(config.AppConfig.UploadDir, "theme-backgrounds")
	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		response.Success(c, []imageDTO{})
		return
	}

	var images []imageDTO
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !allowedExt(strings.ToLower(filepath.Ext(path)), themeBackgroundExts) {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		name := filepath.Base(path)
		images = append(images, imageDTO{
			Name: name,
			URL:  "/uploads/theme-backgrounds/" + name,
			Size: info.Size(),
		})
		return nil
	})

	sort.Slice(images, func(i, j int) bool {
		return images[i].URL > images[j].URL
	})
	response.Success(c, images)
}

func AdminUploadThemeBackground(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请上传图片文件")
		return
	}
	if file.Size > maxThemeBackgroundSize {
		response.Error(c, http.StatusBadRequest, "图片不能超过 10MB")
		return
	}
	contentType, err := detectUploadedContentType(file)
	if err != nil || !strings.HasPrefix(contentType, "image/") {
		response.Error(c, http.StatusBadRequest, "仅支持图片文件")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, themeBackgroundExts) {
		response.Error(c, http.StatusBadRequest, "不支持的图片格式")
		return
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "theme-backgrounds")
	name := uuid.NewString() + ext
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "上传失败")
		return
	}
	response.Success(c, imageDTO{
		Name: name,
		URL:  "/uploads/theme-backgrounds/" + name,
		Size: file.Size,
	})
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
