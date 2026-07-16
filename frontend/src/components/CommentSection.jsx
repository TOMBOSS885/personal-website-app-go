import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CornerDownRight,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useUserAuth } from '../contexts/UserAuthContext'

const MAX_COMMENT_LENGTH = 1000
const COMMENT_PAGE_SIZE = 20
const MAX_COMMENTS_IN_MEMORY = 300

export default function CommentSection({ articleId }) {
  const { user, loading: authLoading, authFetch } = useUserAuth()
  const [comments, setComments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingId, setPendingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const requestControllerRef = useRef(null)
  const requestSequenceRef = useRef(0)

	const loadComments = useCallback(async ({ nextPage = 0, prepend = false } = {}) => {
		if (!articleId) return
		requestControllerRef.current?.abort()
		const controller = new AbortController()
		requestControllerRef.current = controller
		const requestSequence = requestSequenceRef.current + 1
		requestSequenceRef.current = requestSequence
		if (prepend) setLoadingMore(true)
		else setLoading(true)
		setLoadError('')
		try {
			const response = await fetch(`/api/public/articles/${articleId}/comments?page=${nextPage}&size=${COMMENT_PAGE_SIZE}`, { signal: controller.signal })
			if (!response.ok) throw new Error('评论加载失败')
			const data = await response.json()
			if (requestSequence !== requestSequenceRef.current) return
			const nextComments = normalizeComments(data)
			setComments(current => (prepend ? mergeComments(nextComments, current) : nextComments).slice(0, MAX_COMMENTS_IN_MEMORY))
			setTotal(Number.isFinite(Number(data?.total)) ? Number(data.total) : nextComments.length)
			setPage(nextPage)
			setHasMore(Boolean(data?.hasMore))
		} catch (error) {
			if (error.name !== 'AbortError' && requestSequence === requestSequenceRef.current) {
				setLoadError(error.message || '评论加载失败，请稍后重试')
			}
		} finally {
			if (requestSequence === requestSequenceRef.current) {
				setLoading(false)
				setLoadingMore(false)
			}
		}
	}, [articleId])

	useEffect(() => {
		loadComments()
		return () => requestControllerRef.current?.abort()
	}, [loadComments])

  const threads = useMemo(() => buildThreads(comments), [comments])

  const submitComment = async (event) => {
    event.preventDefault()
    const nextContent = content.trim()
    if (!user || !nextContent || submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      const response = await authFetch('/api/user/comments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: Number(articleId),
          ...(replyTo ? { parentId: Number(replyTo.parentId || replyTo.id) } : {}),
          content: nextContent,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, '评论发布失败'))
      setContent('')
      setReplyTo(null)
      await loadComments()
    } catch (error) {
      setActionError(error.message || '评论发布失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const saveEdit = async (commentId) => {
    const nextContent = editingContent.trim()
    if (!nextContent || pendingId) return
    setPendingId(commentId)
    setActionError('')
    try {
      const response = await authFetch(`/api/user/comments/${commentId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nextContent }),
      })
      if (!response.ok) throw new Error(await readError(response, '评论修改失败'))
      setEditingId(null)
      setEditingContent('')
      await loadComments()
    } catch (error) {
      setActionError(error.message || '评论修改失败，请稍后重试')
    } finally {
      setPendingId(null)
    }
  }

  const deleteComment = async (commentId) => {
    if (pendingId || !window.confirm('确定删除这条评论吗？')) return
    setPendingId(commentId)
    setActionError('')
    try {
      const response = await authFetch(`/api/user/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error(await readError(response, '评论删除失败'))
      if (replyTo && String(replyTo.id) === String(commentId)) setReplyTo(null)
      await loadComments()
    } catch (error) {
      setActionError(error.message || '评论删除失败，请稍后重试')
    } finally {
      setPendingId(null)
    }
  }

  const beginReply = (comment) => {
    setReplyTo(comment)
    setEditingId(null)
    setActionError('')
    window.requestAnimationFrame(() => document.getElementById('article-comment-input')?.focus())
  }

  const beginEdit = (comment) => {
    setEditingId(comment.id)
    setEditingContent(comment.content)
    setReplyTo(null)
    setActionError('')
  }

  return (
    <section aria-labelledby="comments-title" className="mx-auto mt-14 max-w-4xl rounded-3xl border border-white/60 bg-white/75 px-5 py-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md dark:border-slate-700/40 dark:bg-slate-950/60 md:px-8 md:py-8">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">交流与讨论</span>
          </div>
          <h2 id="comments-title" className="text-2xl font-bold text-gray-900 dark:text-slate-100">
				评论 <span className="ml-1 text-base font-medium text-gray-400">{total}</span>
          </h2>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={() => loadComments()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/80 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
            aria-label="刷新评论"
            title="刷新评论"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {authLoading ? (
        <div className="mb-9 flex items-center gap-3 border-b border-gray-200/80 pb-8 dark:border-slate-700/70" aria-label="正在恢复登录状态">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200/80 dark:bg-slate-800" />
          <div className="h-24 flex-1 animate-pulse rounded-xl bg-white/50 dark:bg-slate-900/50" />
        </div>
      ) : user ? (
        <form onSubmit={submitComment} className="mb-9 border-b border-gray-200/80 pb-8 dark:border-slate-700/70">
          {replyTo && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-indigo-50/80 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
              <span className="min-w-0 truncate">回复 @{replyTo.username || '用户'}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="shrink-0" aria-label="取消回复" title="取消回复">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-start gap-3">
            <CommentAvatar username={user.username} size="large" />
            <div className="min-w-0 flex-1">
              <textarea
                id="article-comment-input"
				aria-label={replyTo ? `回复 ${replyTo.username || '用户'}` : '发表评论'}
                value={content}
                onChange={event => setContent(event.target.value)}
                maxLength={MAX_COMMENT_LENGTH}
                rows={4}
                placeholder={replyTo ? `回复 @${replyTo.username || '用户'}...` : '分享你的想法...'}
                className="w-full resize-y rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm leading-6 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className={`text-xs ${content.length >= MAX_COMMENT_LENGTH ? 'text-rose-500' : 'text-gray-400 dark:text-slate-500'}`}>
                  {content.length}/{MAX_COMMENT_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? '发布中' : replyTo ? '发布回复' : '发表评论'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-9 flex flex-col items-start justify-between gap-4 border-y border-indigo-100 bg-white/45 px-4 py-5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/30 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100">登录后参与讨论</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">访客可以阅读评论，登录后才能回复和发表。</p>
            </div>
          </div>
          <Link to={`/login?returnTo=${encodeURIComponent(`/blog/${articleId}`)}`} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
			登录或注册
          </Link>
        </div>
      )}

      {actionError && <p role="alert" className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{actionError}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500 dark:text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在加载评论
        </div>
      ) : loadError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-300">{loadError}</p>
          <button type="button" onClick={() => loadComments()} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">
            重新加载
          </button>
        </div>
      ) : threads.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-slate-400">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p className="font-medium">还没有评论</p>
          <p className="mt-1 text-sm">登录后留下第一条想法。</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200/80 dark:divide-slate-700/70">
			{threads.map(thread => (
            <div key={thread.comment.id}>
              <CommentItem
                comment={thread.comment}
                user={user}
                editingId={editingId}
                editingContent={editingContent}
                pendingId={pendingId}
                onReply={beginReply}
                onEdit={beginEdit}
                onEditingChange={setEditingContent}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={saveEdit}
                onDelete={deleteComment}
              />
              {thread.replies.length > 0 && (
                <div className="ml-5 border-l-2 border-indigo-100 pl-4 dark:border-slate-700 sm:ml-12 sm:pl-6">
                  {thread.replies.map(reply => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      user={user}
                      isReply
                      editingId={editingId}
                      editingContent={editingContent}
                      pendingId={pendingId}
                      onReply={beginReply}
                      onEdit={beginEdit}
                      onEditingChange={setEditingContent}
                      onCancelEdit={() => setEditingId(null)}
                      onSaveEdit={saveEdit}
                      onDelete={deleteComment}
                    />
				  ))}
				</div>
              )}
            </div>
          ))}
			{hasMore && (
			  <div className="py-5 text-center">
				<button
				  type="button"
				  onClick={() => loadComments({ nextPage: page + 1, prepend: true })}
				  disabled={loadingMore}
				  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white/60 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-indigo-300"
				>
				  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
				  {loadingMore ? '加载中...' : '加载更早评论'}
				</button>
			  </div>
			)}
        </div>
      )}
    </section>
  )
}

function CommentItem({
  comment,
  user,
  isReply = false,
  editingId,
  editingContent,
  pendingId,
  onReply,
  onEdit,
  onEditingChange,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) {
	const isOwner = user && String(user.id) === String(comment.userId)
	const canEdit = isOwner && canEditComment(comment.createdAt)
  const isEditing = String(editingId) === String(comment.id)
  const isPending = String(pendingId) === String(comment.id)

  return (
    <article className={`flex gap-3 py-6 ${isReply ? 'sm:gap-4' : 'sm:gap-5'}`}>
      <CommentAvatar username={comment.username} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-gray-900 dark:text-slate-100">{comment.username || '用户'}</span>
          <time dateTime={comment.createdAt} className="text-xs text-gray-400 dark:text-slate-500">
            {formatCommentTime(comment.createdAt)}
          </time>
          {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
            <span className="text-xs text-gray-400 dark:text-slate-500">已编辑</span>
          )}
        </header>

        {isEditing ? (
          <div className="mt-3">
            <textarea
              value={editingContent}
              onChange={event => onEditingChange(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={3}
              autoFocus
              className="w-full resize-y rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-sm leading-6 text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-indigo-500/20"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={onCancelEdit} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800">取消</button>
              <button
                type="button"
                onClick={() => onSaveEdit(comment.id)}
                disabled={!editingContent.trim() || isPending}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? '保存中' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-700 dark:text-slate-300">{comment.content}</p>
        )}

        {!isEditing && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {user && (
              <button type="button" onClick={() => onReply(comment)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 transition hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300">
                <CornerDownRight className="h-3.5 w-3.5" />
                回复
              </button>
            )}
			{canEdit && (
				<button type="button" onClick={() => onEdit(comment)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200">
				  <Pencil className="h-3.5 w-3.5" />
				  编辑
				</button>
			)}
			{isOwner && (
				<button type="button" onClick={() => onDelete(comment.id)} disabled={isPending} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300">
				  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
				  删除
				</button>
			)}
          </div>
        )}
      </div>
    </article>
  )
}

function CommentAvatar({ username, size = 'normal' }) {
  const dimension = size === 'large' ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-9 w-9 sm:h-10 sm:w-10'
  return (
    <div aria-hidden="true" className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600 ring-2 ring-white/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-slate-700`}>
      {String(username || 'U').slice(0, 1).toUpperCase()}
    </div>
  )
}

function normalizeComments(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : Array.isArray(data?.comments) ? data.comments : []
  return list.filter(comment => comment && comment.id != null)
}

function mergeComments(older, current) {
  const seen = new Set()
  return [...older, ...current].filter(comment => {
    const key = String(comment.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildThreads(comments) {
  const roots = []
  const rootsById = new Map()
  const pendingReplies = []

  comments.forEach(comment => {
    if (comment.parentId == null) {
      const thread = { comment, replies: [] }
      roots.push(thread)
      rootsById.set(String(comment.id), thread)
    } else {
      pendingReplies.push(comment)
    }
  })

  pendingReplies.forEach(reply => {
    const thread = rootsById.get(String(reply.parentId))
    if (thread) thread.replies.push(reply)
    else roots.push({ comment: reply, replies: [] })
  })
  return roots
}

async function readError(response, fallback) {
  const data = await response.json().catch(() => null)
  return data?.message || fallback
}

function formatCommentTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function canEditComment(value) {
  const createdAt = new Date(value).getTime()
  return Number.isFinite(createdAt) && Date.now() - createdAt <= 15 * 60 * 1000
}
