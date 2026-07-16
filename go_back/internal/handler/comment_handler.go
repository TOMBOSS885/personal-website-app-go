package handler

import (
	"net/http"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
)

const maxCommentRunes = 1000

func GetArticleComments(c *gin.Context) {
	setPrivateArticleResponseHeaders(c)
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || articleID == 0 {
		response.Error(c, http.StatusBadRequest, "文章参数无效")
		return
	}
	article, err := repository.GetArticleCommentAccessByID(articleID)
	if err != nil || !article.Published || normalizeArticleContentType(article.ContentType) == "static" {
		response.Error(c, http.StatusNotFound, "评论区不可用")
		return
	}
	if article.RequiresLogin {
		if _, authenticated := middleware.CurrentUser(c); !authenticated {
			response.Error(c, http.StatusUnauthorized, "登录后才能查看该文章评论")
			return
		}
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if page < 0 {
		page = 0
	}
	if size <= 0 || size > 50 {
		size = 20
	}
	comments, total, totalThreads, err := repository.ListArticleComments(articleID, page, size)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取评论失败")
		return
	}
	response.Success(c, gin.H{
		"comments": comments, "total": total, "totalThreads": totalThreads,
		"page": page, "size": size, "hasMore": int64((page+1)*size) < totalThreads,
	})
}

func CreateArticleComment(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "登录后才能评论")
		return
	}
	var req struct {
		ArticleID uint64  `json:"articleId" binding:"required"`
		ParentID  *uint64 `json:"parentId"`
		Content   string  `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "评论参数无效")
		return
	}
	article, err := repository.GetArticleCommentAccessByID(req.ArticleID)
	if err != nil || !article.Published {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	if normalizeArticleContentType(article.ContentType) == "static" {
		response.Error(c, http.StatusBadRequest, "HTML 项目不开放评论")
		return
	}
	content, err := normalizeCommentContent(req.Content)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if count, countErr := repository.CountRecentCommentsByUser(user.ID, time.Now().Add(-time.Minute)); countErr != nil {
		response.Error(c, http.StatusInternalServerError, "评论服务暂时不可用")
		return
	} else if count >= 5 {
		response.Error(c, http.StatusTooManyRequests, "评论过于频繁，请稍后再试")
		return
	}
	if req.ParentID != nil {
		parent, parentErr := repository.GetCommentByID(*req.ParentID)
		if parentErr != nil || parent.ArticleID != req.ArticleID || parent.Status != "visible" {
			response.Error(c, http.StatusBadRequest, "回复的评论不存在")
			return
		}
		if parent.ParentID != nil {
			req.ParentID = parent.ParentID
		}
	}
	comment := &model.Comment{
		ArticleID: req.ArticleID, UserID: user.ID, ParentID: req.ParentID,
		Content: content, Status: "visible",
	}
	if err := repository.CreateComment(comment); err != nil {
		response.Error(c, http.StatusInternalServerError, "发表评论失败")
		return
	}
	recordUserActivity(c, user, "create_comment", "article", strconv.FormatUint(req.ArticleID, 10))
	response.Success(c, model.CommentView{
		ID: comment.ID, ArticleID: comment.ArticleID, UserID: comment.UserID, ParentID: comment.ParentID,
		Content: comment.Content, Status: comment.Status, CreatedAt: comment.CreatedAt, UpdatedAt: comment.UpdatedAt,
		Username: user.Username,
	})
}

func UpdateOwnComment(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "评论参数无效")
		return
	}
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请输入评论内容")
		return
	}
	content, err := normalizeCommentContent(req.Content)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	rows, err := repository.UpdateCommentContent(id, user.ID, content, time.Now().Add(-15*time.Minute))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "更新评论失败")
		return
	}
	if rows == 0 {
		response.Error(c, http.StatusForbidden, "评论仅可在发布后 15 分钟内编辑")
		return
	}
	recordUserActivity(c, user, "update_comment", "comment", strconv.FormatUint(id, 10))
	response.Success(c, gin.H{"id": id, "content": content, "updatedAt": time.Now()})
}

func DeleteOwnComment(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "评论参数无效")
		return
	}
	rows, err := repository.SoftDeleteComment(id, user.ID, false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "删除评论失败")
		return
	}
	if rows == 0 {
		response.Error(c, http.StatusForbidden, "只能删除自己的评论")
		return
	}
	recordUserActivity(c, user, "delete_comment", "comment", strconv.FormatUint(id, 10))
	response.Success(c, gin.H{"message": "评论已删除"})
}

func normalizeCommentContent(value string) (string, error) {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) == 0 {
		return "", &commentValidationError{"评论内容不能为空"}
	}
	if len(runes) > maxCommentRunes {
		return "", &commentValidationError{"评论不能超过 1000 个字符"}
	}
	for _, r := range runes {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return "", &commentValidationError{"评论包含无效字符"}
		}
	}
	return value, nil
}

type commentValidationError struct{ message string }

func (e *commentValidationError) Error() string { return e.message }
