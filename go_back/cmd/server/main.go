package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
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
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitConfig()
	db.InitDB()
	cache.InitRedis()

	if config.AppConfig.AutoMigrate {
		if err := autoMigrateModels(); err != nil {
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
	r.MaxMultipartMemory = 32 << 20
	r.Use(gin.Logger(), middleware.ErrorHandler(), middleware.RequestBodyLimit(), middleware.CORS(), middleware.IPBanGuard())

	uploads := r.Group("/uploads")
	uploads.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/uploads/.") || strings.Contains(c.Request.URL.Path, "/.") {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		if c.Request.URL.Path == "/uploads/music" || strings.HasPrefix(c.Request.URL.Path, "/uploads/music/") {
			c.AbortWithStatus(404)
			return
		}
		if c.Request.URL.Path == "/uploads/article-sites" || strings.HasPrefix(c.Request.URL.Path, "/uploads/article-sites/") {
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
		auth.Use(func(c *gin.Context) {
			c.Header("Cache-Control", "no-store")
			c.Header("Pragma", "no-cache")
			c.Next()
		})
		auth.POST("/login", handler.Login)
		api.GET("/public/article-sites/:id/:siteKey/:version/:expires/:sign/*filepath", handler.ServeArticleSiteFile)

		public := api.Group("/public")
		public.Use(middleware.RateLimit("public", config.AppConfig.PublicRateLimit, time.Minute))
		{
			publicCache := middleware.CacheGET("public")
			public.GET("/profile", publicCache, handler.GetProfile)
			public.GET("/home", publicCache, handler.GetHome)
			public.GET("/stats", publicCache, handler.GetStats)
			public.GET("/articles", publicCache, handler.GetArticles)
			public.GET("/articles/:id", handler.GetProtectedArticle)
			public.POST("/articles/:id/unlock", middleware.RateLimit("article-unlock", 10, time.Minute), handler.UnlockArticle)
			public.GET("/tags", publicCache, handler.GetTags)
			public.GET("/categories", publicCache, handler.GetCategories)
			public.GET("/projects", publicCache, handler.GetProjects)
			public.GET("/projects/featured", publicCache, handler.GetFeaturedProjects)
			public.GET("/skills", publicCache, handler.GetSkills)
			public.GET("/feature-cards", publicCache, handler.GetFeatureCards)
			public.GET("/theme", publicCache, handler.GetTheme)
			public.GET("/theme/background-images", publicCache, handler.AdminListThemeBackgrounds)
			public.GET("/live2d-model", publicCache, handler.GetLive2DModel)
			public.GET("/music", middleware.RateLimit("music", config.AppConfig.MusicRateLimit, time.Minute), publicCache, handler.GetMusics)
			public.GET("/music/:id/stream", middleware.RateLimit("music-stream", config.AppConfig.MusicStreamRateLimit, time.Minute), handler.StreamMusic)
			public.GET("/music/:id/lyrics", middleware.RateLimit("music-stream", config.AppConfig.MusicStreamRateLimit, time.Minute), handler.StreamMusicLyrics)
			public.GET("/search", handler.PublicSearch)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth())
		admin.Use(middleware.OperationLogger())
		admin.Use(middleware.InvalidatePublicCacheAfterMutation())
		{
			admin.GET("/articles", handler.AdminGetArticles)
			admin.POST("/articles", handler.AdminCreateArticleSecure)
			admin.PUT("/articles/:id", handler.AdminUpdateArticleSecure)
			admin.DELETE("/articles/:id", handler.AdminDeleteArticleSecure)
			admin.POST("/article-sites", handler.AdminUploadArticleSite)
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
	server := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       10 * time.Minute,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	var unexpectedServerError error
	select {
	case sig := <-stop:
		log.Printf("received %s, shutting down", sig)
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server stopped unexpectedly: %v", err)
			unexpectedServerError = err
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	repository.FlushPendingArticleViews()
	repository.FlushPendingSecurityAccess()
	if err := cache.Close(); err != nil {
		log.Printf("redis close failed: %v", err)
	}
	if err := db.Close(); err != nil {
		log.Printf("database close failed: %v", err)
	}
	if unexpectedServerError != nil {
		log.Fatalf("server failed: %v", unexpectedServerError)
	}
}

type migrationTarget struct {
	name  string
	model any
}

func autoMigrateModels() error {
	targets := []migrationTarget{
		{"users", &model.User{}},
		{"articles", &model.Article{}},
		{"projects", &model.Project{}},
		{"skills", &model.Skill{}},
		{"feature_cards", &model.FeatureCard{}},
		{"themes", &model.Theme{}},
		{"live2d_models", &model.Live2DModel{}},
		{"live2d_settings", &model.Live2DSettings{}},
		{"music", &model.Music{}},
		{"upload_settings", &model.UploadSettings{}},
		{"operation_logs", &model.OperationLog{}},
		{"rate_limit_settings", &model.RateLimitSettings{}},
		{"security_access_stats", &model.SecurityAccessStat{}},
		{"security_events", &model.SecurityEvent{}},
		{"upload_assets", &model.UploadAsset{}},
	}
	for _, target := range targets {
		if err := db.DB.AutoMigrate(target.model); err != nil {
			return fmt.Errorf("%s: %w", target.name, err)
		}
	}
	return nil
}
