package model

import "time"

type User struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Username    string    `gorm:"column:username;unique" json:"username"`
	Password    string    `gorm:"column:password" json:"-"` // 不序列化返回
	Email       string    `gorm:"column:email" json:"email"`
	Role        string    `gorm:"column:role" json:"role"`
	Avatar      string    `gorm:"column:avatar" json:"avatar"`
	Nickname    string    `gorm:"column:nickname" json:"nickname"`
	Bio         string    `gorm:"column:bio" json:"bio"`
	Location    string    `gorm:"column:location" json:"location"`
	Website     string    `gorm:"column:website" json:"website"`
	Github      string    `gorm:"column:github" json:"github"`
	Twitter     string    `gorm:"column:twitter" json:"twitter"`
	Linkedin    string    `gorm:"column:linkedin" json:"linkedin"`
	EmailPublic string    `gorm:"column:email_public" json:"emailPublic"`
	Tags        string    `gorm:"column:tags" json:"tags"`
	WelcomeText string    `gorm:"column:welcome_text" json:"welcomeText"`
	CtaTitle    string    `gorm:"column:cta_title" json:"ctaTitle"`
	CtaDesc     string    `gorm:"column:cta_description" json:"ctaDescription"`
	CoffeeCount int       `gorm:"column:coffee_count" json:"coffeeCount"`
	StarsCount  int       `gorm:"column:stars_count" json:"starsCount"`
	
	// English extensions
	BioEn          string `gorm:"column:bio_en" json:"bioEn"`
	TagsEn         string `gorm:"column:tags_en" json:"tagsEn"`
	WelcomeTextEn  string `gorm:"column:welcome_text_en" json:"welcomeTextEn"`
	CtaTitleEn     string `gorm:"column:cta_title_en" json:"ctaTitleEn"`
	CtaDescEn      string `gorm:"column:cta_description_en" json:"ctaDescriptionEn"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}
