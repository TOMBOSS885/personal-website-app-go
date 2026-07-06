package main

import (
	"log"
	"personal-website-go/internal/bootstrap"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/handler"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/tasks"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitConfig()
	db.InitDB()
	cache.InitRedis()

	if config.AppConfig.AutoMigrate {
		if err := db.DB.AutoMigrate(
			&model.User{},
			&model.Article{},
			&model.Project{},
			&model.Skill{},
			&model.FeatureCard{},
			&model.Theme{},
			&model.Live2DModel{},
			&model.Live2DSettings{},
			&model.Music{},
			&model.UploadSettings{},
			&model.OperationLog{},
			&model.RateLimitSettings{},
			&model.SecurityAccessStat{},
			&model.SecurityEvent{},
			&model.UploadAsset{},
		); err != nil {
			log.Fatalf("database migration failed: %v", err)
		}
	}
	bootstrap.SeedDefaultData()
	if _, err := repository.GetOrCreateRateLimitSettings(); err != nil {
		log.Printf("rate limit settings init failed: %v", err)
	}
	tasks.RunStartupMaintenance()
	tasks.StartMaintenanceTasks()

	gin.SetMode(config.AppConfig.GinMode)
	r := gin.New()
	if err := r.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Printf("failed to set trusted proxies: %v", err)
	}
	r.MaxMultipartMemory = 256 << 20
	r.Use(gin.Logger(), middleware.ErrorHandler(), middleware.CORS(), middleware.IPBanGuard())

	uploads := r.Group("/uploads")
	uploads.Use(func(c *gin.Context) {
		if c.Request.URL.Path == "/uploads/music" || strings.HasPrefix(c.Request.URL.Path, "/uploads/music/") {
			c.AbortWithStatus(404)
			return
		}
		c.Header("Cache-Control", "public, max-age=604800, immutable")
		c.Next()
	})
	uploads.Static("/", config.AppConfig.UploadDir)

	api := r.Group("/api")
	{
		api.GET("/health", handler.Health)
		api.GET("/health/full", handler.FullHealth)

		auth := api.Group("/auth")
		auth.POST("/login", handler.Login)

		public := api.Group("/public")
		public.Use(middleware.RateLimit("public", config.AppConfig.PublicRateLimit, time.Minute))
		{
			publicCache := middleware.CacheGET("public")
			public.GET("/profile", publicCache, handler.GetProfile)
			public.GET("/stats", publicCache, handler.GetStats)
			public.GET("/articles", publicCache, handler.GetArticles)
			public.GET("/articles/:id", handler.GetArticle)
			public.GET("/tags", publicCache, handler.GetTags)
			public.GET("/projects", publicCache, handler.GetProjects)
			public.GET("/projects/featured", publicCache, handler.GetFeaturedProjects)
			public.GET("/skills", publicCache, handler.GetSkills)
			public.GET("/feature-cards", publicCache, handler.GetFeatureCards)
			public.GET("/theme", publicCache, handler.GetTheme)
			public.GET("/theme/background-images", publicCache, handler.AdminListThemeBackgrounds)
			public.GET("/live2d-model", publicCache, handler.GetLive2DModel)
			public.GET("/music", middleware.RateLimit("music", config.AppConfig.MusicRateLimit, time.Minute), publicCache, handler.GetMusics)
			public.GET("/music/:id/stream", middleware.RateLimit("music-stream", config.AppConfig.MusicStreamRateLimit, time.Minute), handler.StreamMusic)
			public.GET("/search", handler.PublicSearch)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth())
		admin.Use(middleware.OperationLogger())
		admin.Use(middleware.InvalidatePublicCacheAfterMutation())
		{
			admin.GET("/articles", handler.AdminGetArticles)
			admin.POST("/articles", handler.AdminCreateArticle)
			admin.PUT("/articles/:id", handler.AdminUpdateArticle)
			admin.DELETE("/articles/:id", handler.AdminDeleteArticle)
			admin.GET("/article-images", handler.AdminListArticleImages)
			admin.POST("/article-images", handler.AdminUploadArticleImage)

			admin.GET("/projects", handler.AdminGetProjects)
			admin.POST("/projects", handler.AdminCreateProject)
			admin.PUT("/projects/:id", handler.AdminUpdateProject)
			admin.DELETE("/projects/:id", handler.AdminDeleteProject)

			admin.GET("/skills", handler.AdminGetSkills)
			admin.POST("/skills", handler.AdminCreateSkill)
			admin.PUT("/skills/:id", handler.AdminUpdateSkill)
			admin.DELETE("/skills/:id", handler.AdminDeleteSkill)

			admin.GET("/feature-cards", handler.AdminGetFeatureCards)
			admin.POST("/feature-cards", handler.AdminCreateFeatureCard)
			admin.PUT("/feature-cards/:id", handler.AdminUpdateFeatureCard)
			admin.DELETE("/feature-cards/:id", handler.AdminDeleteFeatureCard)

			admin.GET("/profile", handler.AdminGetProfile)
			admin.PUT("/profile", handler.AdminUpdateProfile)
			admin.POST("/profile/avatar", handler.AdminUploadAvatar)
			admin.PUT("/account/password", handler.AdminChangePassword)
			admin.GET("/upload-settings", handler.AdminGetUploadSettings)
			admin.PUT("/upload-settings", handler.AdminUpdateUploadSettings)
			admin.POST("/upload-assets/cleanup", handler.AdminCleanupUploadAssets)
			admin.GET("/dashboard-stats", handler.AdminDashboardStats)
			admin.GET("/operation-logs", handler.AdminGetOperationLogs)
			admin.GET("/export", handler.AdminExportData)
			admin.GET("/search", handler.AdminSearch)
			admin.GET("/security", handler.AdminSecurityDashboard)
			admin.GET("/security/rate-limit-settings", handler.AdminGetRateLimitSettings)
			admin.PUT("/security/rate-limit-settings", handler.AdminUpdateRateLimitSettings)

			admin.POST("/theme", handler.AdminSaveTheme)
			admin.GET("/theme/background-images", handler.AdminListThemeBackgrounds)
			admin.POST("/theme/background-image", handler.AdminUploadThemeBackground)
			admin.DELETE("/theme/background-image/:name", handler.AdminDeleteThemeBackground)
			admin.GET("/themes", handler.AdminGetThemes)

			admin.GET("/live2d-models", handler.AdminGetLive2DModels)
			admin.POST("/live2d-models", handler.AdminUploadLive2DModel)
			admin.PUT("/live2d-models/:id", handler.AdminUpdateLive2DModel)
			admin.PUT("/live2d-models/:id/activate", handler.AdminActivateLive2DModel)
			admin.DELETE("/live2d-models/:id", handler.AdminDeleteLive2DModel)
			admin.PUT("/live2d-settings", handler.AdminUpdateLive2DSettings)

			admin.GET("/music", handler.AdminGetMusics)
			admin.POST("/music", handler.AdminUploadMusic)
			admin.DELETE("/music", handler.AdminBatchDeleteMusic)
			admin.PATCH("/music/:id", handler.AdminUpdateMusic)
			admin.POST("/music/:id/lyrics", handler.AdminUploadMusicLyrics)
			admin.DELETE("/music/:id/lyrics", handler.AdminDeleteMusicLyrics)
			admin.DELETE("/music/:id", handler.AdminDeleteMusic)
		}
	}

	host := config.AppConfig.ServerHost
	port := config.AppConfig.ServerPort
	if host == "" {
		host = "0.0.0.0"
	}
	if port == "" {
		port = "8080"
	}
	addr := host + ":" + port
	log.Printf("starting server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
