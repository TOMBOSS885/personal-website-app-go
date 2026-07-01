package handler

import (
	"net/http"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func AdminGetProjects(c *gin.Context) {
	projects, err := repository.GetProjects(false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取项目失败")
		return
	}
	response.Success(c, projects)
}

func AdminCreateProject(c *gin.Context) {
	var project model.Project
	if err := c.ShouldBindJSON(&project); err != nil || project.Name == "" {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if err := repository.CreateProject(&project); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存项目失败")
		return
	}
	response.Success(c, project)
}

func AdminUpdateProject(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetProjectByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "项目不存在")
		return
	}

	var payload model.Project
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Name = payload.Name
	existing.Description = payload.Description
	existing.CoverImage = payload.CoverImage
	existing.TechStack = payload.TechStack
	existing.GithubUrl = payload.GithubUrl
	existing.DemoUrl = payload.DemoUrl
	existing.Featured = payload.Featured
	existing.DisplayOrder = payload.DisplayOrder

	if err := repository.UpdateProject(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新项目失败")
		return
	}
	response.Success(c, existing)
}

func AdminDeleteProject(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	_ = repository.DeleteProject(id)
	response.Success(c, nil)
}

func AdminGetSkills(c *gin.Context) {
	skills, err := repository.GetSkills()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取技能失败")
		return
	}
	response.Success(c, skills)
}

func AdminCreateSkill(c *gin.Context) {
	var skill model.Skill
	if err := c.ShouldBindJSON(&skill); err != nil || skill.Name == "" {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if err := repository.CreateSkill(&skill); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存技能失败")
		return
	}
	response.Success(c, skill)
}

func AdminUpdateSkill(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetSkillByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "技能不存在")
		return
	}

	var payload model.Skill
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Name = payload.Name
	existing.Category = payload.Category
	existing.Proficiency = payload.Proficiency
	existing.Icon = payload.Icon
	existing.DisplayOrder = payload.DisplayOrder

	if err := repository.UpdateSkill(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新技能失败")
		return
	}
	response.Success(c, existing)
}

func AdminDeleteSkill(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	_ = repository.DeleteSkill(id)
	response.Success(c, nil)
}

func AdminGetFeatureCards(c *gin.Context) {
	cards, err := repository.GetFeatureCards(false)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取能力卡片失败")
		return
	}
	response.Success(c, cards)
}

func AdminCreateFeatureCard(c *gin.Context) {
	var card model.FeatureCard
	if err := c.ShouldBindJSON(&card); err != nil || card.Title == "" {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if card.Icon == "" {
		card.Icon = "Code"
	}
	if card.Gradient == "" {
		card.Gradient = "from-blue-500 to-cyan-500"
	}
	if err := repository.CreateFeatureCard(&card); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存能力卡片失败")
		return
	}
	response.Success(c, card)
}

func AdminUpdateFeatureCard(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	existing, err := repository.GetFeatureCardByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "能力卡片不存在")
		return
	}

	var payload model.FeatureCard
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Title = payload.Title
	existing.TitleEn = payload.TitleEn
	existing.Description = payload.Description
	existing.DescriptionEn = payload.DescriptionEn
	existing.Icon = payload.Icon
	existing.Gradient = payload.Gradient
	existing.DisplayOrder = payload.DisplayOrder
	existing.Enabled = payload.Enabled

	if err := repository.UpdateFeatureCard(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新能力卡片失败")
		return
	}
	response.Success(c, existing)
}

func AdminDeleteFeatureCard(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	_ = repository.DeleteFeatureCard(id)
	response.Success(c, nil)
}

func AdminGetProfile(c *gin.Context) {
	user, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusNotFound, "资料不存在")
		return
	}
	response.Success(c, user)
}

func AdminUpdateProfile(c *gin.Context) {
	existing, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusNotFound, "资料不存在")
		return
	}

	var payload model.User
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	existing.Nickname = payload.Nickname
	existing.Bio = payload.Bio
	existing.Location = payload.Location
	existing.Website = payload.Website
	existing.Github = payload.Github
	existing.Twitter = payload.Twitter
	existing.Linkedin = payload.Linkedin
	existing.EmailPublic = payload.EmailPublic
	existing.Tags = payload.Tags
	existing.WelcomeText = payload.WelcomeText
	existing.CtaTitle = payload.CtaTitle
	existing.CtaDesc = payload.CtaDesc
	existing.CoffeeCount = payload.CoffeeCount
	existing.StarsCount = payload.StarsCount
	existing.BioEn = payload.BioEn
	existing.TagsEn = payload.TagsEn
	existing.WelcomeTextEn = payload.WelcomeTextEn
	existing.CtaTitleEn = payload.CtaTitleEn
	existing.CtaDescEn = payload.CtaDescEn

	if err := repository.UpdateUser(existing); err != nil {
		response.Error(c, http.StatusInternalServerError, "更新资料失败")
		return
	}
	response.Success(c, existing)
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func AdminChangePassword(c *gin.Context) {
	username, _ := c.Get("username")
	user, err := repository.GetUserByUsername(username.(string))
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "请先登录")
		return
	}

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if req.CurrentPassword == "" {
		response.Error(c, http.StatusBadRequest, "请输入当前密码")
		return
	}
	if len(req.NewPassword) < 8 {
		response.Error(c, http.StatusBadRequest, "新密码至少需要 8 位")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)) != nil {
		response.Error(c, http.StatusBadRequest, "当前密码不正确")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.NewPassword)) == nil {
		response.Error(c, http.StatusBadRequest, "新密码不能和当前密码相同")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "密码加密失败")
		return
	}
	user.Password = string(hash)
	if err := repository.UpdateUser(user); err != nil {
		response.Error(c, http.StatusInternalServerError, "密码修改失败")
		return
	}
	response.Success(c, gin.H{"message": "密码修改成功，请重新登录"})
}
