package handler

import (
	"net/http"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const mb = 1024 * 1024

func defaultUploadSettings() *model.UploadSettings {
	return &model.UploadSettings{
		ArticleImageMaxMB:    10,
		ThemeBackgroundMaxMB: 10,
		AvatarImageMaxMB:     5,
		MusicFileMaxMB:       50,
		LyricsFileMaxMB:      1,
		MusicBatchMaxCount:   50,
		Live2DTotalMaxMB:     200,
		Live2DFileMaxCount:   300,
		ImageMaxDimension:    8192,
		ImageMaxPixels:       40_000_000,
		AvatarMaxDimension:   4096,
		AvatarMaxPixels:      16_000_000,
		AvatarMinDimension:   64,
	}
}

func getOrCreateUploadSettings() *model.UploadSettings {
	settings, err := repository.GetUploadSettings()
	if err == nil {
		applyUploadSettingsDefaults(settings)
		return settings
	}
	settings = defaultUploadSettings()
	if err == gorm.ErrRecordNotFound {
		_ = repository.CreateUploadSettings(settings)
	}
	return settings
}

func applyUploadSettingsDefaults(settings *model.UploadSettings) {
	defaults := defaultUploadSettings()
	if settings.ArticleImageMaxMB <= 0 {
		settings.ArticleImageMaxMB = defaults.ArticleImageMaxMB
	}
	if settings.ThemeBackgroundMaxMB <= 0 {
		settings.ThemeBackgroundMaxMB = defaults.ThemeBackgroundMaxMB
	}
	if settings.AvatarImageMaxMB <= 0 {
		settings.AvatarImageMaxMB = defaults.AvatarImageMaxMB
	}
	if settings.MusicFileMaxMB <= 0 {
		settings.MusicFileMaxMB = defaults.MusicFileMaxMB
	}
	if settings.LyricsFileMaxMB <= 0 {
		settings.LyricsFileMaxMB = defaults.LyricsFileMaxMB
	}
	if settings.MusicBatchMaxCount <= 0 {
		settings.MusicBatchMaxCount = defaults.MusicBatchMaxCount
	}
	if settings.Live2DTotalMaxMB <= 0 {
		settings.Live2DTotalMaxMB = defaults.Live2DTotalMaxMB
	}
	if settings.Live2DFileMaxCount <= 0 {
		settings.Live2DFileMaxCount = defaults.Live2DFileMaxCount
	}
	if settings.ImageMaxDimension <= 0 {
		settings.ImageMaxDimension = defaults.ImageMaxDimension
	}
	if settings.ImageMaxPixels <= 0 {
		settings.ImageMaxPixels = defaults.ImageMaxPixels
	}
	if settings.AvatarMaxDimension <= 0 {
		settings.AvatarMaxDimension = defaults.AvatarMaxDimension
	}
	if settings.AvatarMaxPixels <= 0 {
		settings.AvatarMaxPixels = defaults.AvatarMaxPixels
	}
	if settings.AvatarMinDimension <= 0 {
		settings.AvatarMinDimension = defaults.AvatarMinDimension
	}
}

func AdminGetUploadSettings(c *gin.Context) {
	response.Success(c, getOrCreateUploadSettings())
}

func AdminUpdateUploadSettings(c *gin.Context) {
	var payload model.UploadSettings
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid upload settings")
		return
	}

	settings := getOrCreateUploadSettings()
	settings.ArticleImageMaxMB = clampInt(payload.ArticleImageMaxMB, 1, 100)
	settings.ThemeBackgroundMaxMB = clampInt(payload.ThemeBackgroundMaxMB, 1, 100)
	settings.AvatarImageMaxMB = clampInt(payload.AvatarImageMaxMB, 1, 50)
	settings.MusicFileMaxMB = clampInt(payload.MusicFileMaxMB, 1, 500)
	settings.LyricsFileMaxMB = clampInt(payload.LyricsFileMaxMB, 1, 10)
	settings.MusicBatchMaxCount = clampInt(payload.MusicBatchMaxCount, 1, 200)
	settings.Live2DTotalMaxMB = clampInt(payload.Live2DTotalMaxMB, 1, 1000)
	settings.Live2DFileMaxCount = clampInt(payload.Live2DFileMaxCount, 1, 2000)
	settings.ImageMaxDimension = clampInt(payload.ImageMaxDimension, 512, 20000)
	settings.ImageMaxPixels = clampInt(payload.ImageMaxPixels, 1_000_000, 200_000_000)
	settings.AvatarMaxDimension = clampInt(payload.AvatarMaxDimension, 128, 12000)
	settings.AvatarMaxPixels = clampInt(payload.AvatarMaxPixels, 500_000, 80_000_000)
	settings.AvatarMinDimension = clampInt(payload.AvatarMinDimension, 32, settings.AvatarMaxDimension)

	if err := repository.UpdateUploadSettings(settings); err != nil {
		response.Error(c, http.StatusInternalServerError, "save upload settings failed")
		return
	}
	response.Success(c, settings)
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func bytesFromMB(value int) int64 {
	return int64(value) * mb
}
