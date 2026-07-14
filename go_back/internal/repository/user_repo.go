package repository

import (
	"errors"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	MemberLoginMaxFailures  = 5
	MemberLoginLockDuration = 24 * time.Hour
)

type MemberLoginFailureState struct {
	Failures      int
	LockedUntil   *time.Time
	NewlyLocked   bool
	AlreadyLocked bool
}

func GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	err := db.DB.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByEmail(email string) (*model.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var user model.User
	err := db.DB.Where("email = ?", email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = db.DB.Where("LOWER(email) = ?", email).First(&user).Error
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func GetMemberUserByIdentifier(identifier string) (*model.User, error) {
	identifier = strings.TrimSpace(identifier)
	var user model.User
	err := db.DB.Where("(username = ? OR email = ?) AND COALESCE(UPPER(role), '') <> ?", identifier, strings.ToLower(identifier), "ADMIN").First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		normalized := strings.ToLower(identifier)
		err = db.DB.Where("(LOWER(username) = ? OR LOWER(email) = ?) AND COALESCE(UPPER(role), '') <> ?", normalized, normalized, "ADMIN").First(&user).Error
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByID(id uint64) (*model.User, error) {
	var user model.User
	err := db.DB.First(&user, id).Error
	return &user, err
}

func UsernameExists(username string, excludeUserID uint64) (bool, error) {
	var count int64
	username = strings.TrimSpace(username)
	query := db.DB.Model(&model.User{}).Where("username = ?", username)
	if excludeUserID > 0 {
		query = query.Where("id <> ?", excludeUserID)
	}
	err := query.Count(&count).Error
	if err == nil && count == 0 {
		query = db.DB.Model(&model.User{}).Where("LOWER(username) = ?", strings.ToLower(username))
		if excludeUserID > 0 {
			query = query.Where("id <> ?", excludeUserID)
		}
		err = query.Count(&count).Error
	}
	return count > 0, err
}

func CountUsers() (int64, error) {
	var count int64
	err := db.DB.Model(&model.User{}).Count(&count).Error
	return count, err
}

func CreateUser(user *model.User) error {
	return db.DB.Create(user).Error
}

func GetFirstUser() (*model.User, error) {
	var user model.User
	err := db.DB.First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func UpdateUser(user *model.User) error {
	return db.DB.Save(user).Error
}

func UpdateActiveMemberUsername(userID, tokenVersion uint64, username string) (int64, error) {
	result := db.DB.Model(&model.User{}).
		Where("id = ? AND LOWER(status) = ? AND COALESCE(UPPER(role), '') <> ? AND token_version = ?", userID, "active", "ADMIN", tokenVersion).
		Update("username", username)
	return result.RowsAffected, result.Error
}

func ResetActiveMemberPassword(userID uint64, passwordHash string) (int64, error) {
	result := db.DB.Model(&model.User{}).
		Where("id = ? AND LOWER(status) = ? AND COALESCE(UPPER(role), '') <> ?", userID, "active", "ADMIN").
		Updates(map[string]interface{}{
			"password":              passwordHash,
			"password_configured":   true,
			"token_version":         gorm.Expr("token_version + 1"),
			"failed_login_attempts": 0,
			"login_locked_until":    nil,
		})
	return result.RowsAffected, result.Error
}

func RecordMemberLoginFailure(userID uint64, now time.Time) (MemberLoginFailureState, error) {
	state := MemberLoginFailureState{}
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id", "failed_login_attempts", "login_locked_until").
			Where("id = ? AND COALESCE(UPPER(role), '') <> ?", userID, "ADMIN").
			First(&user).Error; err != nil {
			return err
		}

		state = nextMemberLoginFailureState(user.FailedLoginAttempts, user.LoginLockedUntil, now)
		if state.AlreadyLocked {
			return nil
		}
		return tx.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"failed_login_attempts": state.Failures,
			"login_locked_until":    state.LockedUntil,
		}).Error
	})
	return state, err
}

func ResetMemberLoginFailures(userID uint64) error {
	return db.DB.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"failed_login_attempts": 0,
		"login_locked_until":    nil,
	}).Error
}

func nextMemberLoginFailureState(currentFailures int, currentLockedUntil *time.Time, now time.Time) MemberLoginFailureState {
	if currentLockedUntil != nil && now.Before(*currentLockedUntil) {
		return MemberLoginFailureState{
			Failures:      currentFailures,
			LockedUntil:   currentLockedUntil,
			AlreadyLocked: true,
		}
	}
	if currentFailures < 0 || currentLockedUntil != nil {
		currentFailures = 0
	}

	state := MemberLoginFailureState{Failures: currentFailures + 1}
	if state.Failures >= MemberLoginMaxFailures {
		lockedUntil := now.Add(MemberLoginLockDuration)
		state.Failures = MemberLoginMaxFailures
		state.LockedUntil = &lockedUntil
		state.NewlyLocked = true
	}
	return state
}

func ListLockedMemberAccounts(now time.Time) ([]model.User, error) {
	var users []model.User
	err := db.DB.Select("id", "username", "email", "failed_login_attempts", "login_locked_until").
		Where("COALESCE(UPPER(role), '') <> ? AND login_locked_until > ?", "ADMIN", now).
		Order("login_locked_until DESC").
		Limit(200).
		Find(&users).Error
	return users, err
}

func RecordUserLogin(userID uint64, now time.Time) error {
	return db.DB.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"last_login_at":  now,
		"last_active_at": now,
		"login_count":    gorm.Expr("login_count + 1"),
	}).Error
}

func TouchUserActivity(userID uint64, now time.Time) error {
	return db.DB.Model(&model.User{}).
		Where("id = ? AND (last_active_at IS NULL OR last_active_at < ?)", userID, now.Add(-2*time.Minute)).
		Update("last_active_at", now).Error
}

func UpdateUserStatus(userID uint64, status string) error {
	updates := map[string]interface{}{
		"status":        status,
		"token_version": gorm.Expr("token_version + 1"),
	}
	if strings.EqualFold(strings.TrimSpace(status), "active") {
		updates["failed_login_attempts"] = 0
		updates["login_locked_until"] = nil
	}
	return db.DB.Model(&model.User{}).Where("id = ? AND UPPER(role) <> ?", userID, "ADMIN").Updates(updates).Error
}

func RevokeUserSessions(userID uint64) error {
	return db.DB.Model(&model.User{}).Where("id = ?", userID).Update("token_version", gorm.Expr("token_version + 1")).Error
}

type UserListFilters struct {
	Keyword string
	Status  string
	Page    int
	Size    int
}

func ListMemberUsers(filters UserListFilters) ([]model.User, int64, error) {
	var users []model.User
	var total int64
	query := db.DB.Model(&model.User{}).Where("UPPER(role) <> ?", "ADMIN")
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ?", like, like)
	}
	if status := strings.TrimSpace(filters.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if filters.Page < 0 {
		filters.Page = 0
	}
	if filters.Size <= 0 || filters.Size > 100 {
		filters.Size = 20
	}
	err := query.Order("created_at DESC, id DESC").Offset(filters.Page * filters.Size).Limit(filters.Size).Find(&users).Error
	return users, total, err
}

type UserDashboardSummary struct {
	TotalUsers    int64 `json:"totalUsers"`
	Active24Hours int64 `json:"active24Hours"`
	Active7Days   int64 `json:"active7Days"`
	New7Days      int64 `json:"new7Days"`
	DisabledUsers int64 `json:"disabledUsers"`
	TotalComments int64 `json:"totalComments"`
}

func GetUserDashboardSummary(now time.Time) (UserDashboardSummary, error) {
	var result UserDashboardSummary
	memberQuery := func() *gorm.DB {
		return db.DB.Model(&model.User{}).Where("COALESCE(UPPER(role), '') <> ?", "ADMIN")
	}
	queries := []struct {
		dest  *int64
		query *gorm.DB
	}{
		{&result.TotalUsers, memberQuery()},
		{&result.Active24Hours, memberQuery().Where("last_active_at >= ?", now.Add(-24*time.Hour))},
		{&result.Active7Days, memberQuery().Where("last_active_at >= ?", now.Add(-7*24*time.Hour))},
		{&result.New7Days, memberQuery().Where("created_at >= ?", now.Add(-7*24*time.Hour))},
		{&result.DisabledUsers, memberQuery().Where("status = ?", "disabled")},
	}
	for _, item := range queries {
		if err := item.query.Count(item.dest).Error; err != nil {
			return result, err
		}
	}
	if err := db.DB.Model(&model.Comment{}).Where("deleted_at IS NULL").Count(&result.TotalComments).Error; err != nil {
		return result, err
	}
	return result, nil
}
