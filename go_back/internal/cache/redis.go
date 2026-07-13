package cache

import (
	"context"
	"log"
	"personal-website-go/internal/config"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

var health = struct {
	sync.RWMutex
	failures int
	retryAt  time.Time
}{}

func InitRedis() {
	if config.AppConfig == nil || !config.AppConfig.RedisEnabled {
		return
	}

	Client = redis.NewClient(&redis.Options{
		Addr:     config.AppConfig.RedisAddr,
		Password: config.AppConfig.RedisPassword,
		DB:       config.AppConfig.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		MarkFailure(err)
		log.Printf("redis unavailable at startup; local fallbacks are active and reconnects will be retried: %v", err)
		return
	}

	MarkSuccess()
	log.Printf("redis connected: %s db=%d", config.AppConfig.RedisAddr, config.AppConfig.RedisDB)
}

func Ready() bool {
	if Client == nil {
		return false
	}
	health.RLock()
	retryAt := health.retryAt
	health.RUnlock()
	return retryAt.IsZero() || !time.Now().Before(retryAt)
}

func MarkSuccess() {
	health.Lock()
	health.failures = 0
	health.retryAt = time.Time{}
	health.Unlock()
}

func MarkFailure(err error) {
	if err == nil {
		return
	}
	health.Lock()
	health.failures++
	delay := time.Second << min(health.failures-1, 5)
	if delay > 30*time.Second {
		delay = 30 * time.Second
	}
	health.retryAt = time.Now().Add(delay)
	health.Unlock()
}

func Close() error {
	if Client == nil {
		return nil
	}
	return Client.Close()
}
