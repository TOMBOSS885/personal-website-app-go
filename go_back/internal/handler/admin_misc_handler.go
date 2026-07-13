package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"personal-website-go/internal/config"
	"personal-website-go/internal/media"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var avatarImageExts = []string{".jpg", ".jpeg", ".png", ".webp"}
var avatarImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

func AdminGetProjects(c *gin.Context) {
	if c.Query("page") != "" || c.Query("size") != "" {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
		size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
		projects, total, err := repository.GetProjectsPage(page, size, false)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "鑾峰彇椤圭洰澶辫触")
			return
		}
		response.Page(c, projects, total, size, page)
		return
	}
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
	if c.Query("page") != "" || c.Query("size") != "" {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
		size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
		skills, total, err := repository.GetSkillsPage(page, size)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "鑾峰彇鎶€鑳藉け璐?")
			return
		}
		response.Page(c, skills, total, size, page)
		return
	}
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

func AdminUploadAvatar(c *gin.Context) {
	settings := getOrCreateUploadSettings()
	existing, err := repository.GetFirstUser()
	if err != nil {
		response.Error(c, http.StatusNotFound, "profile not found")
		return
	}

	file, err := c.FormFile("file")
	if err != nil || file == nil {
		response.Error(c, http.StatusBadRequest, "please upload an avatar image")
		return
	}
	if file.Size > bytesFromMB(settings.AvatarImageMaxMB) {
		response.Error(c, http.StatusBadRequest, "avatar exceeds configured upload size limit")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExt(ext, avatarImageExts) {
		response.Error(c, http.StatusBadRequest, "avatar only supports jpg, png and webp")
		return
	}
	contentType, err := detectUploadedContentType(file)
	if err != nil || !avatarImageTypes[contentType] || !imageTypeMatchesExtension(ext, contentType) {
		response.Error(c, http.StatusBadRequest, "unsupported avatar image type")
		return
	}
	if err := validateUploadedImageDimensions(file, settings.AvatarMinDimension, settings.AvatarMaxDimension, settings.AvatarMaxPixels); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid avatar image")
		return
	}

	dir := filepath.Join(config.AppConfig.UploadDir, "avatars")
	baseName := time.Now().Format("20060102") + "-" + uuid.NewString()
	rawName := baseName + "-raw" + ext
	rawTarget := filepath.Join(dir, rawName)
	if err := saveUploadedFile(c, file, dir, rawTarget); err != nil {
		response.Error(c, http.StatusInternalServerError, "avatar upload failed")
		return
	}
	name := baseName + ".png"
	target := filepath.Join(dir, name)
	if _, err := media.GenerateSquarePNG(rawTarget, target, 512); err != nil {
		_ = os.Remove(rawTarget)
		response.Error(c, http.StatusInternalServerError, "avatar processing failed")
		return
	}
	_ = os.Remove(rawTarget)

	oldAvatar := existing.Avatar
	existing.Avatar = "/uploads/avatars/" + name
	if err := repository.UpdateUser(existing); err != nil {
		_ = os.Remove(target)
		response.Error(c, http.StatusInternalServerError, "avatar save failed")
		return
	}
	removeOldAvatar(oldAvatar)

	response.Success(c, gin.H{"avatar": existing.Avatar})
}

func removeOldAvatar(avatar string) {
	if avatar == "" || !strings.HasPrefix(avatar, "/uploads/avatars/") {
		return
	}
	name := filepath.Base(avatar)
	if name == "" || name == "." || name == ".." {
		return
	}
	dir := filepath.Join(config.AppConfig.UploadDir, "avatars")
	target := filepath.Join(dir, name)
	dirAbs, err := filepath.Abs(dir)
	if err != nil {
		return
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil || !strings.HasPrefix(targetAbs, dirAbs+string(os.PathSeparator)) {
		return
	}
	_ = os.Remove(targetAbs)
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
	if len(req.CurrentPassword) > 72 || len(req.NewPassword) > 72 {
		response.Error(c, http.StatusBadRequest, "密码长度不能超过 72 字节")
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
