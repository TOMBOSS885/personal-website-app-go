package model

import "time"

type Live2DSettings struct {
	ID                 uint64 `gorm:"primaryKey" json:"-"`
	Enabled            bool   `gorm:"column:enabled;default:true" json:"enabled"`
	Position           string `gorm:"column:position;size:50;default:bottom-right" json:"position"`
	Size               int    `gorm:"column:size;default:280" json:"size"`
	PrimaryColor       string `gorm:"column:primary_color;size:100;default:rgba(96,165,250,0.92)" json:"primaryColor"`
	TransitionType     string `gorm:"column:transition_type;size:50;default:slide" json:"transitionType"`
	TransitionDuration int    `gorm:"column:transition_duration;default:1500" json:"transitionDuration"`
	MenuAlign          string `gorm:"column:menu_align;size:50;default:right" json:"menuAlign"`
	ShowSleepButton    bool   `gorm:"column:show_sleep_button;default:true" json:"showSleepButton"`
	ShowAboutButton    bool   `gorm:"column:show_about_button;default:false" json:"showAboutButton"`
}

func (Live2DSettings) TableName() string {
	return "live2d_settings"
}

type Live2DModel struct {
	ID              uint64    `gorm:"primaryKey" json:"id"`
	Name            string    `gorm:"column:name;size:255;not null" json:"name"`
	Directory       string    `gorm:"column:directory;size:255;not null;uniqueIndex" json:"-"`
	ModelPath       string    `gorm:"column:model_path;size:1000;not null" json:"modelPath"`
	ThumbnailPath   string    `gorm:"-" json:"thumbnailPath"`
	Active          bool      `gorm:"column:active;default:false" json:"active"`
	Switchable      bool      `gorm:"column:switchable;default:true" json:"switchable"`
	DisplayOrder    int       `gorm:"column:display_order;default:0" json:"displayOrder"`
	Scale           float64   `gorm:"column:scale;default:1" json:"scale"`
	OffsetX         float64   `gorm:"column:offset_x;default:0" json:"offsetX"`
	OffsetY         float64   `gorm:"column:offset_y;default:0" json:"offsetY"`
	Volume          float64   `gorm:"column:volume;default:0" json:"volume"`
	TipsEnabled     bool      `gorm:"column:tips_enabled;default:true" json:"tipsEnabled"`
	WelcomeMessages string    `gorm:"column:welcome_messages;size:2000" json:"welcomeMessages"`
	TipMessages     string    `gorm:"column:tip_messages;size:4000" json:"tipMessages"`
	TipDuration     int       `gorm:"column:tip_duration;default:3500" json:"tipDuration"`
	TipInterval     int       `gorm:"column:tip_interval;default:9000" json:"tipInterval"`
	TipOffsetX      int       `gorm:"column:tip_offset_x;default:0" json:"tipOffsetX"`
	TipOffsetY      int       `gorm:"column:tip_offset_y;default:0" json:"tipOffsetY"`
	TypingEnabled   bool      `gorm:"column:typing_enabled;default:false" json:"typingEnabled"`
	TypingParam     string    `gorm:"column:typing_param;size:255" json:"typingParam"`
	TypingSpeed     int       `gorm:"column:typing_speed;default:120" json:"typingSpeed"`
	TypingMinValue  float64   `gorm:"column:typing_min_value;default:0" json:"typingMinValue"`
	TypingMaxValue  float64   `gorm:"column:typing_max_value;default:1" json:"typingMaxValue"`
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
