package handler

import (
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"
	"strings"

	_ "golang.org/x/image/webp"
)

func imageTypeMatchesExtension(ext, contentType string) bool {
	ext = strings.ToLower(strings.TrimSpace(ext))
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	switch ext {
	case ".jpg", ".jpeg":
		return contentType == "image/jpeg"
	case ".png":
		return contentType == "image/png"
	case ".gif":
		return contentType == "image/gif"
	case ".webp":
		return contentType == "image/webp"
	case ".avif":
		return contentType == "image/avif"
	default:
		return false
	}
}

const (
	maxGeneralImageDimension = 8192
	maxGeneralImagePixels    = 40_000_000
	maxAvatarImageDimension  = 4096
	maxAvatarImagePixels     = 16_000_000
	minAvatarImageDimension  = 64
)

func decodeUploadedImageConfig(file *multipart.FileHeader) (image.Config, string, error) {
	src, err := file.Open()
	if err != nil {
		return image.Config{}, "", err
	}
	defer src.Close()

	return image.DecodeConfig(src)
}

func validateUploadedImageDimensions(file *multipart.FileHeader, minDimension, maxDimension, maxPixels int) error {
	cfg, _, err := decodeUploadedImageConfig(file)
	if err != nil {
		return err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return errors.New("invalid image dimensions")
	}
	if minDimension > 0 && (cfg.Width < minDimension || cfg.Height < minDimension) {
		return errors.New("image is too small")
	}
	if maxDimension > 0 && (cfg.Width > maxDimension || cfg.Height > maxDimension) {
		return errors.New("image dimensions are too large")
	}
	if maxPixels > 0 && cfg.Width*cfg.Height > maxPixels {
		return errors.New("image pixel count is too large")
	}
	return nil
}
