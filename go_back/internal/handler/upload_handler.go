package handler

import (
	"errors"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/media"
	"personal-website-go/internal/response"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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
		base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
		if !strings.HasSuffix(base, "@optimized") {
			optimizedPath := filepath.Join(filepath.Dir(path), base+"@optimized.jpg")
			if _, err := os.Stat(optimizedPath); err == nil {
				return nil
			}
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
	settings := getOrCreateUploadSettings()
	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "请选择要上传的图片。")
		return
	}
	if file.Size > bytesFromMB(settings.ArticleImageMaxMB) {
		response.Error(c, http.StatusBadRequest, "image exceeds configured upload size limit")
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

	if err := validateUploadedImageDimensions(file, 0, settings.ImageMaxDimension, settings.ImageMaxPixels); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid or oversized image dimensions")
		return
	}

	now := time.Now()
	dir := filepath.Join(config.AppConfig.UploadDir, "articles", now.Format("2006"), now.Format("01"))
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
			{Suffix: "@optimized", MaxWidth: 1920, Quality: 82},
		})
		if err != nil {
			log.Printf("article image optimization failed: %v", err)
		} else if len(results) > 0 {
			responseName = results[0].Name
			responseSize = results[0].Size
		}
	}

	response.Success(c, imageDTO{
		Name: responseName,
		URL:  "/uploads/articles/" + now.Format("2006") + "/" + now.Format("01") + "/" + responseName,
		Size: responseSize,
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
