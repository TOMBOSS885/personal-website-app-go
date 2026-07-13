package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func AdminGetLive2DModels(c *gin.Context) {
	settings := getOrCreateLive2DSettings()
	models, err := repository.GetLive2DModels(false, false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取 Live2D 模型失败")
		return
	}
	attachLive2DThumbnails(models)
	response.Success(c, gin.H{
		"settings": settings,
		"models":   models,
	})
}

func AdminUpdateLive2DSettings(c *gin.Context) {
	settings := getOrCreateLive2DSettings()
	var payload model.Live2DSettings
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	settings.Enabled = payload.Enabled
	settings.Position = stringOr(payload.Position, settings.Position)
	settings.Size = intOr(payload.Size, settings.Size)
	settings.PrimaryColor = stringOr(payload.PrimaryColor, settings.PrimaryColor)
	settings.TransitionType = stringOr(payload.TransitionType, settings.TransitionType)
	settings.TransitionDuration = intOr(payload.TransitionDuration, settings.TransitionDuration)
	settings.MenuAlign = stringOr(payload.MenuAlign, settings.MenuAlign)
	settings.ShowSleepButton = payload.ShowSleepButton
	settings.ShowAboutButton = payload.ShowAboutButton
	applyLive2DSettingsDefaults(settings)

	if err := repository.UpdateLive2DSettings(settings); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存 Live2D 设置失败")
		return
	}
	response.Success(c, settings)
}

func AdminUploadLive2DModel(c *gin.Context) {
	settings := getOrCreateUploadSettings()
	form, err := c.MultipartForm()
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Please upload a complete Live2D model folder.")
		return
	}
	files := form.File["files"]
	paths := form.Value["paths"]
	name := c.PostForm("name")
	entryPath := c.PostForm("entryPath")
	if len(files) == 0 || len(files) != len(paths) {
		response.Error(c, http.StatusBadRequest, "Please upload a complete Live2D model folder.")
		return
	}
	if len(files) > settings.Live2DFileMaxCount {
		response.Error(c, http.StatusBadRequest, "Too many files in the Live2D upload.")
		return
	}

	directory := uuid.NewString()
	modelDir := filepath.Join(config.AppConfig.UploadDir, "live2d", directory)
	persisted := false
	defer func() {
		if !persisted {
			_ = os.RemoveAll(modelDir)
		}
	}()
	var detectedEntry string
	var totalSize int64
	for i, file := range files {
		totalSize += file.Size
		if totalSize > bytesFromMB(settings.Live2DTotalMaxMB) {
			response.Error(c, http.StatusBadRequest, "Live2D upload exceeds configured total size limit.")
			return
		}
		cleanPath := normalizeRelativePath(paths[i])
		if cleanPath == "" || isDisallowedLive2DFile(cleanPath) {
			response.Error(c, http.StatusBadRequest, "Invalid model file path.")
			return
		}
		target := filepath.Join(modelDir, filepath.FromSlash(cleanPath))
		if err := saveUploadedFile(c, file, modelDir, target); err != nil {
			response.Error(c, http.StatusBadRequest, "Invalid model file path.")
			return
		}
		if isModelJSON(cleanPath) && (detectedEntry == "" || strings.HasSuffix(strings.ToLower(cleanPath), ".model3.json")) {
			detectedEntry = cleanPath
		}
	}

	cleanEntry := normalizeRelativePath(entryPath)
	if cleanEntry == "" {
		cleanEntry = detectedEntry
	}
	if cleanEntry == "" || !isModelJSON(cleanEntry) {
		response.Error(c, http.StatusBadRequest, "No model.json or .model3.json file was found.")
		return
	}
	if _, err := os.Stat(filepath.Join(modelDir, filepath.FromSlash(cleanEntry))); err != nil {
		response.Error(c, http.StatusBadRequest, "The selected model entry file does not exist.")
		return
	}

	count, _ := repository.CountLive2DModels()
	if strings.TrimSpace(name) == "" {
		name = directory
	}
	liveModel := model.Live2DModel{
		Name:            strings.TrimSpace(name),
		Directory:       directory,
		ModelPath:       "/uploads/live2d/" + directory + "/" + cleanEntry,
		Active:          count == 0,
		Switchable:      true,
		DisplayOrder:    int(count),
		Scale:           1.0,
		OffsetX:         0.0,
		OffsetY:         0.0,
		Volume:          0.0,
		TipsEnabled:     true,
		WelcomeMessages: "Welcome back!",
		TipMessages:     "Take a short break.\nRemember to save your ideas.",
		TipDuration:     3500,
		TipInterval:     9000,
		TypingParam:     "PARAM_MOUTH_OPEN_Y",
		TypingSpeed:     120,
		TypingMaxValue:  1.0,
	}
	if err := repository.CreateLive2DModel(&liveModel); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存 Live2D 模型失败")
		return
	}
	persisted = true
	liveModel.ThumbnailPath = findLive2DThumbnail(liveModel)
	_ = repository.UpdateLive2DModel(&liveModel)
	response.Success(c, liveModel)
}

func AdminUpdateLive2DModel(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetLive2DModelByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Live2D 模型不存在")
		return
	}
	var payload model.Live2DModel
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Name = stringOr(payload.Name, existing.Name)
	existing.Switchable = payload.Switchable
	existing.DisplayOrder = payload.DisplayOrder
	existing.Scale = floatOr(payload.Scale, 1.0)
	existing.OffsetX = payload.OffsetX
	existing.OffsetY = payload.OffsetY
	existing.Volume = payload.Volume
	existing.TipsEnabled = payload.TipsEnabled
	existing.WelcomeMessages = stringOr(payload.WelcomeMessages, existing.WelcomeMessages)
	existing.TipMessages = stringOr(payload.TipMessages, existing.TipMessages)
	existing.TipDuration = intOr(payload.TipDuration, 3500)
	existing.TipInterval = intOr(payload.TipInterval, 9000)
	existing.TipOffsetX = payload.TipOffsetX
	existing.TipOffsetY = payload.TipOffsetY
	existing.TypingEnabled = payload.TypingEnabled
	existing.TypingParam = stringOr(payload.TypingParam, "PARAM_MOUTH_OPEN_Y")
	existing.TypingSpeed = intOr(payload.TypingSpeed, 120)
	existing.TypingMinValue = payload.TypingMinValue
	existing.TypingMaxValue = floatOr(payload.TypingMaxValue, 1.0)

	if err := repository.UpdateLive2DModel(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新 Live2D 模型失败")
		return
	}
	existing.ThumbnailPath = findLive2DThumbnail(*existing)
	response.Success(c, existing)
}

func AdminActivateLive2DModel(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetLive2DModelByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Live2D 模型不存在")
		return
	}
	_ = repository.DeactivateAllLive2DModels()
	existing.Active = true
	if err := repository.UpdateLive2DModel(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "启用 Live2D 模型失败")
		return
	}
	existing.ThumbnailPath = findLive2DThumbnail(*existing)
	response.Success(c, existing)
}

func AdminDeleteLive2DModel(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetLive2DModelByID(id)
	if err == nil {
		_ = repository.DeleteLive2DModel(id)
		_ = os.RemoveAll(filepath.Join(config.AppConfig.UploadDir, "live2d", existing.Directory))
	}
	response.Success(c, nil)
}

func getOrCreateLive2DSettings() *model.Live2DSettings {
	settings, err := repository.GetLive2DSettings()
	if err == nil {
		applyLive2DSettingsDefaults(settings)
		return settings
	}
	if err != gorm.ErrRecordNotFound {
		return defaultLive2DSettings()
	}
	settings = defaultLive2DSettings()
	_ = repository.CreateLive2DSettings(settings)
	return settings
}

func defaultLive2DSettings() *model.Live2DSettings {
	return &model.Live2DSettings{
		Enabled:            true,
		Position:           "bottom-right",
		Size:               280,
		PrimaryColor:       "rgba(96,165,250,0.92)",
		TransitionType:     "slide",
		TransitionDuration: 1500,
		MenuAlign:          "right",
		ShowSleepButton:    true,
		ShowAboutButton:    false,
	}
}

func applyLive2DSettingsDefaults(settings *model.Live2DSettings) {
	if settings.Position == "" {
		settings.Position = "bottom-right"
	}
	if settings.Size == 0 {
		settings.Size = 280
	}
	if settings.PrimaryColor == "" {
		settings.PrimaryColor = "rgba(96,165,250,0.92)"
	}
	if settings.TransitionType == "" {
		settings.TransitionType = "slide"
	}
	if settings.TransitionDuration == 0 {
		settings.TransitionDuration = 1500
	}
	if settings.MenuAlign == "" {
		settings.MenuAlign = "right"
	}
}

func attachLive2DThumbnails(models []model.Live2DModel) {
	for i := range models {
		if models[i].ThumbnailPath == "" {
			models[i].ThumbnailPath = findLive2DThumbnail(models[i])
			if models[i].ThumbnailPath != "" {
				_ = repository.UpdateLive2DModel(&models[i])
			}
		}
	}
}

func findLive2DThumbnail(m model.Live2DModel) string {
	if strings.TrimSpace(m.ThumbnailPath) != "" {
		return m.ThumbnailPath
	}
	modelDir := filepath.Join(config.AppConfig.UploadDir, "live2d", m.Directory)
	var images []string
	_ = filepath.WalkDir(modelDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !isLive2DImage(path) {
			return nil
		}
		rel, err := filepath.Rel(modelDir, path)
		if err != nil {
			return nil
		}
		images = append(images, filepath.ToSlash(rel))
		return nil
	})
	if len(images) == 0 {
		return ""
	}
	sort.Slice(images, func(i, j int) bool {
		pi := imagePriority(images[i])
		pj := imagePriority(images[j])
		if pi == pj {
			return images[i] < images[j]
		}
		return pi < pj
	})
	return "/uploads/live2d/" + m.Directory + "/" + images[0]
}

func normalizeRelativePath(path string) string {
	path = strings.ReplaceAll(path, "\\", "/")
	path = strings.TrimLeft(path, "/")
	if len(path) >= 2 && path[1] == ':' {
		path = path[2:]
	}
	clean := filepath.ToSlash(filepath.Clean(path))
	if clean == "." || strings.HasPrefix(clean, "../") || clean == ".." {
		return ""
	}
	return clean
}

func isModelJSON(path string) bool {
	lower := strings.ToLower(path)
	return strings.HasSuffix(lower, "model.json") || strings.HasSuffix(lower, ".model3.json")
}

func isLive2DImage(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return allowedExt(ext, []string{".png", ".jpg", ".jpeg", ".webp", ".gif"})
}

func isDisallowedLive2DFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return allowedExt(ext, []string{
		".html", ".htm", ".js", ".mjs", ".css", ".svg", ".php", ".jsp", ".asp", ".aspx",
		".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1", ".jar", ".war",
	})
}

func imagePriority(path string) int {
	lower := strings.ToLower(filepath.ToSlash(path))
	if strings.Contains(lower, "preview") || strings.Contains(lower, "thumb") || strings.Contains(lower, "cover") || strings.Contains(lower, "icon") {
		return 0
	}
	if !strings.Contains(lower, "texture") {
		return 1
	}
	return 2
}

func stringOr(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func intOr(value, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func floatOr(value, fallback float64) float64 {
	if value == 0 {
		return fallback
	}
	return value
}
