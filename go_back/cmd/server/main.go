package main

import (
	"log"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/handler"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. 初始化配置
	config.InitConfig()

	// 2. 初始化数据库
	db.InitDB()

	// 自动迁移
	db.DB.AutoMigrate(
		&model.User{},
		&model.Article{},
		&model.Project{},
		&model.Skill{},
		&model.FeatureCard{},
		&model.Theme{},
		&model.Live2DModel{},
		&model.Live2DSettings{},
	)

	// 3. 设置 Gin 模式
	gin.SetMode(config.AppConfig.GinMode)

	// 4. 创建引擎
	r := gin.New()
	r.Use(gin.Logger(), middleware.ErrorHandler(), middleware.CORS())

	// 静态文件服务
	r.Static("/uploads", config.AppConfig.UploadDir)

	// API 路由
	api := r.Group("/api")
	{
		// 认证
		auth := api.Group("/auth")
		{
			auth.POST("/login", handler.Login)
		}

		// 公开接口
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
			public.GET("/live2d-model", handler.GetLive2DModel)
		}

		// 管理端接口
		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth())
		{
			admin.GET("/articles", handler.AdminGetArticles)
			admin.POST("/articles", handler.AdminCreateArticle)
			admin.PUT("/articles/:id", handler.AdminUpdateArticle)
			admin.DELETE("/articles/:id", handler.AdminDeleteArticle)
		}
	}

	// 5. 启动服务
	port := config.AppConfig.ServerPort
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting server on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
