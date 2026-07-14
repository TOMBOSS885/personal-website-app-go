package repository

import (
	"testing"
	"time"
)

func TestNextMemberLoginFailureStateLocksOnFifthFailure(t *testing.T) {
	now := time.Date(2026, time.July, 14, 12, 0, 0, 0, time.UTC)
	for failures := 0; failures < MemberLoginMaxFailures-1; failures++ {
		state := nextMemberLoginFailureState(failures, nil, now)
		if state.Failures != failures+1 || state.LockedUntil != nil || state.NewlyLocked {
			t.Fatalf("failure %d produced unexpected state: %+v", failures+1, state)
		}
	}

	state := nextMemberLoginFailureState(MemberLoginMaxFailures-1, nil, now)
	if !state.NewlyLocked || state.LockedUntil == nil {
		t.Fatalf("fifth failure did not lock the account: %+v", state)
	}
	if got := state.LockedUntil.Sub(now); got != MemberLoginLockDuration {
		t.Fatalf("lock duration = %v, want %v", got, MemberLoginLockDuration)
	}
}

func TestNextMemberLoginFailureStateKeepsActiveLock(t *testing.T) {
	now := time.Date(2026, time.July, 14, 12, 0, 0, 0, time.UTC)
	lockedUntil := now.Add(time.Hour)
	state := nextMemberLoginFailureState(MemberLoginMaxFailures, &lockedUntil, now)
	if !state.AlreadyLocked || state.NewlyLocked || state.LockedUntil != &lockedUntil {
		t.Fatalf("active lock changed unexpectedly: %+v", state)
	}
}

func TestNextMemberLoginFailureStateRestartsAfterExpiredLock(t *testing.T) {
	now := time.Date(2026, time.July, 14, 12, 0, 0, 0, time.UTC)
	expiredAt := now.Add(-time.Second)
	state := nextMemberLoginFailureState(MemberLoginMaxFailures, &expiredAt, now)
	if state.Failures != 1 || state.LockedUntil != nil || state.NewlyLocked || state.AlreadyLocked {
		t.Fatalf("expired lock did not restart the counter: %+v", state)
	}
}
