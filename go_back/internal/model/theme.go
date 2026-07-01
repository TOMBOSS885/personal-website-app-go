package model

type Theme struct {
	ID              uint64 `gorm:"primaryKey" json:"id"`
	Name            string `gorm:"column:name" json:"name"`
	PresetKey       string `gorm:"column:preset_key" json:"presetKey,omitempty"`
	PrimaryColor    string `gorm:"column:primary_color" json:"primary,omitempty"`
	SecondaryColor  string `gorm:"column:secondary_color" json:"secondary,omitempty"`
	AccentColor     string `gorm:"column:accent_color" json:"accent,omitempty"`
	Background      string `gorm:"column:background" json:"background,omitempty"`
	BackgroundStyle string `gorm:"column:background_style" json:"backgroundStyle,omitempty"`
	BackgroundImage string `gorm:"column:background_image" json:"backgroundImage,omitempty"`
	CardBg          string `gorm:"column:card_bg" json:"cardBg,omitempty"`
	TextPrimary     string `gorm:"column:text_primary" json:"textPrimary,omitempty"`
	TextSecondary   string `gorm:"column:text_secondary" json:"textSecondary,omitempty"`
	IsActive        bool   `gorm:"column:is_active" json:"-"`
}

func (Theme) TableName() string {
	return "themes"
}

// CustomTheme 对应 JSON 返回的 custom 部分
type CustomTheme struct {
	Primary         string `json:"primary"`
	Secondary       string `json:"secondary"`
	Accent          string `json:"accent"`
	Background      string `json:"background"`
	BackgroundStyle string `json:"backgroundStyle"`
	BackgroundImage string `json:"backgroundImage"`
	CardBg          string `json:"cardBg"`
	TextPrimary     string `json:"textPrimary"`
	TextSecondary   string `json:"textSecondary"`
}

type ThemeResponse struct {
	ID     uint64       `json:"id,omitempty"`
	Name   string       `json:"name,omitempty"`
	Preset string       `json:"preset,omitempty"`
	Custom *CustomTheme `json:"custom,omitempty"`
}
