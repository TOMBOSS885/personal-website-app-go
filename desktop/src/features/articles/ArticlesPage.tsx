import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { publicApi } from '../../shared/api/client'
import { ArticleCard } from '../../shared/components/ArticleCard'
import { EmptyState, ErrorState, LoadingState } from '../../shared/components/AsyncState'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useSettings } from '../../shared/settings/SettingsContext'

export function ArticlesPage() {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const page = Math.max(0, Number(params.get('page') || 0))
  const search = params.get('q') || ''
  const category = params.get('category') || ''
  const tag = params.get('tag') || ''
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  const metaQuery = useQuery({
    queryKey: ['article-meta', settings.serverUrl],
    queryFn: async ({ signal }) => {
      const [categories, tags] = await Promise.all([
        publicApi.categories(settings.serverUrl, signal),
        publicApi.tags(settings.serverUrl, signal),
      ])
      return { categories: categories ?? [], tags: tags ?? [] }
    },
  })
  const articleQuery = useQuery({
    queryKey: ['articles', settings.serverUrl, page, debouncedSearch, category, tag],
    queryFn: ({ signal }) => publicApi.articles(settings.serverUrl, {
      page,
      size: 9,
      q: debouncedSearch,
      category,
      tag,
    }, signal),
    placeholderData: (previous) => previous,
  })

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  const clearFilters = () => setParams({})
  const hasFilters = Boolean(search || category || tag)
  const visiblePages = useMemo(() => {
    const total = articleQuery.data?.totalPages ?? 0
    return Array.from({ length: total }, (_, index) => index)
      .filter((index) => index === 0 || index === total - 1 || Math.abs(index - page) <= 1)
  }, [articleQuery.data?.totalPages, page])

  return (
    <div className="page">
      <section className="page-intro compact">
        <div>
          <h2>文章归档</h2>
          <p>技术笔记、生活记录与持续更新的长篇文章。</p>
        </div>
        <div className="summary-number">
          <strong>{articleQuery.data?.totalElements ?? '—'}</strong>
          <span>篇</span>
        </div>
      </section>

      <section className="filter-bar article-filters">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => updateParam('q', event.target.value)}
            placeholder="搜索标题、摘要、分类或标签"
          />
          {search && <button className="clear-input" onClick={() => updateParam('q', '')} title="清除搜索"><X size={15} /></button>}
        </label>
        <div className="filter-line">
          <SlidersHorizontal size={16} />
          <div className="chip-row">
            <button className={!category ? 'active' : ''} onClick={() => updateParam('category', '')}>全部分类</button>
            {(metaQuery.data?.categories ?? []).map((item) => (
              <button key={item} className={category === item ? 'active' : ''} onClick={() => updateParam('category', item)}>{item}</button>
            ))}
          </div>
        </div>
        {(metaQuery.data?.tags.length ?? 0) > 0 && (
          <div className="tag-filter-row">
            {(metaQuery.data?.tags ?? []).slice(0, 16).map((item) => (
              <button key={item} className={tag === item ? 'active' : ''} onClick={() => updateParam('tag', tag === item ? '' : item)}>#{item}</button>
            ))}
          </div>
        )}
      </section>

      {articleQuery.isPending ? (
        <LoadingState label="正在获取文章" />
      ) : articleQuery.isError ? (
        <ErrorState error={articleQuery.error} onRetry={() => articleQuery.refetch()} />
      ) : articleQuery.data.content.length ? (
        <>
          <div className={`article-grid archive-grid${articleQuery.isFetching ? ' is-refreshing' : ''}`}>
            {articleQuery.data.content.map((article) => <ArticleCard key={article.id} article={article} />)}
          </div>
          {articleQuery.data.totalPages > 1 && (
            <nav className="pagination" aria-label="文章分页">
              <button disabled={page === 0} onClick={() => updateParam('page', String(page - 1))} title="上一页"><ChevronLeft size={17} /></button>
              {visiblePages.map((index, position) => (
                <span key={index} className="pagination-slot">
                  {position > 0 && visiblePages[position - 1] !== index - 1 && <i>…</i>}
                  <button className={page === index ? 'active' : ''} onClick={() => updateParam('page', String(index))}>{index + 1}</button>
                </span>
              ))}
              <button disabled={page >= articleQuery.data.totalPages - 1} onClick={() => updateParam('page', String(page + 1))} title="下一页"><ChevronRight size={17} /></button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState
          title="没有找到文章"
          description={hasFilters ? '换一个关键词或清除筛选条件。' : '服务器上暂时没有公开文章。'}
          action={hasFilters ? <button className="button button-secondary" onClick={clearFilters}>清除筛选</button> : undefined}
        />
      )}
    </div>
  )
}
