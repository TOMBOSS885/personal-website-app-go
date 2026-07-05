package cache

import (
	"context"
	"log"
	"personal-website-go/internal/config"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

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
		log.Printf("redis disabled: cannot connect to %s: %v", config.AppConfig.RedisAddr, err)
		_ = Client.Close()
		Client = nil
		return
	}

	log.Printf("redis connected: %s db=%d", config.AppConfig.RedisAddr, config.AppConfig.RedisDB)
}

func Ready() bool {
	return Client != nil
}

func DeleteByPrefix(ctx context.Context, prefix string) {
	if !Ready() || strings.TrimSpace(prefix) == "" {
		return
	}

	var cursor uint64
	pattern := prefix + "*"
	for {
		keys, next, err := Client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			log.Printf("redis cache invalidation failed for %q: %v", prefix, err)
			return
		}
		if len(keys) > 0 {
			if err := Client.Del(ctx, keys...).Err(); err != nil {
				log.Printf("redis cache delete failed for %q: %v", prefix, err)
				return
			}
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}
