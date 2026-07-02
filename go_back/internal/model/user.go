package model

type User struct {
	ID          uint64 `gorm:"primaryKey" json:"id"`
	Username    string `gorm:"column:username;size:255;not null;uniqueIndex" json:"username"`
	Password    string `gorm:"column:password;size:255;not null" json:"-"`
	Email       string `gorm:"column:email;size:255;not null;uniqueIndex" json:"email"`
	Role        string `gorm:"column:role;size:50" json:"role"`
	Avatar      string `gorm:"column:avatar;size:500" json:"avatar"`
	Nickname    string `gorm:"column:nickname;size:255" json:"nickname"`
	Bio         string `gorm:"column:bio;size:500" json:"bio"`
	Location    string `gorm:"column:location;size:255" json:"location"`
	Website     string `gorm:"column:website;size:255" json:"website"`
	Github      string `gorm:"column:github;size:255" json:"github"`
	Twitter     string `gorm:"column:twitter;size:255" json:"twitter"`
	Linkedin    string `gorm:"column:linkedin;size:255" json:"linkedin"`
	EmailPublic string `gorm:"column:email_public;size:255" json:"emailPublic"`
	Tags        string `gorm:"column:tags;size:500" json:"tags"`
	WelcomeText string `gorm:"column:welcome_text;size:255" json:"welcomeText"`
	CtaTitle    string `gorm:"column:cta_title;size:255" json:"ctaTitle"`
	CtaDesc     string `gorm:"column:cta_description;size:500" json:"ctaDescription"`
	CoffeeCount int    `gorm:"column:coffee_count;default:1000" json:"coffeeCount"`
	StarsCount  int    `gorm:"column:stars_count;default:1000" json:"starsCount"`

	BioEn         string `gorm:"column:bio_en;size:500" json:"bioEn"`
	TagsEn        string `gorm:"column:tags_en;size:500" json:"tagsEn"`
	WelcomeTextEn string `gorm:"column:welcome_text_en;size:255" json:"welcomeTextEn"`
	CtaTitleEn    string `gorm:"column:cta_title_en;size:255" json:"ctaTitleEn"`
	CtaDescEn     string `gorm:"column:cta_description_en;size:500" json:"ctaDescriptionEn"`
}

func (User) TableName() string {
	return "users"
}
