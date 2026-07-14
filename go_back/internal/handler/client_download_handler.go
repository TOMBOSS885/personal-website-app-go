package handler

import (
	"errors"
	"net/http"
	"net/url"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxClientDownloadURLLength = 2048
	maxClientVersionLength     = 100
)

func getOrCreateClientDownloadSettings() *model.ClientDownloadSettings {
	settings, err := repository.GetClientDownloadSettings()
	if err == nil {
		return settings
	}

	settings = &model.ClientDownloadSettings{Enabled: false}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		_ = repository.CreateClientDownloadSettings(settings)
	}
	return settings
}

func normalizeClientDownloadURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if len(value) > maxClientDownloadURLLength {
		return "", errors.New("download URL is too long")
	}

	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("download URL must be an absolute HTTP or HTTPS URL")
	}
	if parsed.User != nil {
		return "", errors.New("download URL must not contain credentials")
	}
	return parsed.String(), nil
}

func GetClientDownload(c *gin.Context) {
	settings := getOrCreateClientDownloadSettings()
	downloadURL, err := normalizeClientDownloadURL(settings.DownloadURL)
	if !settings.Enabled || err != nil || downloadURL == "" {
		response.Success(c, gin.H{"enabled": false})
		return
	}

	response.Success(c, gin.H{
		"enabled":     true,
		"downloadUrl": downloadURL,
		"version":     settings.Version,
	})
}

func AdminGetClientDownload(c *gin.Context) {
	response.Success(c, getOrCreateClientDownloadSettings())
}

func AdminUpdateClientDownload(c *gin.Context) {
	var payload model.ClientDownloadSettings
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "客户端配置参数错误")
		return
	}

	downloadURL, err := normalizeClientDownloadURL(payload.DownloadURL)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "下载地址必须是有效的 HTTP 或 HTTPS 链接")
		return
	}
	if payload.Enabled && downloadURL == "" {
		response.Error(c, http.StatusBadRequest, "启用下载入口前请填写下载地址")
		return
	}

	version := strings.TrimSpace(payload.Version)
	if len(version) > maxClientVersionLength {
		response.Error(c, http.StatusBadRequest, "版本号不能超过 100 个字符")
		return
	}

	settings := getOrCreateClientDownloadSettings()
	settings.Enabled = payload.Enabled
	settings.DownloadURL = downloadURL
	settings.Version = version
	if err := repository.UpdateClientDownloadSettings(settings); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存客户端配置失败")
		return
	}
	response.Success(c, settings)
}
