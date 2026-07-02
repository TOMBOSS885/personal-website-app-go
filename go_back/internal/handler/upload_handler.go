package handler

import (
	"errors"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/response"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxArticleImageSize = 10 * 1024 * 1024

var articleImageExts = []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}
var articleImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

type imageDTO struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Size int64  `json:"size"`
}

func AdminListArticleImages(c *gin.Context) {
	root := filepath.Join(config.AppConfig.UploadDir, "articles")
	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		response.Success(c, []imageDTO{})
		return
	}

	var images []imageDTO
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !allowedExt(strings.ToLower(filepath.Ext(path)), articleImageExts) {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		images = append(images, imageDTO{
			Name: filepath.Base(path),
			URL:  "/uploads/articles/" + filepath.ToSlash(rel),
			Size: info.Size(),
		})
		return nil
	})

	sort.Slice(images, func(i, j int) bool {
		return images[i].URL > images[j].URL
	})
	response.Success(c, images)
}

func AdminUploadArticleImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请选择要上传的图片。")
		return
	}
	if file.Size > maxArticleImageSize {
		response.Error(c, http.StatusBadRequest, "图片不能超过 10MB。")
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, articleImageExts) {
		response.Error(c, http.StatusBadRequest, "仅支持 jpg、png、gif、webp 图片。")
		return
	}
	contentType, err := detectUploadedContentType(file)
	if err != nil || !articleImageTypes[contentType] {
		response.Error(c, http.StatusBadRequest, "图片类型不被支持。")
		return
	}

	now := time.Now()
	dir := filepath.Join(config.AppConfig.UploadDir, "articles", now.Format("2006"), now.Format("01"))
	name := uuid.NewString() + ext
	target := filepath.Join(dir, name)
	if err := saveUploadedFile(c, file, dir, target); err != nil {
		response.Error(c, http.StatusInternalServerError, "上传失败")
		return
	}
	response.Success(c, imageDTO{
		Name: name,
		URL:  "/uploads/articles/" + now.Format("2006") + "/" + now.Format("01") + "/" + name,
		Size: file.Size,
	})
}

func saveUploadedFile(c *gin.Context, file *multipart.FileHeader, rootDir, target string) error {
	rootAbs, err := filepath.Abs(rootDir)
	if err != nil {
		return err
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(targetAbs, rootAbs+string(os.PathSeparator)) && targetAbs != rootAbs {
		return errors.New("invalid upload path")
	}
	if err := os.MkdirAll(filepath.Dir(targetAbs), 0755); err != nil {
		return err
	}
	return c.SaveUploadedFile(file, targetAbs)
}

func allowedExt(ext string, allowed []string) bool {
	for _, item := range allowed {
		if ext == item {
			return true
		}
	}
	return false
}

func detectUploadedContentType(file *multipart.FileHeader) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	buffer := make([]byte, 512)
	n, err := src.Read(buffer)
	if err != nil && n == 0 {
		return "", err
	}
	return strings.ToLower(http.DetectContentType(buffer[:n])), nil
}
