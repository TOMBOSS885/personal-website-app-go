package handler

import (
	"net/http"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetProfile(c *gin.Context) {
	user, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取资料失败")
		return
	}
	response.Success(c, user)
}

func GetStats(c *gin.Context) {
	user, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to get user")
		return
	}

	projectCount, _ := repository.GetProjectCount()
	articleCount, _ := repository.GetArticleCount()
	
	starsCount := int64(user.StarsCount)
	if starsCount == 0 {
		starsCount, _ = repository.GetTotalStars()
	}

	response.Success(c, gin.H{
		"coffeeCount":  user.CoffeeCount,
		"projectCount": projectCount,
		"articleCount": articleCount,
		"starsCount":   starsCount,
	})
}

func GetArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "10"))
	tag := c.Query("tag")

	articles, total, err := repository.GetArticles(page, size, tag, true)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取文章失败")
		return
	}

	response.Page(c, articles, total, size, page)
}

func GetArticle(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	article, err := repository.GetArticleByID(id)
	if err != nil || !article.Published {
		response.Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	repository.IncrementArticleViews(id)
	response.Success(c, article)
}

func GetTags(c *gin.Context) {
	rawTags, err := repository.GetAllTagsRaw()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取标签失败")
		return
	}

	tagSet := make(map[string]bool)
	var tags []string
	for _, rt := range rawTags {
		parts := strings.Split(rt, ",")
		for _, t := range parts {
			t = strings.TrimSpace(t)
			if t != "" && !tagSet[t] {
				tagSet[t] = true
				tags = append(tags, t)
			}
		}
	}
	response.Success(c, tags)
}

func GetProjects(c *gin.Context) {
	projects, err := repository.GetProjects(false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取项目失败")
		return
	}
	response.Success(c, projects)
}

func GetFeaturedProjects(c *gin.Context) {
	projects, err := repository.GetProjects(true)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取项目失败")
		return
	}
	response.Success(c, projects)
}

func GetSkills(c *gin.Context) {
	skills, err := repository.GetSkills()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取技能失败")
		return
	}
	response.Success(c, skills)
}

func GetFeatureCards(c *gin.Context) {
	cards, err := repository.GetFeatureCards(true)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取能力卡片失败")
		return
	}
	response.Success(c, cards)
}

func GetTheme(c *gin.Context) {
	theme, err := repository.GetActiveTheme()
	if err != nil {
		response.Success(c, gin.H{"preset": "purple-pink"})
		return
	}

	if theme.PresetKey != "" {
		response.Success(c, gin.H{
			"id":     theme.ID,
			"name":   theme.Name,
			"preset": theme.PresetKey,
		})
	} else {
		response.Success(c, gin.H{
			"id":   theme.ID,
			"name": theme.Name,
			"custom": gin.H{
				"primary":         theme.PrimaryColor,
				"secondary":       theme.SecondaryColor,
				"accent":          theme.AccentColor,
				"background":      theme.Background,
				"backgroundStyle": theme.BackgroundStyle,
				"backgroundImage": theme.BackgroundImage,
				"cardBg":          theme.CardBg,
				"textPrimary":     theme.TextPrimary,
				"textSecondary":   theme.TextSecondary,
			},
		})
	}
}

func GetLive2DModel(c *gin.Context) {
	settings, err := repository.GetLive2DSettings()
	if err != nil || !settings.Enabled {
		response.Success(c, gin.H{"enabled": false})
		return
	}

	models, _ := repository.GetLive2DModels(true, false)
	if len(models) == 0 {
		models, _ = repository.GetLive2DModels(false, true)
	}
	
	if len(models) == 0 {
		response.Success(c, gin.H{"enabled": false})
		return
	}

	response.Success(c, gin.H{
		"enabled":  true,
		"settings": settings,
		"models":   models,
	})
}
