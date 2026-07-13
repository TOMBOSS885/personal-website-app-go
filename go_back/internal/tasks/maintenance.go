package tasks

import (
	"log"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/repository"
	"strings"
	"time"
)

func StartMaintenanceTasks() {
	go runArticleViewFlushLoop()
	go runSecurityAccessFlushLoop()
	go runLocalRateLimitCleanupLoop()
	go runDailyCleanupLoop()
}

func RunStartupMaintenance() {
	middleware.CleanupExpiredLocalRateLimits(time.Now())
	repository.CleanupSecurityLogs()
	repository.CleanupOperationLogs()
	repository.CleanupUserActivityData(time.Now())
	repository.CleanupMissingUploadAssets("")
	repository.FlushPendingArticleViews()
	repository.FlushPendingSecurityAccess()
	cleanupOrphanedArticleSites(time.Now())
}

func runSecurityAccessFlushLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		repository.FlushPendingSecurityAccess()
	}
}

func runArticleViewFlushLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		repository.FlushPendingArticleViews()
	}
}

func runLocalRateLimitCleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		if removed := middleware.CleanupExpiredLocalRateLimits(time.Now()); removed > 0 {
			log.Printf("cleaned %d expired local rate limit entries", removed)
		}
	}
}

func runDailyCleanupLoop() {
	for {
		time.Sleep(durationUntilNextCleanup())
		log.Println("running scheduled log cleanup")
		repository.CleanupSecurityLogs()
		repository.CleanupOperationLogs()
		repository.CleanupUserActivityData(time.Now())
		if removed, err := repository.CleanupMissingUploadAssets(""); err != nil {
			log.Printf("upload asset cleanup failed: %v", err)
		} else if removed > 0 {
			log.Printf("cleaned %d missing upload asset records", removed)
		}
		cleanupOrphanedArticleSites(time.Now())
	}
}

func cleanupOrphanedArticleSites(now time.Time) {
	keys, err := repository.GetReferencedArticleSiteKeys()
	if err != nil {
		log.Printf("article site cleanup skipped: %v", err)
		return
	}
	referenced := make(map[string]bool, len(keys))
	for _, key := range keys {
		referenced[strings.TrimSpace(key)] = true
	}
	root := filepath.Join(config.AppConfig.UploadDir, "article-sites")
	entries, err := os.ReadDir(root)
	if errorsIsNotExist(err) {
		return
	}
	if err != nil {
		log.Printf("article site cleanup failed: %v", err)
		return
	}
	removed := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		name := entry.Name()
		maxAge := 24 * time.Hour
		if strings.HasPrefix(name, ".tmp-") {
			maxAge = time.Hour
		} else if referenced[name] {
			continue
		}
		if now.Sub(info.ModTime()) < maxAge {
			continue
		}
		if err := os.RemoveAll(filepath.Join(root, name)); err == nil {
			removed++
		}
	}
	if removed > 0 {
		log.Printf("cleaned %d orphaned article site directories", removed)
	}
}

func errorsIsNotExist(err error) bool {
	return err != nil && os.IsNotExist(err)
}

func durationUntilNextCleanup() time.Duration {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, now.Location())
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return time.Until(next)
}
