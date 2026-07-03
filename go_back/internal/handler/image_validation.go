package handler

import (
	"image"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"

	_ "golang.org/x/image/webp"
)

func decodeUploadedImageConfig(file *multipart.FileHeader) (image.Config, string, error) {
	src, err := file.Open()
	if err != nil {
		return image.Config{}, "", err
	}
	defer src.Close()

	return image.DecodeConfig(src)
}
