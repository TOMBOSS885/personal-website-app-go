package tasks

import (
	"log"
	"personal-website-go/internal/repository"
	"time"
)

func StartMaintenanceTasks() {
	go runArticleViewFlushLoop()
	go runDailyCleanupLoop()
}

func RunStartupMaintenance() {
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
