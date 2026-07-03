package model

type Theme struct {
	ID                 uint64 `gorm:"primaryKey" json:"id"`
	Name               string `gorm:"column:name;size:255" json:"name"`
	PresetKey          string `gorm:"column:preset_key;size:255" json:"presetKey,omitempty"`
	PrimaryColor       string `gorm:"column:primary_color;size:50" json:"primary,omitempty"`
	SecondaryColor     string `gorm:"column:secondary_color;size:50" json:"secondary,omitempty"`
	AccentColor        string `gorm:"column:accent_color;size:50" json:"accent,omitempty"`
	Background         string `gorm:"column:background;size:500" json:"background,omitempty"`
	BackgroundStyle    string `gorm:"column:background_style;size:50" json:"backgroundStyle,omitempty"`
	BackgroundImage    string `gorm:"column:background_image;size:500" json:"backgroundImage,omitempty"`
	BackgroundSize     string `gorm:"column:background_size;size:50" json:"backgroundSize,omitempty"`
	BackgroundPosition string `gorm:"column:background_position;size:50" json:"backgroundPosition,omitempty"`
	BackgroundRepeat   string `gorm:"column:background_repeat;size:50" json:"backgroundRepeat,omitempty"`
	CardBg             string `gorm:"column:card_bg;size:100" json:"cardBg,omitempty"`
	TextPrimary        string `gorm:"column:text_primary;size:50" json:"textPrimary,omitempty"`
	TextSecondary      string `gorm:"column:text_secondary;size:50" json:"textSecondary,omitempty"`
	IsActive           bool   `gorm:"column:is_active;default:true" json:"-"`
}

func (Theme) TableName() string {
	return "themes"
}

type CustomTheme struct {
	Primary            string `json:"primary"`
	Secondary          string `json:"secondary"`
	Accent             string `json:"accent"`
	Background         string `json:"background"`
	BackgroundStyle    string `json:"backgroundStyle"`
	BackgroundImage    string `json:"backgroundImage"`
	BackgroundSize     string `json:"backgroundSize"`
	BackgroundPosition string `json:"backgroundPosition"`
	BackgroundRepeat   string `json:"backgroundRepeat"`
	CardBg             string `json:"cardBg"`
	TextPrimary        string `json:"textPrimary"`
	TextSecondary      string `json:"textSecondary"`
}

type ThemeResponse struct {
	ID     uint64       `json:"id,omitempty"`
	Name   string       `json:"name,omitempty"`
	Preset string       `json:"preset,omitempty"`
	Custom *CustomTheme `json:"custom,omitempty"`
}
