package model

type UploadSettings struct {
	ID                   uint64 `gorm:"primaryKey" json:"id"`
	ArticleImageMaxMB    int    `gorm:"column:article_image_max_mb;default:10" json:"articleImageMaxMB"`
	ArticleSiteZipMaxMB  int    `gorm:"column:article_site_zip_max_mb;default:30" json:"articleSiteZipMaxMB"`
	ArticleSiteTotalMB   int    `gorm:"column:article_site_total_mb;default:100" json:"articleSiteTotalMB"`
	ArticleSiteFileCount int    `gorm:"column:article_site_file_count;default:1000" json:"articleSiteFileCount"`
	ThemeBackgroundMaxMB int    `gorm:"column:theme_background_max_mb;default:10" json:"themeBackgroundMaxMB"`
	AvatarImageMaxMB     int    `gorm:"column:avatar_image_max_mb;default:5" json:"avatarImageMaxMB"`
	MusicFileMaxMB       int    `gorm:"column:music_file_max_mb;default:50" json:"musicFileMaxMB"`
	LyricsFileMaxMB      int    `gorm:"column:lyrics_file_max_mb;default:1" json:"lyricsFileMaxMB"`
	MusicBatchMaxCount   int    `gorm:"column:music_batch_max_count;default:50" json:"musicBatchMaxCount"`
	Live2DTotalMaxMB     int    `gorm:"column:live2d_total_max_mb;default:200" json:"live2dTotalMaxMB"`
	Live2DFileMaxCount   int    `gorm:"column:live2d_file_max_count;default:300" json:"live2dFileMaxCount"`
	ImageMaxDimension    int    `gorm:"column:image_max_dimension;default:8192" json:"imageMaxDimension"`
	ImageMaxPixels       int    `gorm:"column:image_max_pixels;default:40000000" json:"imageMaxPixels"`
	AvatarMaxDimension   int    `gorm:"column:avatar_max_dimension;default:4096" json:"avatarMaxDimension"`
	AvatarMaxPixels      int    `gorm:"column:avatar_max_pixels;default:16000000" json:"avatarMaxPixels"`
	AvatarMinDimension   int    `gorm:"column:avatar_min_dimension;default:64" json:"avatarMinDimension"`
}

func (UploadSettings) TableName() string {
	return "upload_settings"
}
