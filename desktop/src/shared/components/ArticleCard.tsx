import { ArrowUpRight, CalendarDays, CodeXml, Eye, LockKeyhole, UserRoundCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Article } from '../api/types'
import { formatDate, splitCommaList } from '../lib/format'
import { RemoteImage } from './RemoteImage'

export function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  return (
    <Link to={`/articles/${article.id}`} className={`article-card${featured ? ' featured' : ''}`}>
      <div className="article-cover">
        <RemoteImage
          source={article.coverImage}
          alt={article.title}
          fallbackLabel={article.title}
          loading={featured ? 'eager' : 'lazy'}
        />
        <div className="cover-badges">
          {article.isLocked && <span><LockKeyhole size={13} /> 加锁</span>}
          {article.requiresLogin && <span><UserRoundCheck size={13} /> 登录可见</span>}
          {article.contentType === 'static' && <span><CodeXml size={13} /> 交互页面</span>}
        </div>
      </div>
      <div className="article-card-body">
        <div className="article-kicker">
          <span>{article.category || '随笔'}</span>
          <span>{formatDate(article.createdAt)}</span>
        </div>
        <h3>{article.title}</h3>
        <p>{article.summary || (article.isLocked ? '这是一篇受保护的文章，输入访问密码后可阅读。' : article.requiresLogin ? '登录账号后可阅读全文并参与评论。' : '打开文章阅读全文。')}</p>
        <div className="article-card-footer">
          <span className="tag-row">
            {splitCommaList(article.tags).slice(0, 2).map((tag) => <small key={tag}>#{tag}</small>)}
          </span>
          <span className="article-meta">
            <CalendarDays size={14} className="meta-calendar" />
            <Eye size={14} /> {article.views ?? 0}
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  )
}
