export type Language = 'zh' | 'en'

export interface Profile {
  avatar?: string
  nickname?: string
  location?: string
  website?: string
  github?: string
  twitter?: string
  linkedin?: string
  emailPublic?: string
  bio?: string
  tags?: string
  welcomeText?: string
  ctaTitle?: string
  ctaDescription?: string
  coffeeCount?: number
  starsCount?: number
}

export interface SiteStats {
  coffeeCount: number
  projectCount: number
  articleCount: number
  starsCount: number
}

export interface Article {
  id: number
  title: string
  summary: string
  content: string
  coverImage?: string
  category?: string
  tags?: string
  views?: number
  published?: boolean
  contentType?: 'markdown' | 'static' | string
  staticSiteUrl?: string
  staticSiteName?: string
  isLocked?: boolean
  requiresPassword?: boolean
  createdAt: string
  updatedAt?: string
}

export interface Project {
  id: number
  name: string
  description?: string
  coverImage?: string
  techStack?: string
  githubUrl?: string
  demoUrl?: string
  stars?: number
  featured?: boolean
  displayOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface Skill {
  id: number
  name: string
  category?: string
  proficiency?: number
  icon?: string
  displayOrder?: number
}

export interface FeatureCard {
  id: number
  title: string
  titleEn?: string
  description: string
  descriptionEn?: string
  icon?: string
  gradient?: string
  enabled?: boolean
}

export interface HomePayload {
  profile: Profile | null
  stats: SiteStats | null
  articles: Article[]
  projects: Project[]
  skills: Skill[]
  featureCards: FeatureCard[]
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface SearchResult {
  type: 'article' | 'project' | 'skill' | string
  id: number
  title: string
  description?: string
  url?: string
  updatedAt?: string
}

export interface CommentView {
  id: number
  articleId: number
  userId: number
  parentId?: number | null
  content: string
  status: string
  createdAt: string
  updatedAt?: string
  username: string
}

export interface CommentPage {
  comments: CommentView[]
  total: number
  totalThreads: number
  page: number
  size: number
  hasMore: boolean
}

export interface PublicUser {
  id: number
  username: string
  email: string
  status: string
  passwordConfigured: boolean
  createdAt: string
  lastActiveAt?: string
}

export interface DesktopLoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  expiresIn: number
  user: PublicUser
}

export interface MusicTrack {
  id: number
  title: string
  artist?: string
  fileUrl: string
  lyricsUrl?: string
  contentType?: string
  displayOrder?: number
}

export interface PublicTheme {
  id?: number
  name?: string
  preset?: string
  custom?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    cardBg?: string
    textPrimary?: string
    textSecondary?: string
    backgroundImage?: string
    backgroundStyle?: 'image' | 'solid' | 'gradient' | string
    backgroundSize?: string
    backgroundPosition?: string
    backgroundRepeat?: string
  }
}
