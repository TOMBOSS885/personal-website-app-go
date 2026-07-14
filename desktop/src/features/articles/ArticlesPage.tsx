import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Edit3, FileText, Lock, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, ErrorNotice, Input, LoadingState, PageHeader, StatusBadge } from '@shared/components/ui'
import { normalizePage, type PageResponse } from '@shared/api/pagination'
import { useAuth } from '@features/auth/AuthContext'
import { ArticleEditor } from './ArticleEditor'
import type { Article } from './types'

export function ArticlesPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [deleting, setDeleting] = useState<Article | null>(null)
  const size = 20

  const articles = useQuery({
    queryKey: ['articles', 'list', page, size],
    queryFn: async () => normalizePage(await api!.request<Article[] | PageResponse<Article>>(`/api/admin/articles?page=${page}&size=${size}`), page, size),
    enabled: Boolean(api),
    placeholderData: (previous) => previous,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api!.request(`/api/admin/articles/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null)
      await queryClient.invalidateQueries({ queryKey: ['articles'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const content = articles.data?.content || []
  const filtered = keyword.trim() ? content.filter((article) => `${article.title} ${article.summary} ${article.category} ${article.tags}`.toLowerCase().includes(keyword.trim().toLowerCase())) : content
  const openEditor = (article: Article | null) => { setEditing(article); setEditorOpen(true) }
  const onSaved = () => { void queryClient.invalidateQueries({ queryKey: ['articles'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }) }

  return (
    <div>
      <PageHeader title="文章" description="创建、编辑和发布 Markdown 或静态前端文章" actions={<><Button onClick={() => void articles.refetch()}><RefreshCw className={`h-4 w-4 ${articles.isFetching ? 'animate-spin' : ''}`} />刷新</Button><Button variant="primary" onClick={() => openEditor(null)}><Plus className="h-4 w-4" />新建文章</Button></>} />
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line p-3">
          <div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><Input className="pl-9" placeholder="筛选当前页文章" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div>
          <span className="shrink-0 text-xs text-muted">共 {articles.data?.totalElements ?? 0} 篇</span>
        </div>
        {articles.isPending ? <LoadingState label="正在读取文章" /> : articles.error ? <div className="p-4"><ErrorNotice error={articles.error} onRetry={() => void articles.refetch()} /></div> : filtered.length === 0 ? <EmptyState title={keyword ? '当前页没有匹配结果' : '还没有文章'} description={keyword ? '清除筛选词后再试。' : '新建第一篇文章，草稿会自动保存在本机。'} action={!keyword ? <Button variant="primary" onClick={() => openEditor(null)}><Plus className="h-4 w-4" />新建文章</Button> : undefined} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-[var(--color-surface-subtle)] text-xs text-muted"><tr><th className="table-cell font-medium">文章</th><th className="table-cell w-36 font-medium">分类</th><th className="table-cell w-28 font-medium">状态</th><th className="table-cell w-24 font-medium">阅读</th><th className="table-cell w-40 font-medium">更新时间</th><th className="table-cell w-24 text-right font-medium">操作</th></tr></thead>
              <tbody>{filtered.map((article) => <tr key={article.id} className="hover:bg-[var(--color-surface-subtle)]"><td className="table-cell"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" style={{ borderRadius: 6 }}><FileText className="h-4 w-4" /></div><div className="min-w-0"><p className="flex items-center gap-2 truncate font-medium text-ink">{article.title}{article.isLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" /> : null}</p><p className="mt-1 max-w-xl truncate text-xs text-muted">{article.summary || '无摘要'}</p></div></div></td><td className="table-cell text-muted">{article.category || '-'}</td><td className="table-cell"><StatusBadge tone={article.published ? 'success' : 'neutral'}>{article.published ? '已发布' : '草稿'}</StatusBadge></td><td className="table-cell tabular-nums text-muted">{article.views || 0}</td><td className="table-cell text-muted">{new Date(article.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td className="table-cell"><div className="flex justify-end gap-1"><Button variant="ghost" className="h-8 min-h-8 w-8 px-0" title="编辑" onClick={() => openEditor(article)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" className="h-8 min-h-8 w-8 px-0 text-danger" title="删除" onClick={() => setDeleting(article)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="flex min-h-12 items-center justify-between border-t border-line px-3">
          <span className="text-xs text-muted">第 {(articles.data?.number ?? 0) + 1} / {Math.max(articles.data?.totalPages ?? 0, 1)} 页</span>
          <div className="flex gap-1"><Button variant="ghost" className="h-8 min-h-8 w-8 px-0" disabled={!articles.data || articles.data.first} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" className="h-8 min-h-8 w-8 px-0" disabled={!articles.data || articles.data.last} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
        </div>
      </div>
      <ArticleEditor open={editorOpen} article={editing} onClose={() => setEditorOpen(false)} onSaved={onSaved} />
      <ConfirmDialog open={Boolean(deleting)} title="删除文章？" description={`“${deleting?.title || ''}”将从服务器永久删除，此操作不能撤销。`} confirmLabel="删除" busy={deleteMutation.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
      {deleteMutation.error ? <div className="mt-4"><ErrorNotice error={deleteMutation.error} /></div> : null}
    </div>
  )
}
