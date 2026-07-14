import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  BookOpen,
  Code2,
  Coffee,
  Cpu,
  Database,
  ExternalLink,
  FolderGit2,
  Github,
  Globe2,
  Linkedin,
  Mail,
  MapPin,
  Sparkles,
  Star,
  Twitter,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { publicApi } from '../../shared/api/client'
import { ArticleCard } from '../../shared/components/ArticleCard'
import { ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { RemoteImage } from '../../shared/components/RemoteImage'
import { clampPercent, splitCommaList } from '../../shared/lib/format'
import { openExternalUrl } from '../../shared/lib/platform'
import { useSettings } from '../../shared/settings/SettingsContext'

export function HomePage() {
  const { settings } = useSettings()
  const query = useQuery({
    queryKey: ['home', settings.serverUrl, settings.language],
    queryFn: ({ signal }) => publicApi.home(settings.serverUrl, settings.language, signal),
  })

  if (query.isPending) return <LoadingState label="正在打开你的博客" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} action={<Link className="button button-primary" to="/settings">设置内容服务器</Link>} />
  if (!query.data) return <ErrorState error={new Error('服务器返回了空的首页数据')} />

  const { profile, stats, articles, projects, skills, featureCards } = query.data
  const tags = splitCommaList(profile?.tags)
  const skillGroups = skills.reduce((groups, skill) => {
    const category = skill.category || '其他'
    const current = groups.get(category) ?? []
    current.push(skill)
    groups.set(category, current)
    return groups
  }, new Map<string, typeof skills>())

  return (
    <div className="page home-page">
      <section className="reader-hero">
        <div className="hero-copy">
          <span className="section-label"><Sparkles size={14} /> {profile?.welcomeText || '欢迎来到我的个人空间'}</span>
          <h2>{profile?.nickname || '一位持续创造的开发者'}</h2>
          <p>{profile?.bio || '这里记录技术实践、作品和思考。'}</p>
          {tags.length > 0 && (
            <div className="hero-tags">
              {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          <div className="hero-actions">
            <Link className="button button-primary" to="/articles">
              <BookOpen size={17} /> 开始阅读
            </Link>
            <Link className="button button-secondary" to="/projects">
              <FolderGit2 size={17} /> 浏览项目
            </Link>
            {profile?.github && (
              <button className="icon-button" title="在系统浏览器打开 GitHub" onClick={() => openExternalUrl(profile.github)}>
                <Github size={18} />
              </button>
            )}
          </div>
          <div className="social-links" aria-label="个人链接">
            {profile?.website && <button title="个人网站" onClick={() => void openExternalUrl(profile.website)}><Globe2 size={15} /></button>}
            {profile?.github && <button title="GitHub" onClick={() => void openExternalUrl(profile.github)}><Github size={15} /></button>}
            {profile?.linkedin && <button title="LinkedIn" onClick={() => void openExternalUrl(profile.linkedin)}><Linkedin size={15} /></button>}
            {profile?.twitter && <button title="Twitter / X" onClick={() => void openExternalUrl(profile.twitter)}><Twitter size={15} /></button>}
            {profile?.emailPublic && <button title="发送邮件" onClick={() => void openExternalUrl(`mailto:${profile.emailPublic}`)}><Mail size={15} /></button>}
          </div>
        </div>
        <div className="hero-portrait-wrap">
          <RemoteImage
            className="hero-portrait"
            source={profile?.avatar}
            fallbackLabel={profile?.nickname || 'P'}
            alt={profile?.nickname || '博主头像'}
          />
          <span className="portrait-note">
            <MapPin size={14} /> {profile?.location || 'On the web'}
          </span>
        </div>
      </section>

      {featureCards.length > 0 && (
        <section className="content-section">
          <div className="section-heading"><div><span className="section-label">WHAT I DO</span><h2>能力与方向</h2></div></div>
          <div className="feature-grid">
            {featureCards.map((feature) => {
              const Icon = featureIcon(feature.icon)
              const title = settings.language === 'en' ? feature.titleEn || feature.title : feature.title
              const description = settings.language === 'en' ? feature.descriptionEn || feature.description : feature.description
              return <article className="feature-item" key={feature.id}><span><Icon size={19} /></span><div><h3>{title}</h3><p>{description}</p></div></article>
            })}
          </div>
        </section>
      )}

      <section className="stat-strip" aria-label="博客统计">
        <Stat icon={<BookOpen />} value={stats?.articleCount ?? articles.length} label="篇文章" tone="coral" />
        <Stat icon={<FolderGit2 />} value={stats?.projectCount ?? projects.length} label="个项目" tone="green" />
        <Stat icon={<Star />} value={stats?.starsCount ?? 0} label="项目星标" tone="yellow" />
        <Stat icon={<Coffee />} value={stats?.coffeeCount ?? 0} label="杯咖啡" tone="blue" />
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-label">LATEST NOTES</span>
            <h2>最近更新</h2>
          </div>
          <Link to="/articles">查看全部 <ArrowRight size={16} /></Link>
        </div>
        {articles.length > 0 ? (
          <div className="article-grid home-articles">
            {articles.map((article, index) => <ArticleCard key={article.id} article={article} featured={index === 0} />)}
          </div>
        ) : <p className="inline-empty">还没有公开文章。</p>}
      </section>

      {projects.length > 0 && (
        <section className="content-section project-highlight-section">
          <div className="section-heading">
            <div>
              <span className="section-label">SELECTED WORK</span>
              <h2>精选项目</h2>
            </div>
            <Link to="/projects">项目档案 <ArrowRight size={16} /></Link>
          </div>
          <div className="project-highlight-list">
            {projects.slice(0, 3).map((project, index) => (
              <Link to="/projects" className="project-highlight" key={project.id}>
                <span className="project-index">0{index + 1}</span>
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                </div>
                <span className="tech-inline">{splitCommaList(project.techStack).slice(0, 3).join(' / ')}</span>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="content-section skills-section">
          <div className="section-heading">
            <div>
              <span className="section-label">TOOLKIT</span>
              <h2>技能图谱</h2>
            </div>
          </div>
          <div className="skill-columns">
            {[...skillGroups.entries()].slice(0, 4).map(([category, items]) => (
              <div className="skill-group" key={category}>
                <h3>{category}</h3>
                {items.map((skill) => (
                  <div className="skill-line" key={skill.id}>
                    <span>{skill.name}</span>
                    <span className="skill-track"><i style={{ width: `${clampPercent(skill.proficiency)}%` }} /></span>
                    <small>{clampPercent(skill.proficiency)}</small>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {(profile?.ctaTitle || profile?.ctaDescription) && (
        <section className="home-cta">
          <div><span className="section-label">LET'S CONNECT</span><h2>{profile.ctaTitle || '保持联系'}</h2><p>{profile.ctaDescription}</p></div>
          <div>{profile.website && <button className="button button-secondary" onClick={() => void openExternalUrl(profile.website)}><ExternalLink size={16} />访问网站</button>}{profile.emailPublic && <button className="button button-primary" onClick={() => void openExternalUrl(`mailto:${profile.emailPublic}`)}><Mail size={16} />发送邮件</button>}</div>
        </section>
      )}
    </div>
  )
}

function featureIcon(name?: string) {
  const icons = { Code: Code2, Code2, Database, Globe: Globe2, Globe2, Rocket: Zap, Sparkles, Zap, Cpu, Briefcase: BriefcaseBusiness }
  return icons[name as keyof typeof icons] || Sparkles
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className="stat-item">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <strong>{Number(value).toLocaleString('zh-CN')}</strong>
      <small>{label}</small>
    </div>
  )
}
