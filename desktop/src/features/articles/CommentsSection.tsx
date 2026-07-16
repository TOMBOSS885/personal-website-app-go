import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit3, LoaderCircle, LogIn, MessageCircle, Reply, Send, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, publicApi, userApi } from '../../shared/api/client'
import type { CommentView } from '../../shared/api/types'
import { formatDate } from '../../shared/lib/format'
import { useSettings } from '../../shared/settings/SettingsContext'
import { useUserAuth } from '../account/UserAuthContext'

export function CommentsSection({ articleId }: { articleId: number }) {
  const { settings } = useSettings()
  const auth = useUserAuth()
  const queryClient = useQueryClient()
  const queryKey = ['comments', settings.serverUrl, articleId, auth.user?.id ?? 'guest']
  const [content, setContent] = useState('')
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null)
  const [editing, setEditing] = useState<CommentView | null>(null)
  const [editContent, setEditContent] = useState('')

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => publicApi.comments(settings.serverUrl, articleId, pageParam, auth.accessToken, signal),
    getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const handleAuthError = async (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) await auth.clearSession()
  }
  const create = useMutation({
    mutationFn: () => {
      if (!auth.accessToken) throw new Error('请先登录')
      return userApi.createComment(settings.serverUrl, auth.accessToken, {
        articleId, parentId: replyTarget?.parentId || replyTarget?.id, content: content.trim(),
      })
    },
    onSuccess: () => { setContent(''); setReplyTarget(null); void refresh() },
    onError: handleAuthError,
  })
  const update = useMutation({
    mutationFn: () => {
      if (!auth.accessToken || !editing) throw new Error('请先登录')
      return userApi.updateComment(settings.serverUrl, auth.accessToken, editing.id, editContent.trim())
    },
    onSuccess: () => { setEditing(null); setEditContent(''); void refresh() },
    onError: handleAuthError,
  })
  const remove = useMutation({
    mutationFn: async (id: number) => {
      if (!auth.accessToken) throw new Error('请先登录')
      return userApi.deleteComment(settings.serverUrl, auth.accessToken, id)
    },
    onSuccess: () => void refresh(),
    onError: handleAuthError,
  })

  const comments = query.data?.pages.flatMap((page) => page.comments) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  const roots = useMemo(() => comments.filter((comment) => !comment.parentId), [comments])
  const replies = useMemo(() => comments.reduce((groups, comment) => {
    if (!comment.parentId) return groups
    const list = groups.get(comment.parentId) ?? []
    if (!list.some((item) => item.id === comment.id)) list.push(comment)
    groups.set(comment.parentId, list)
    return groups
  }, new Map<number, CommentView[]>()), [comments])

  if (query.isPending || query.isError) return null

  return (
    <section className="comments-section">
      <div className="comments-heading"><div><MessageCircle size={18} /><strong>读者讨论</strong><span>{total}</span></div></div>

      {auth.isAuthenticated ? (
        <form className="comment-composer" onSubmit={(event) => { event.preventDefault(); if (content.trim()) create.mutate() }}>
          <div className="composer-title">
            <span className="comment-avatar">{auth.user?.username.slice(0, 1).toUpperCase()}</span>
            <span>{replyTarget ? `回复 ${replyTarget.username}` : `以 ${auth.user?.username} 的身份发表评论`}</span>
            {replyTarget && <button type="button" title="取消回复" onClick={() => setReplyTarget(null)}><X size={14} /></button>}
          </div>
          <textarea value={content} onChange={(event) => setContent(event.target.value.slice(0, 1000))} placeholder="友善交流，分享你的想法..." rows={3} />
          <div className="composer-footer"><span>{content.length}/1000</span><button className="button button-primary" disabled={!content.trim() || create.isPending}>{create.isPending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}发布评论</button></div>
          {create.isError && <div className="form-message error">{errorMessage(create.error)}</div>}
        </form>
      ) : (
        <div className="comment-login-prompt"><span>登录后可以发表和回复评论</span><Link className="button button-secondary" to="/account"><LogIn size={15} /> 登录账号</Link></div>
      )}

      {roots.length === 0 ? (
        <p className="comments-empty">还没有公开评论，来发表第一条讨论吧。</p>
      ) : (
        <div className="comment-list">
          {roots.map((comment) => (
            <article className="comment-thread" key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={auth.user?.id}
                editing={editing?.id === comment.id}
                editContent={editContent}
                onEditContent={setEditContent}
                onStartEdit={() => { setEditing(comment); setEditContent(comment.content) }}
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={() => update.mutate()}
                onReply={() => setReplyTarget(comment)}
                onDelete={() => { if (window.confirm('确定删除这条评论吗？')) remove.mutate(comment.id) }}
                pending={update.isPending || remove.isPending}
              />
              {(replies.get(comment.id) ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  reply
                  currentUserId={auth.user?.id}
                  editing={editing?.id === reply.id}
                  editContent={editContent}
                  onEditContent={setEditContent}
                  onStartEdit={() => { setEditing(reply); setEditContent(reply.content) }}
                  onCancelEdit={() => setEditing(null)}
                  onSaveEdit={() => update.mutate()}
                  onReply={() => setReplyTarget(comment)}
                  onDelete={() => { if (window.confirm('确定删除这条回复吗？')) remove.mutate(reply.id) }}
                  pending={update.isPending || remove.isPending}
                />
              ))}
            </article>
          ))}
          {query.hasNextPage && <button className="load-comments" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? '正在加载' : '加载更多讨论'}</button>}
        </div>
      )}
    </section>
  )
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : '请求失败，请稍后重试。' }

type CommentItemProps = {
  comment: CommentView
  reply?: boolean
  currentUserId?: number
  editing: boolean
  editContent: string
  pending: boolean
  onEditContent: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onReply: () => void
  onDelete: () => void
}

function CommentItem({ comment, reply = false, currentUserId, editing, editContent, pending, onEditContent, onStartEdit, onCancelEdit, onSaveEdit, onReply, onDelete }: CommentItemProps) {
  const own = currentUserId === comment.userId
  const editable = own && Date.now() - new Date(comment.createdAt).getTime() <= 15 * 60_000
  return (
    <div className={`comment-item${reply ? ' reply' : ''}`}>
      <span className="comment-avatar">{(comment.username || '读').slice(0, 1).toUpperCase()}</span>
      <div>
        <div className="comment-meta"><strong>{comment.username || '读者'}</strong>{own && <small>我</small>}<span>{formatDate(comment.createdAt)}</span></div>
        {editing ? (
          <div className="comment-edit"><textarea value={editContent} onChange={(event) => onEditContent(event.target.value.slice(0, 1000))} rows={3} /><div><button onClick={onCancelEdit}>取消</button><button disabled={!editContent.trim() || pending} onClick={onSaveEdit}>保存</button></div></div>
        ) : <p>{comment.content}</p>}
        {!editing && currentUserId && <div className="comment-actions"><button onClick={onReply}><Reply size={13} /> 回复</button>{editable && <button onClick={onStartEdit}><Edit3 size={13} /> 编辑</button>}{own && <button className="danger" onClick={onDelete}><Trash2 size={13} /> 删除</button>}</div>}
      </div>
    </div>
  )
}
