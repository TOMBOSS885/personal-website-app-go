import { useQuery } from '@tanstack/react-query'
import { BookOpen, FolderGit2, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { publicApi } from '../../shared/api/client'
import { ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { useSettings } from '../../shared/settings/SettingsContext'

export function SearchPage() {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const activeQuery = params.get('q')?.trim() || ''
  const [draft, setDraft] = useState(activeQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useQuery({
    queryKey: ['search', settings.serverUrl, activeQuery],
    queryFn: ({ signal }) => publicApi.search(settings.serverUrl, activeQuery, signal),
    enabled: activeQuery.length >= 2,
  })

  useEffect(() => inputRef.current?.focus(), [])

  return (
    <div className="page search-page">
      <section className="search-stage">
        <span className="section-label">SEARCH THE JOURNAL</span>
        <h2>找到那篇文章或那个项目</h2>
        <form onSubmit={(event) => {
          event.preventDefault()
          const value = draft.trim()
          setParams(value ? { q: value } : {})
        }}>
          <Search size={22} />
          <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入至少两个字进行搜索" />
          <button type="submit" className="button button-primary">搜索</button>
        </form>
      </section>

      <section className="search-results">
        {!activeQuery ? (
          <SearchPrompt />
        ) : activeQuery.length < 2 ? (
          <SearchPrompt text="关键词至少需要两个字" />
        ) : query.isPending ? (
          <LoadingState label="正在搜索全部内容" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <SearchPrompt text={`没有找到与“${activeQuery}”相关的内容`} />
        ) : (
          <>
            <div className="results-heading"><span>搜索结果</span><strong>{query.data.length}</strong></div>
            <div className="result-list">
              {query.data.map((item) => {
                const target = item.type === 'article' ? `/articles/${item.id}` : item.type === 'project' ? '/projects' : '/'
                const Icon = item.type === 'article' ? BookOpen : item.type === 'project' ? FolderGit2 : Sparkles
                return (
                  <Link key={`${item.type}-${item.id}`} to={target} className="result-item">
                    <span className={`result-icon ${item.type}`}><Icon size={18} /></span>
                    <span className="result-copy"><small>{typeLabel(item.type)}</small><strong>{item.title}</strong><p>{item.description || '暂无描述'}</p></span>
                    <span className="result-arrow">↗</span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function SearchPrompt({ text = '输入关键词，搜索文章、项目和技能' }: { text?: string }) {
  return <div className="search-prompt"><Search size={24} /><span>{text}</span></div>
}

function typeLabel(type: string) {
  if (type === 'article') return '文章'
  if (type === 'project') return '项目'
  if (type === 'skill') return '技能'
  return type
}
