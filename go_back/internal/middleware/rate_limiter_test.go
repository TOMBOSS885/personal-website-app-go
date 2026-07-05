package middleware

import (
	"testing"
	"time"
)

func TestCleanupExpiredLocalRateLimits(t *testing.T) {
	now := time.Now()
	localRateStore.Lock()
	localRateStore.entries = map[string]localRateEntry{
		"rl:public:expired": {Count: 3, ResetAt: now.Add(-time.Second)},
		"rl:public:active":  {Count: 1, ResetAt: now.Add(time.Minute)},
	}
	localRateStore.Unlock()
	defer func() {
		localRateStore.Lock()
		localRateStore.entries = map[string]localRateEntry{}
		localRateStore.Unlock()
	}()

	removed := CleanupExpiredLocalRateLimits(now)
	if removed != 1 {
		t.Fatalf("expected 1 removed entry, got %d", removed)
	}

	localRateStore.Lock()
	defer localRateStore.Unlock()
	if _, ok := localRateStore.entries["rl:public:expired"]; ok {
		t.Fatal("expired local rate limit entry was not removed")
	}
	if _, ok := localRateStore.entries["rl:public:active"]; !ok {
		t.Fatal("active local rate limit entry was removed")
	}
}
