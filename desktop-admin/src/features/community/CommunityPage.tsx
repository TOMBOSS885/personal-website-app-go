import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, RefreshCw, ShieldOff, Trash2, UserCheck, UsersRound } from 'lucide-react'
import { normalizePage, type PageResponse } from '@shared/api/pagination'
import { Button, ConfirmDialog, EmptyState, ErrorNotice, LoadingState, PageHeader, StatusBadge } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'

interface Summary { totalUsers: number; active24Hours: number; active7Days: number; new7Days: number; disabledUsers: number; totalComments: number }
interface UserItem { id: number; username: string; email: string; status: 'active' | 'disabled'; emailVerified: boolean; loginCount: number; createdAt: string; lastActiveAt?: string }
interface CommentItem { id: number; articleId: number; username: string; articleTitle?: string; content: string; status: 'visible' | 'hidden'; createdAt: string }

export function CommunityPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'users' | 'comments'>('users')
  const [deleting, setDeleting] = useState<CommentItem | null>(null)
  const summary = useQuery({ queryKey: ['community', 'summary'], queryFn: () => api!.request<Summary>('/api/admin/users/summary'), enabled: Boolean(api) })
  const users = useQuery({ queryKey: ['community', 'users'], queryFn: async () => normalizePage(await api!.request<PageResponse<UserItem>>('/api/admin/users?page=0&size=50'), 0, 50), enabled: Boolean(api) && tab === 'users' })
  const comments = useQuery({ queryKey: ['community', 'comments'], queryFn: async () => normalizePage(await api!.request<PageResponse<CommentItem>>('/api/admin/comments?page=0&size=50'), 0, 50), enabled: Boolean(api) && tab === 'comments' })
  const updateUser = useMutation({ mutationFn: (user: UserItem) => api!.request(`/api/admin/users/${user.id}/status`, { method: 'PATCH', body: { status: user.status === 'active' ? 'disabled' : 'active' } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community'] }) })
  const updateComment = useMutation({ mutationFn: (comment: CommentItem) => api!.request(`/api/admin/comments/${comment.id}/status`, { method: 'PATCH', body: { status: comment.status === 'visible' ? 'hidden' : 'visible' } }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community'] }) })
  const deleteComment = useMutation({ mutationFn: (id: number) => api!.request(`/api/admin/comments/${id}`, { method: 'DELETE' }), onSuccess: () => { setDeleting(null); void queryClient.invalidateQueries({ queryKey: ['community'] }) } })

  const refresh = () => { void summary.refetch(); if (tab === 'users') void users.refetch(); else void comments.refetch() }
  const currentError = summary.error || users.error || comments.error || updateUser.error || updateComment.error || deleteComment.error

  return (
    <div>
      <PageHeader title="用户与评论" description="查看注册用户并处理文章评论" actions={<Button onClick={refresh}><RefreshCw className={`h-4 w-4 ${(summary.isFetching || users.isFetching || comments.isFetching) ? 'animate-spin' : ''}`} />刷新</Button>} />
      <section className="mb-5 grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Metric label="用户总数" value={summary.data?.totalUsers} />
        <Metric label="24h 活跃" value={summary.data?.active24Hours} />
        <Metric label="7 日活跃" value={summary.data?.active7Days} />
        <Metric label="7 日新增" value={summary.data?.new7Days} />
        <Metric label="已停用" value={summary.data?.disabledUsers} />
        <Metric label="评论总数" value={summary.data?.totalComments} />
      </section>
      {currentError ? <div className="mb-4"><ErrorNotice error={currentError} /></div> : null}
      <div className="panel overflow-hidden">
        <div className="flex gap-1 border-b border-line p-2"><Button variant={tab === 'users' ? 'primary' : 'ghost'} onClick={() => setTab('users')}><UsersRound className="h-4 w-4" />用户</Button><Button variant={tab === 'comments' ? 'primary' : 'ghost'} onClick={() => setTab('comments')}><MessageSquare className="h-4 w-4" />评论</Button></div>
        {tab === 'users' ? (users.isPending ? <LoadingState /> : !users.data?.content.length ? <EmptyState title="没有用户" /> : <div className="overflow-x-auto"><table className="w-full min-w-[860px]"><thead className="bg-[var(--color-surface-subtle)] text-xs text-muted"><tr><th className="table-cell">用户</th><th className="table-cell">状态</th><th className="table-cell">登录次数</th><th className="table-cell">注册时间</th><th className="table-cell text-right">操作</th></tr></thead><tbody>{users.data.content.map((user) => <tr key={user.id}><td className="table-cell"><p className="font-medium">{user.username}</p><p className="mt-1 text-xs text-muted">{user.email}</p></td><td className="table-cell"><StatusBadge tone={user.status === 'active' ? 'success' : 'danger'}>{user.status === 'active' ? '正常' : '已停用'}</StatusBadge></td><td className="table-cell tabular-nums">{user.loginCount}</td><td className="table-cell text-muted">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td><td className="table-cell"><div className="flex justify-end"><Button onClick={() => updateUser.mutate(user)} disabled={updateUser.isPending}>{user.status === 'active' ? <ShieldOff className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}{user.status === 'active' ? '停用' : '启用'}</Button></div></td></tr>)}</tbody></table></div>) : (comments.isPending ? <LoadingState /> : !comments.data?.content.length ? <EmptyState title="没有评论" /> : <div className="overflow-x-auto"><table className="w-full min-w-[920px]"><thead className="bg-[var(--color-surface-subtle)] text-xs text-muted"><tr><th className="table-cell">评论</th><th className="table-cell">文章</th><th className="table-cell">状态</th><th className="table-cell">时间</th><th className="table-cell text-right">操作</th></tr></thead><tbody>{comments.data.content.map((comment) => <tr key={comment.id}><td className="table-cell"><p className="line-clamp-2 max-w-xl">{comment.content}</p><p className="mt-1 text-xs text-muted">{comment.username}</p></td><td className="table-cell text-muted">{comment.articleTitle || `#${comment.articleId}`}</td><td className="table-cell"><StatusBadge tone={comment.status === 'visible' ? 'success' : 'warning'}>{comment.status === 'visible' ? '显示' : '隐藏'}</StatusBadge></td><td className="table-cell text-muted">{new Date(comment.createdAt).toLocaleString('zh-CN')}</td><td className="table-cell"><div className="flex justify-end gap-1"><Button onClick={() => updateComment.mutate(comment)} disabled={updateComment.isPending}>{comment.status === 'visible' ? '隐藏' : '显示'}</Button><Button variant="ghost" className="h-9 w-9 px-0 text-danger" onClick={() => setDeleting(comment)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></div>)}
      </div>
      <ConfirmDialog open={Boolean(deleting)} title="删除评论？" description="评论将从服务器永久删除。" confirmLabel="删除" busy={deleteComment.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && deleteComment.mutate(deleting.id)} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value?: number }) { return <div className="panel min-h-20 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value ?? '-'}</p></div> }
