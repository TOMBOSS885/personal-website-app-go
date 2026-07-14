import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Github, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { publicApi } from '../../shared/api/client'
import type { Project } from '../../shared/api/types'
import { EmptyState, ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { RemoteImage } from '../../shared/components/RemoteImage'
import { splitCommaList } from '../../shared/lib/format'
import { openExternalUrl } from '../../shared/lib/platform'
import { useSettings } from '../../shared/settings/SettingsContext'

export function ProjectsPage() {
  const { settings } = useSettings()
  const [search, setSearch] = useState('')
  const [tech, setTech] = useState('')
  const query = useQuery({
    queryKey: ['projects', settings.serverUrl],
    queryFn: ({ signal }) => publicApi.projects(settings.serverUrl, signal),
  })

  const techs = useMemo(() => Array.from(new Set(
    (query.data ?? []).flatMap((project) => splitCommaList(project.techStack)),
  )).slice(0, 12), [query.data])
  const projects = useMemo(() => (query.data ?? []).filter((project) => {
    const keyword = search.trim().toLowerCase()
    const matchesSearch = !keyword || `${project.name} ${project.description ?? ''} ${project.techStack ?? ''}`.toLowerCase().includes(keyword)
    const matchesTech = !tech || splitCommaList(project.techStack).includes(tech)
    return matchesSearch && matchesTech
  }).sort((left, right) => Number(Boolean(right.featured)) - Number(Boolean(left.featured))), [query.data, search, tech])

  if (query.isPending) return <LoadingState label="正在整理项目档案" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <div className="page">
      <section className="page-intro compact">
        <div>
          <span className="section-label">SELECTED & ARCHIVED</span>
          <h2>作品与实验</h2>
          <p>从完整产品到周末实验，所有公开项目都从同一服务器同步。</p>
        </div>
        <div className="summary-number"><strong>{query.data.length}</strong><span>PROJECTS</span></div>
      </section>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、描述或技术栈" />
        </label>
        <div className="chip-row" aria-label="技术栈筛选">
          <button className={!tech ? 'active' : ''} onClick={() => setTech('')}>全部</button>
          {techs.map((item) => <button key={item} className={tech === item ? 'active' : ''} onClick={() => setTech(item)}>{item}</button>)}
        </div>
      </div>

      {projects.length ? (
        <div className="project-grid">
          {projects.map((project) => <ProjectItem key={project.id} project={project} />)}
        </div>
      ) : (
        <EmptyState title="没有匹配的项目" description="调整关键词或技术栈后再试。" />
      )}
    </div>
  )
}

function ProjectItem({ project }: { project: Project }) {
  const stack = splitCommaList(project.techStack)
  return (
    <article className="project-card">
      <div className="project-image">
        <RemoteImage source={project.coverImage} alt={project.name} fallbackLabel={project.name} loading="lazy" />
        {project.featured && <span className="featured-badge"><Star size={13} /> 精选</span>}
      </div>
      <div className="project-body">
        <div className="project-title-row">
          <h3>{project.name}</h3>
          {(project.stars ?? 0) > 0 && <span><Star size={14} /> {project.stars}</span>}
        </div>
        <p>{project.description || '暂无项目说明。'}</p>
        <div className="project-tags">{stack.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="project-actions">
          {project.githubUrl && (
            <button className="button button-ghost" onClick={() => openExternalUrl(project.githubUrl)}>
              <Github size={16} /> 源码
            </button>
          )}
          {project.demoUrl && (
            <button className="button button-secondary" onClick={() => openExternalUrl(project.demoUrl)}>
              <ExternalLink size={16} /> 演示
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
