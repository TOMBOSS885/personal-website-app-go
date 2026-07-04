package handler

import (
	"errors"
	"mime/multipart"
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

var musicExts = []string{".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"}
var lyricsExts = []string{".lrc"}

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

type preparedMusicFile struct {
	file        *multipart.FileHeader
	ext         string
	contentType string
}

type batchDeleteMusicRequest struct {
	IDs []uint64 `json:"ids"`
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
	settings := getOrCreateUploadSettings()
	form, err := c.MultipartForm()
	if err != nil || form == nil {
		response.Error(c, http.StatusBadRequest, "请选择要上传的音乐文件")
		return
	}

	files := append([]*multipart.FileHeader{}, form.File["files"]...)
	files = append(files, form.File["file"]...)
	if len(files) == 0 {
		response.Error(c, http.StatusBadRequest, "请选择要上传的音乐文件")
		return
	}
	if len(files) > settings.MusicBatchMaxCount {
		response.Error(c, http.StatusBadRequest, "too many music files in one upload")
		return
	}

	prepared := make([]preparedMusicFile, 0, len(files))
	for _, file := range files {
		item, err := prepareMusicFile(file, settings)
		if err != nil {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		prepared = append(prepared, item)
	}

	now := time.Now()
	dir := filepath.Join(config.AppConfig.UploadDir, "music", now.Format("2006"), now.Format("01"))
	displayOrder, _ := strconv.Atoi(c.DefaultPostForm("displayOrder", "0"))
	artist := strings.TrimSpace(c.PostForm("artist"))
	title := strings.TrimSpace(c.PostForm("title"))
	singleUpload := len(files) == 1

	uploaded := make([]model.Music, 0, len(prepared))
	for index, item := range prepared {
		name := uuid.NewString() + item.ext
		target := filepath.Join(dir, name)
		if err := saveUploadedFile(c, item.file, dir, target); err != nil {
			cleanupUploadedMusic(uploaded)
			response.Error(c, http.StatusInternalServerError, "上传音乐失败")
			return
		}

		musicTitle := strings.TrimSuffix(item.file.Filename, filepath.Ext(item.file.Filename))
		if singleUpload && title != "" {
			musicTitle = title
		}

		music := model.Music{
			Title:        musicTitle,
			Artist:       artist,
			FileURL:      "/uploads/music/" + now.Format("2006") + "/" + now.Format("01") + "/" + name,
			FileName:     item.file.Filename,
			ContentType:  item.contentType,
			Size:         item.file.Size,
			DisplayOrder: displayOrder + index,
		}
		if err := repository.CreateMusic(&music); err != nil {
			_ = os.Remove(target)
			cleanupUploadedMusic(uploaded)
			response.Error(c, http.StatusInternalServerError, "保存音乐信息失败")
			return
		}
		uploaded = append(uploaded, music)
	}

	if singleUpload {
		response.Success(c, uploaded[0])
		return
	}
	response.Success(c, uploaded)
}

func AdminDeleteMusic(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetMusicByID(id)
	if err == nil {
		_ = repository.DeleteMusic(id)
		_ = removeUploadedMusic(existing.FileURL)
		_ = removeUploadedLyrics(existing.LyricsURL)
	}
	response.Success(c, nil)
}

func AdminBatchDeleteMusic(c *gin.Context) {
	var req batchDeleteMusicRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		response.Error(c, http.StatusBadRequest, "请选择要删除的音乐")
		return
	}

	ids := uniqueMusicIDs(req.IDs)
	if len(ids) == 0 {
		response.Error(c, http.StatusBadRequest, "请选择要删除的音乐")
		return
	}

	existing, err := repository.GetMusicsByIDs(ids)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取音乐信息失败")
		return
	}
	if len(existing) == 0 {
		response.Success(c, gin.H{"deleted": 0})
		return
	}

	if err := repository.DeleteMusics(ids); err != nil {
		response.Error(c, http.StatusInternalServerError, "删除音乐失败")
		return
	}
	for _, music := range existing {
		_ = removeUploadedMusic(music.FileURL)
		_ = removeUploadedLyrics(music.LyricsURL)
	}
	response.Success(c, gin.H{"deleted": len(existing)})
}

func AdminUploadMusicLyrics(c *gin.Context) {
	settings := getOrCreateUploadSettings()
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	music, err := repository.GetMusicByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "music not found")
		return
	}

	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "please select an lrc file")
		return
	}
	if err := validateLyricsFile(file, settings); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "music-lyrics", strconv.FormatUint(id, 10))
	name := uuid.NewString() + ".lrc"
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "upload lyrics failed")
		return
	}

	oldLyricsURL := music.LyricsURL
	music.LyricsURL = "/uploads/music-lyrics/" + strconv.FormatUint(id, 10) + "/" + name
	music.LyricsName = file.Filename
	music.LyricsSize = file.Size
	if err := repository.UpdateMusic(music); err != nil {
		_ = os.Remove(target)
		response.Error(c, http.StatusInternalServerError, "save lyrics info failed")
		return
	}
	if oldLyricsURL != "" && oldLyricsURL != music.LyricsURL {
		_ = removeUploadedLyrics(oldLyricsURL)
	}

	response.Success(c, music)
}

func AdminDeleteMusicLyrics(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	music, err := repository.GetMusicByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "music not found")
		return
	}

	oldLyricsURL := music.LyricsURL
	music.LyricsURL = ""
	music.LyricsName = ""
	music.LyricsSize = 0
	if err := repository.UpdateMusic(music); err != nil {
		response.Error(c, http.StatusInternalServerError, "remove lyrics info failed")
		return
	}
	_ = removeUploadedLyrics(oldLyricsURL)
	response.Success(c, music)
}

func prepareMusicFile(file *multipart.FileHeader, settings *model.UploadSettings) (preparedMusicFile, error) {
	if file == nil {
		return preparedMusicFile{}, errors.New("请选择要上传的音乐文件")
	}
	if file.Size > bytesFromMB(settings.MusicFileMaxMB) {
		return preparedMusicFile{}, errors.New(file.Filename + " exceeds configured upload size limit")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, musicExts) {
		return preparedMusicFile{}, errors.New(file.Filename + " 的格式不支持，仅支持 mp3、wav、ogg、m4a、aac、flac")
	}

	contentType, err := detectUploadedContentType(file)
	headerType := strings.ToLower(file.Header.Get("Content-Type"))
	if err != nil || (!musicTypes[contentType] && !strings.HasPrefix(contentType, "audio/") && !strings.HasPrefix(headerType, "audio/")) {
		return preparedMusicFile{}, errors.New(file.Filename + " 的文件类型不被支持")
	}
	if strings.HasPrefix(headerType, "audio/") {
		contentType = headerType
	}

	return preparedMusicFile{
		file:        file,
		ext:         ext,
		contentType: contentType,
	}, nil
}

func validateLyricsFile(file *multipart.FileHeader, settings *model.UploadSettings) error {
	if file.Size <= 0 {
		return errors.New("lyrics file is empty")
	}
	if file.Size > bytesFromMB(settings.LyricsFileMaxMB) {
		return errors.New("lyrics file exceeds configured upload size limit")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, lyricsExts) {
		return errors.New("lyrics file must be .lrc")
	}

	contentType, err := detectUploadedContentType(file)
	headerType := strings.ToLower(file.Header.Get("Content-Type"))
	if err != nil {
		return errors.New("cannot read lyrics file")
	}
	if contentType != "text/plain; charset=utf-8" &&
		contentType != "text/plain; charset=utf-16le" &&
		contentType != "text/plain; charset=utf-16be" &&
		!strings.HasPrefix(contentType, "text/plain") &&
		!strings.HasPrefix(headerType, "text/") &&
		contentType != "application/octet-stream" {
		return errors.New("lyrics file must be plain text")
	}
	return nil
}

func cleanupUploadedMusic(musics []model.Music) {
	for _, music := range musics {
		_ = repository.DeleteMusic(music.ID)
		_ = removeUploadedMusic(music.FileURL)
	}
}

func uniqueMusicIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]bool, len(ids))
	unique := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		unique = append(unique, id)
	}
	return unique
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

func removeUploadedLyrics(fileURL string) error {
	if !strings.HasPrefix(fileURL, "/uploads/music-lyrics/") {
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
