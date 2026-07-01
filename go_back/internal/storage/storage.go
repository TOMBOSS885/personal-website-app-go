package storage

import (
	"errors"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
)

// SaveFile 安全保存上传的文件到指定目录
func SaveFile(file *multipart.FileHeader, dest string) error {
	// 防止路径穿越
	if strings.Contains(dest, "..") {
		return errors.New("invalid path")
	}
	
	// 确保目录存在
	dir := filepath.Dir(dest)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	return err
}

func CleanPath(p string) string {
	p = strings.ReplaceAll(p, "\\", "/")
	p = strings.TrimPrefix(p, "/")
	// 防止基础路径穿越
	p = strings.ReplaceAll(p, "..", "")
	return p
}
