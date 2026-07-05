package repository

import (
	"context"
	"log"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strconv"
	"time"

	"gorm.io/gorm"
)

const pendingArticleViewsKey = "article:views:pending"

func IncrementArticleViewsBuffered(id uint64) (int64, error) {
	if id == 0 {
		return 0, nil
	}
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		defer cancel()
		value, err := cache.Client.HIncrBy(ctx, pendingArticleViewsKey, strconv.FormatUint(id, 10), 1).Result()
		if err == nil {
			return value, nil
		}
		log.Printf("redis article view increment failed, fallback to mysql: %v", err)
	}
	return 1, IncrementArticleViews(id)
}

func FlushPendingArticleViews() {
	if !cache.Ready() || db.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	values, err := cache.Client.HGetAll(ctx, pendingArticleViewsKey).Result()
	if err != nil || len(values) == 0 {
		return
	}

	for rawID, rawCount := range values {
		id, idErr := strconv.ParseUint(rawID, 10, 64)
		count, countErr := strconv.ParseInt(rawCount, 10, 64)
		if idErr != nil || countErr != nil || id == 0 || count <= 0 {
			_ = cache.Client.HDel(ctx, pendingArticleViewsKey, rawID).Err()
			continue
		}
		err := db.DB.Model(&model.Article{}).
			Where("id = ?", id).
			UpdateColumn("views", gorm.Expr("views + ?", count)).
			Error
		if err != nil {
			log.Printf("flush article views failed id=%d count=%d: %v", id, count, err)
			continue
		}
		remaining, err := cache.Client.HIncrBy(ctx, pendingArticleViewsKey, rawID, -count).Result()
		if err == nil && remaining <= 0 {
			_ = cache.Client.HDel(ctx, pendingArticleViewsKey, rawID).Err()
		}
	}
}
