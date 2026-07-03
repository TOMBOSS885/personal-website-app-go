package handler

import (
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/media"
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
		theme.BackgroundSize = req.Custom.BackgroundSize
		theme.BackgroundPosition = req.Custom.BackgroundPosition
		theme.BackgroundRepeat = req.Custom.BackgroundRepeat
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
		base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
		if strings.HasSuffix(base, "@tablet") || strings.HasSuffix(base, "@mobile") {
			return nil
		}
		if !strings.HasSuffix(base, "@desktop") {
			desktopPath := filepath.Join(filepath.Dir(path), base+"@desktop.jpg")
			if _, err := os.Stat(desktopPath); err == nil {
				return nil
			}
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

	if ext != ".avif" {
		if err := validateUploadedImageDimensions(file, 0, maxGeneralImageDimension, maxGeneralImagePixels); err != nil {
			response.Error(c, http.StatusBadRequest, "invalid or oversized image dimensions")
			return
		}
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "theme-backgrounds")
	baseName := uuid.NewString()
	name := baseName + ext
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "上传失败")
		return
	}
	responseName := name
	responseSize := file.Size
	if media.IsStaticOptimizableImage(ext, contentType) {
		results, err := media.GenerateOptimizedVariants(target, dir, baseName, []media.ImageVariant{
			{Suffix: "@desktop", MaxWidth: 1920, Quality: 82},
			{Suffix: "@tablet", MaxWidth: 1200, Quality: 80},
			{Suffix: "@mobile", MaxWidth: 768, Quality: 78},
		})
		if err != nil {
			log.Printf("theme background optimization failed: %v", err)
		} else if len(results) > 0 {
			responseName = results[0].Name
			responseSize = results[0].Size
		}
	}

	response.Success(c, imageDTO{
		Name: responseName,
		URL:  "/uploads/theme-backgrounds/" + responseName,
		Size: responseSize,
	})
}

func AdminDeleteThemeBackground(c *gin.Context) {
	name := filepath.Base(strings.TrimSpace(c.Param("name")))
	if name == "" || name == "." || name == ".." || !allowedExt(strings.ToLower(filepath.Ext(name)), themeBackgroundExts) {
		response.Error(c, http.StatusBadRequest, "无效的背景图片")
		return
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "theme-backgrounds")
	target := filepath.Join(dir, name)
	dirAbs, err := filepath.Abs(dir)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "删除失败")
		return
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil || !strings.HasPrefix(targetAbs, dirAbs+string(os.PathSeparator)) {
		response.Error(c, http.StatusBadRequest, "无效的背景图片")
		return
	}

	if err := deleteThemeBackgroundFiles(dirAbs, name); err != nil {
		response.Error(c, http.StatusInternalServerError, "删除失败")
		return
	}
	response.Success(c, gin.H{"deleted": true})
}

func deleteThemeBackgroundFiles(dirAbs, name string) error {
	deleteNames := []string{name}
	groupBase := strings.TrimSuffix(name, filepath.Ext(name))
	if at := strings.Index(groupBase, "@"); at >= 0 {
		groupBase = groupBase[:at]
	}

	if groupBase != "" {
		entries, err := os.ReadDir(dirAbs)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			entryName := entry.Name()
			entryBase := strings.TrimSuffix(entryName, filepath.Ext(entryName))
			if entryBase == groupBase || strings.HasPrefix(entryBase, groupBase+"@") {
				deleteNames = append(deleteNames, entryName)
			}
		}
	}

	seen := map[string]bool{}
	for _, item := range deleteNames {
		if seen[item] {
			continue
		}
		seen[item] = true
		itemAbs, err := filepath.Abs(filepath.Join(dirAbs, item))
		if err != nil || !strings.HasPrefix(itemAbs, dirAbs+string(os.PathSeparator)) {
			continue
		}
		if err := os.Remove(itemAbs); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
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
			"primary":            theme.PrimaryColor,
			"secondary":          theme.SecondaryColor,
			"accent":             theme.AccentColor,
			"background":         theme.Background,
			"backgroundStyle":    theme.BackgroundStyle,
			"backgroundImage":    theme.BackgroundImage,
			"backgroundSize":     theme.BackgroundSize,
			"backgroundPosition": theme.BackgroundPosition,
			"backgroundRepeat":   theme.BackgroundRepeat,
			"cardBg":             theme.CardBg,
			"textPrimary":        theme.TextPrimary,
			"textSecondary":      theme.TextSecondary,
		},
	})
}
