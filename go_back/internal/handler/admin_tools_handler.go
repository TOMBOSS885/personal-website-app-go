package handler

import (
	"net/http"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

type SearchResult struct {
	Type        string    `json:"type"`
	ID          uint64    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	URL         string    `json:"url"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

func AdminDashboardStats(c *gin.Context) {
	articleCount, err := repository.GetArticleCount()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取统计失败")
		return
	}
	projectCount, err := repository.GetProjectCount()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取统计失败")
		return
	}
	skillCount, err := repository.GetSkillCount()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取统计失败")
		return
	}
	totalViews, err := repository.GetTotalArticleViews()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取统计失败")
		return
	}
	response.Success(c, gin.H{
		"articles": articleCount,
		"projects": projectCount,
		"skills":   skillCount,
		"views":    totalViews,
	})
}

func AdminGetOperationLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	action := strings.TrimSpace(c.Query("action"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	logs, total, err := repository.SearchOperationLogs(repository.OperationLogQuery{
		Page:    page,
		Size:    size,
		Action:  action,
		Keyword: keyword,
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取操作日志失败")
		return
	}
	response.Page(c, logs, total, size, page)
}

func AdminExportData(c *gin.Context) {
	payload := gin.H{}

	var users []model.User
	var articles []model.Article
	var projects []model.Project
	var skills []model.Skill
	var cards []model.FeatureCard
	var themes []model.Theme
	var musics []model.Music
	var live2dModels []model.Live2DModel
	var live2dSettings []model.Live2DSettings
	var uploadSettings []model.UploadSettings

	_ = db.DB.Find(&users).Error
	_ = db.DB.Find(&articles).Error
	_ = db.DB.Find(&projects).Error
	_ = db.DB.Find(&skills).Error
	_ = db.DB.Find(&cards).Error
	_ = db.DB.Find(&themes).Error
	_ = db.DB.Find(&musics).Error
	_ = db.DB.Find(&live2dModels).Error
	_ = db.DB.Find(&live2dSettings).Error
	_ = db.DB.Find(&uploadSettings).Error

	payload["exportedAt"] = time.Now()
	payload["users"] = users
	payload["articles"] = articles
	payload["projects"] = projects
	payload["skills"] = skills
	payload["featureCards"] = cards
	payload["themes"] = themes
	payload["musics"] = musics
	payload["live2dModels"] = live2dModels
	payload["live2dSettings"] = live2dSettings
	payload["uploadSettings"] = uploadSettings

	c.Header("Content-Disposition", "attachment; filename=personal-website-backup-"+time.Now().Format("20060102-150405")+".json")
	c.JSON(http.StatusOK, payload)
}

func PublicSearch(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" && utf8.RuneCountInString(keyword) < 2 {
		response.Success(c, []SearchResult{})
		return
	}
	if utf8.RuneCountInString(keyword) > 80 {
		response.Error(c, http.StatusBadRequest, "搜索关键词过长")
		return
	}
	results, err := searchAll(keyword, false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "搜索失败")
		return
	}
	response.Success(c, results)
}

func AdminSearch(c *gin.Context) {
	results, err := searchAll(strings.TrimSpace(c.Query("q")), true)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "搜索失败")
		return
	}
	response.Success(c, results)
}

func searchAll(keyword string, includeDrafts bool) ([]SearchResult, error) {
	if keyword == "" {
		return []SearchResult{}, nil
	}
	like := "%" + keyword + "%"
	results := make([]SearchResult, 0, 24)

	var articles []model.Article
	articleQuery := db.DB.Model(&model.Article{}).
		Select("id", "title", "summary", "category", "tags", "published", "updated_at")
	if !includeDrafts {
		articleQuery = articleQuery.
			Where("title LIKE ? OR summary LIKE ? OR category LIKE ? OR tags LIKE ?", like, like, like, like).
			Where("published = ? AND is_locked = ?", true, false)
	} else {
		articleQuery = articleQuery.Where("title LIKE ? OR summary LIKE ? OR category LIKE ? OR tags LIKE ? OR content LIKE ?", like, like, like, like, like)
	}
	if err := articleQuery.Order("updated_at DESC").Limit(12).Find(&articles).Error; err != nil {
		return nil, err
	}
	for _, item := range articles {
		results = append(results, SearchResult{
			Type:        "article",
			ID:          item.ID,
			Title:       item.Title,
			Description: firstNonEmpty(item.Summary, item.Category, item.Tags),
			URL:         "/blog/" + strconv.FormatUint(item.ID, 10),
			UpdatedAt:   item.UpdatedAt,
		})
	}

	var projects []model.Project
	if err := db.DB.Model(&model.Project{}).
		Where("name LIKE ? OR description LIKE ? OR tech_stack LIKE ?", like, like, like).
		Order("display_order ASC, updated_at DESC").
		Limit(8).
		Find(&projects).Error; err != nil {
		return nil, err
	}
	for _, item := range projects {
		results = append(results, SearchResult{
			Type:        "project",
			ID:          item.ID,
			Title:       item.Name,
			Description: firstNonEmpty(item.Description, item.TechStack),
			URL:         "/projects",
			UpdatedAt:   item.UpdatedAt,
		})
	}

	var skills []model.Skill
	if err := db.DB.Model(&model.Skill{}).
		Where("name LIKE ? OR category LIKE ?", like, like).
		Order("display_order ASC").
		Limit(8).
		Find(&skills).Error; err != nil {
		return nil, err
	}
	for _, item := range skills {
		results = append(results, SearchResult{
			Type:        "skill",
			ID:          item.ID,
			Title:       item.Name,
			Description: item.Category,
			URL:         "/",
		})
	}

	return results, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
