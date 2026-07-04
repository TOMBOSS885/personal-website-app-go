package main

import (
	"log"
	"personal-website-go/internal/bootstrap"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/handler"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitConfig()
	db.InitDB()

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
		); err != nil {
			log.Fatalf("database migration failed: %v", err)
		}
	}
	bootstrap.SeedDefaultData()

	gin.SetMode(config.AppConfig.GinMode)
	r := gin.New()
	r.MaxMultipartMemory = 256 << 20
	r.Use(gin.Logger(), middleware.ErrorHandler(), middleware.CORS())

	uploads := r.Group("/uploads")
	uploads.Use(func(c *gin.Context) {
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
		{
			public.GET("/profile", handler.GetProfile)
			public.GET("/stats", handler.GetStats)
			public.GET("/articles", handler.GetArticles)
			public.GET("/articles/:id", handler.GetArticle)
			public.GET("/tags", handler.GetTags)
			public.GET("/projects", handler.GetProjects)
			public.GET("/projects/featured", handler.GetFeaturedProjects)
			public.GET("/skills", handler.GetSkills)
			public.GET("/feature-cards", handler.GetFeatureCards)
			public.GET("/theme", handler.GetTheme)
			public.GET("/theme/background-images", handler.AdminListThemeBackgrounds)
			public.GET("/live2d-model", handler.GetLive2DModel)
			public.GET("/music", handler.GetMusics)
			public.GET("/search", handler.PublicSearch)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth())
		admin.Use(middleware.OperationLogger())
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
			admin.GET("/operation-logs", handler.AdminGetOperationLogs)
			admin.GET("/export", handler.AdminExportData)
			admin.GET("/search", handler.AdminSearch)

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
