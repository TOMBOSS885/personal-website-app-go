export interface Article {
  id: number
  title: string
  summary: string
  content: string
  coverImage: string
  category: string
  tags: string
  views: number
  published: boolean
  contentType: 'markdown' | 'static'
  staticSiteKey?: string
  staticSiteName?: string
  isLocked: boolean
  createdAt: string
  updatedAt: string
}

export interface ArticleFormValue {
  title: string
  summary: string
  content: string
  coverImage: string
  category: string
  tags: string
  published: boolean
  contentType: 'markdown' | 'static'
  staticSiteKey: string
  staticSiteName: string
  isLocked: boolean
  accessPassword: string
}

export const emptyArticle: ArticleFormValue = {
  title: '',
  summary: '',
  content: '',
  coverImage: '',
  category: '',
  tags: '',
  published: false,
  contentType: 'markdown',
  staticSiteKey: '',
  staticSiteName: '',
  isLocked: false,
  accessPassword: '',
}

export function articleToForm(article: Article): ArticleFormValue {
  return {
    title: article.title,
    summary: article.summary || '',
    content: article.content || '',
    coverImage: article.coverImage || '',
    category: article.category || '',
    tags: article.tags || '',
    published: article.published,
    contentType: article.contentType || 'markdown',
    staticSiteKey: article.staticSiteKey || '',
    staticSiteName: article.staticSiteName || '',
    isLocked: article.isLocked,
    accessPassword: '',
  }
}
