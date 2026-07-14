package handler

import (
	"net/http"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func AdminUserSummary(c *gin.Context) {
	summary, err := repository.GetUserDashboardSummary(time.Now())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取用户统计失败")
		return
	}
	response.Success(c, summary)
}

func AdminListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	page, size = normalizePagination(page, size, 100)
	users, total, err := repository.ListMemberUsers(repository.UserListFilters{
		Keyword: c.Query("keyword"), Status: c.Query("status"), Page: page, Size: size,
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取用户列表失败")
		return
	}
	items := make([]gin.H, 0, len(users))
	for i := range users {
		user := &users[i]
		items = append(items, gin.H{
			"id": user.ID, "username": user.Username, "email": user.Email, "avatar": user.Avatar,
			"status": user.Status, "emailVerified": user.EmailVerified, "passwordConfigured": user.PasswordConfigured, "loginCount": user.LoginCount,
			"createdAt": user.CreatedAt, "lastLoginAt": user.LastLoginAt, "lastActiveAt": user.LastActiveAt,
		})
	}
	response.Page(c, items, total, size, page)
}

func AdminUpdateUserStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "用户参数无效")
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "状态参数无效")
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "active" && status != "disabled" {
		response.Error(c, http.StatusBadRequest, "状态参数无效")
		return
	}
	user, err := repository.GetUserByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "用户不存在")
		return
	}
	if strings.EqualFold(strings.TrimSpace(user.Role), "ADMIN") {
		response.Error(c, http.StatusForbidden, "不能修改管理员状态")
		return
	}
	if err := repository.UpdateUserStatus(id, status); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新用户状态失败")
		return
	}
	response.Success(c, gin.H{"id": id, "status": status})
}

func AdminListUserActivities(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "30"))
	page, size = normalizePagination(page, size, 100)
	items, total, err := repository.ListUserActivities(c.Query("keyword"), c.Query("action"), page, size)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取用户活动失败")
		return
	}
	response.Page(c, items, total, size, page)
}

func AdminListComments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "30"))
	page, size = normalizePagination(page, size, 100)
	items, total, err := repository.ListAdminComments(c.Query("keyword"), c.Query("status"), page, size)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取评论列表失败")
		return
	}
	response.Page(c, items, total, size, page)
}

func AdminUpdateCommentStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "评论参数无效")
		return
	}
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "状态参数无效")
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status != "visible" && status != "hidden" {
		response.Error(c, http.StatusBadRequest, "状态参数无效")
		return
	}
	if err := repository.UpdateCommentStatus(id, status); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新评论状态失败")
		return
	}
	response.Success(c, gin.H{"id": id, "status": status})
}

func AdminDeleteComment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "评论参数无效")
		return
	}
	if _, err := repository.SoftDeleteComment(id, 0, true); err != nil {
		response.Error(c, http.StatusInternalServerError, "删除评论失败")
		return
	}
	response.Success(c, gin.H{"message": "评论已删除"})
}
