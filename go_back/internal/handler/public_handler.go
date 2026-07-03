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
	isEn := strings.EqualFold(c.DefaultQuery("lang", "zh"), "en")
	response.Success(c, gin.H{
		"avatar":         user.Avatar,
		"nickname":       user.Nickname,
		"location":       user.Location,
		"website":        user.Website,
		"github":         user.Github,
		"twitter":        user.Twitter,
		"linkedin":       user.Linkedin,
		"emailPublic":    user.EmailPublic,
		"coffeeCount":    user.CoffeeCount,
		"starsCount":     user.StarsCount,
		"bio":            localized(isEn, user.Bio, user.BioEn),
		"tags":           localized(isEn, user.Tags, user.TagsEn),
		"welcomeText":    localized(isEn, user.WelcomeText, user.WelcomeTextEn),
		"ctaTitle":       localized(isEn, user.CtaTitle, user.CtaTitleEn),
		"ctaDescription": localized(isEn, user.CtaDesc, user.CtaDescEn),
	})
}

func GetStats(c *gin.Context) {
	user, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取用户失败")
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

	articles, total, err := repository.GetArticleSummaries(page, size, tag)
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
	_ = repository.IncrementArticleViews(id)
	article.Views++
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
	for _, raw := range rawTags {
		for _, tag := range strings.Split(raw, ",") {
			tag = strings.TrimSpace(tag)
			if tag != "" && !tagSet[tag] {
				tagSet[tag] = true
				tags = append(tags, tag)
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
	writeThemeResponse(c, theme)
}

func GetLive2DModel(c *gin.Context) {
	settings := getOrCreateLive2DSettings()
	if !settings.Enabled {
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

	attachLive2DThumbnails(models)
	response.Success(c, gin.H{
		"enabled":  true,
		"settings": settings,
		"models":   models,
	})
}

func localized(isEn bool, zh, en string) string {
	if isEn && en != "" {
		return en
	}
	return zh
}
