package tasks

import (
	"log"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/repository"
	"time"
)

func StartMaintenanceTasks() {
	go runArticleViewFlushLoop()
	go runLocalRateLimitCleanupLoop()
	go runDailyCleanupLoop()
}

func RunStartupMaintenance() {
	middleware.CleanupExpiredLocalRateLimits(time.Now())
	repository.CleanupSecurityLogs()
	repository.CleanupOperationLogs()
	repository.FlushPendingArticleViews()
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
	}
}

func durationUntilNextCleanup() time.Duration {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, now.Location())
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return time.Until(next)
}
