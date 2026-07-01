package model

import "time"

type Live2DSettings struct {
	ID                 uint64 `gorm:"primaryKey" json:"-"`
	Enabled            bool   `gorm:"column:enabled" json:"enabled"`
	Position           string `gorm:"column:position" json:"position"`
	Size               int    `gorm:"column:size" json:"size"`
	PrimaryColor       string `gorm:"column:primary_color" json:"primaryColor"`
	TransitionType     string `gorm:"column:transition_type" json:"transitionType"`
	TransitionDuration int    `gorm:"column:transition_duration" json:"transitionDuration"`
	MenuAlign          string `gorm:"column:menu_align" json:"menuAlign"`
	ShowSleepButton    bool   `gorm:"column:show_sleep_button" json:"showSleepButton"`
	ShowAboutButton    bool   `gorm:"column:show_about_button" json:"showAboutButton"`
}

func (Live2DSettings) TableName() string {
	return "live2d_settings"
}

type Live2DModel struct {
	ID              uint64    `gorm:"primaryKey" json:"id"`
	Name            string    `gorm:"column:name" json:"name"`
	Directory       string    `gorm:"column:directory" json:"-"`
	ModelPath       string    `gorm:"column:model_path" json:"modelPath"`
	ThumbnailPath   string    `gorm:"-" json:"thumbnailPath"`
	Active          bool      `gorm:"column:active" json:"active"`
	Switchable      bool      `gorm:"column:switchable" json:"switchable"`
	DisplayOrder    int       `gorm:"column:display_order" json:"displayOrder"`
	Scale           float64   `gorm:"column:scale" json:"scale"`
	OffsetX         float64   `gorm:"column:offset_x" json:"offsetX"`
	OffsetY         float64   `gorm:"column:offset_y" json:"offsetY"`
	Volume          float64   `gorm:"column:volume" json:"volume"`
	TipsEnabled     bool      `gorm:"column:tips_enabled" json:"tipsEnabled"`
	WelcomeMessages string    `gorm:"column:welcome_messages" json:"welcomeMessages"`
	TipMessages     string    `gorm:"column:tip_messages" json:"tipMessages"`
	TipDuration     int       `gorm:"column:tip_duration" json:"tipDuration"`
	TipInterval     int       `gorm:"column:tip_interval" json:"tipInterval"`
	TipOffsetX      int       `gorm:"column:tip_offset_x" json:"tipOffsetX"`
	TipOffsetY      int       `gorm:"column:tip_offset_y" json:"tipOffsetY"`
	TypingEnabled   bool      `gorm:"column:typing_enabled" json:"typingEnabled"`
	TypingParam     string    `gorm:"column:typing_param" json:"typingParam"`
	TypingSpeed     int       `gorm:"column:typing_speed" json:"typingSpeed"`
	TypingMinValue  float64   `gorm:"column:typing_min_value" json:"typingMinValue"`
	TypingMaxValue  float64   `gorm:"column:typing_max_value" json:"typingMaxValue"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (Live2DModel) TableName() string {
	return "live2d_models"
}

type Live2DResponse struct {
	Enabled  bool            `json:"enabled"`
	Settings *Live2DSettings `json:"settings,omitempty"`
	Models   []Live2DModel   `json:"models,omitempty"`
}
