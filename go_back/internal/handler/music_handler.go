package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxMusicSize = 50 * 1024 * 1024

var musicExts = []string{".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"}
var musicTypes = map[string]bool{
	"audio/mpeg":               true,
	"audio/wav":                true,
	"audio/x-wav":              true,
	"audio/ogg":                true,
	"audio/mp4":                true,
	"audio/aac":                true,
	"audio/flac":               true,
	"application/ogg":          true,
	"application/octet-stream": true,
}

func GetMusics(c *gin.Context) {
	musics, err := repository.GetMusics()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取音乐列表失败")
		return
	}
	response.Success(c, musics)
}

func AdminGetMusics(c *gin.Context) {
	GetMusics(c)
}

func AdminUploadMusic(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请选择要上传的音乐文件")
		return
	}
	if file.Size > maxMusicSize {
		response.Error(c, http.StatusBadRequest, "音乐文件不能超过 50MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, musicExts) {
		response.Error(c, http.StatusBadRequest, "仅支持 mp3、wav、ogg、m4a、aac、flac 音频")
		return
	}

	contentType, err := detectUploadedContentType(file)
	headerType := strings.ToLower(file.Header.Get("Content-Type"))
	if err != nil || (!musicTypes[contentType] && !strings.HasPrefix(contentType, "audio/") && !strings.HasPrefix(headerType, "audio/")) {
		response.Error(c, http.StatusBadRequest, "音乐文件类型不被支持")
		return
	}
	if strings.HasPrefix(headerType, "audio/") {
		contentType = headerType
	}

	now := time.Now()
	dir := filepath.Join(config.AppConfig.UploadDir, "music", now.Format("2006"), now.Format("01"))
	name := uuid.NewString() + ext
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "上传音乐失败")
		return
	}

	title := strings.TrimSpace(c.PostForm("title"))
	if title == "" {
		title = strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
	}
	displayOrder, _ := strconv.Atoi(c.DefaultPostForm("displayOrder", "0"))
	music := model.Music{
		Title:        title,
		Artist:       strings.TrimSpace(c.PostForm("artist")),
		FileURL:      "/uploads/music/" + now.Format("2006") + "/" + now.Format("01") + "/" + name,
		FileName:     file.Filename,
		ContentType:  contentType,
		Size:         file.Size,
		DisplayOrder: displayOrder,
	}
	if err := repository.CreateMusic(&music); err != nil {
		_ = os.Remove(target)
		response.Error(c, http.StatusInternalServerError, "保存音乐信息失败")
		return
	}
	response.Success(c, music)
}

func AdminDeleteMusic(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetMusicByID(id)
	if err == nil {
		_ = repository.DeleteMusic(id)
		_ = removeUploadedMusic(existing.FileURL)
	}
	response.Success(c, nil)
}

func removeUploadedMusic(fileURL string) error {
	if !strings.HasPrefix(fileURL, "/uploads/music/") {
		return nil
	}
	rel := strings.TrimPrefix(fileURL, "/uploads/")
	target := filepath.Join(config.AppConfig.UploadDir, filepath.FromSlash(rel))
	uploadAbs, err := filepath.Abs(config.AppConfig.UploadDir)
	if err != nil {
		return err
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(targetAbs, uploadAbs+string(os.PathSeparator)) {
		return nil
	}
	return os.Remove(targetAbs)
}
