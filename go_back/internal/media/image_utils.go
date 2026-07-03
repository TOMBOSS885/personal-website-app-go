package media

import (
	"image"
	"math"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
)

type ImageVariant struct {
	Suffix   string
	MaxWidth int
	Quality  int
}

type ImageResult struct {
	Name string
	Path string
	Size int64
}

func GenerateOptimizedVariants(srcPath, destDir, baseName string, variants []ImageVariant) ([]ImageResult, error) {
	if len(variants) == 0 {
		return nil, nil
	}

	img, err := openImage(srcPath)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	results := make([]ImageResult, 0, len(variants))
	for _, variant := range variants {
		out := resizeByWidth(img, variant.MaxWidth)
		name := baseName + variant.Suffix + ".jpg"
		target := filepath.Join(destDir, name)
		if err := saveJPEG(target, out, variant.Quality); err != nil {
			return results, err
		}
		info, err := os.Stat(target)
		if err != nil {
			return results, err
		}
		results = append(results, ImageResult{Name: name, Path: target, Size: info.Size()})
	}

	return results, nil
}

func GenerateSquarePNG(srcPath, destPath string, size int) (ImageResult, error) {
	if size <= 0 {
		size = 512
	}
	img, err := openImage(srcPath)
	if err != nil {
		return ImageResult{}, err
	}
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return ImageResult{}, err
	}
	out := imaging.Fill(img, size, size, imaging.Center, imaging.Lanczos)
	if err := imaging.Save(out, destPath); err != nil {
		return ImageResult{}, err
	}
	info, err := os.Stat(destPath)
	if err != nil {
		return ImageResult{}, err
	}
	return ImageResult{Name: filepath.Base(destPath), Path: destPath, Size: info.Size()}, nil
}

func IsStaticOptimizableImage(ext, contentType string) bool {
	ext = strings.ToLower(ext)
	contentType = strings.ToLower(contentType)
	return ext != ".gif" && contentType != "image/gif"
}

func openImage(path string) (image.Image, error) {
	return imaging.Open(path, imaging.AutoOrientation(true))
}

func resizeByWidth(img image.Image, maxWidth int) image.Image {
	if maxWidth <= 0 {
		return img
	}
	bounds := img.Bounds()
	width := bounds.Dx()
	if width <= maxWidth {
		return img
	}
	height := int(math.Round(float64(bounds.Dy()) * float64(maxWidth) / float64(width)))
	if height < 1 {
		height = 1
	}
	return imaging.Resize(img, maxWidth, height, imaging.Lanczos)
}

func saveJPEG(path string, img image.Image, quality int) error {
	if quality <= 0 || quality > 100 {
		quality = 82
	}
	return imaging.Save(img, path, imaging.JPEGQuality(quality))
}
