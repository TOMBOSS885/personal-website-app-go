import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { ImagePlus, LoaderCircle, Save, UploadCloud } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { z } from 'zod'
import { Button, ConfirmDialog, Dialog, ErrorNotice, Field, Input, Select, Textarea } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'
import { deleteArticleDraft, loadArticleDraft, saveArticleDraft } from './draftRepository'
import { articleToForm, emptyArticle, type Article, type ArticleFormValue } from './types'

const schema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(255),
  summary: z.string().max(500, '摘要不能超过 500 个字符'),
  content: z.string(),
  coverImage: z.string(),
  category: z.string().max(100),
  tags: z.string().max(500),
  published: z.boolean(),
  contentType: z.enum(['markdown', 'static']),
  staticSiteKey: z.string(),
  staticSiteName: z.string(),
  isLocked: z.boolean(),
  accessPassword: z.string().max(72),
}).superRefine((value, context) => {
  if (value.contentType === 'static' && !value.staticSiteKey) context.addIssue({ code: 'custom', path: ['staticSiteKey'], message: '请先上传静态站点 ZIP' })
  if (value.isLocked && value.accessPassword && [...value.accessPassword].length < 4) context.addIssue({ code: 'custom', path: ['accessPassword'], message: '访问密码至少 4 个字符' })
})

export function ArticleEditor({ open, article, onClose, onSaved }: { open: boolean; article: Article | null; onClose: () => void; onSaved: () => void }) {
  const { api } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [draftStatus, setDraftStatus] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [siteUploading, setSiteUploading] = useState(false)
  const initializedRef = useRef(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const siteInput = useRef<HTMLInputElement>(null)
  const key = article ? `article-${article.id}` : 'article-new'
  const form = useForm<ArticleFormValue>({ resolver: zodResolver(schema), defaultValues: emptyArticle })
  const values = useWatch({ control: form.control })
  const contentType = form.watch('contentType')
  const isLocked = form.watch('isLocked')

  useEffect(() => {
    if (!open) return
    let active = true
    initializedRef.current = false
    const base = article ? articleToForm(article) : emptyArticle
    form.reset(base)
    setDraftStatus('')
    setError(null)
    void loadArticleDraft(key).then((draft) => {
      if (!active) return
      if (draft && (!article || !draft.baseRemoteUpdatedAt || draft.baseRemoteUpdatedAt === article.updatedAt)) {
        form.reset(draft.payload)
        setDraftStatus(`已恢复 ${formatTime(draft.localUpdatedAt)} 的本地草稿`)
      }
      initializedRef.current = true
    })
    return () => { active = false }
  }, [open, article, key])

  useEffect(() => {
    if (!open || !initializedRef.current || !form.formState.isDirty) return
    const timer = window.setTimeout(() => {
      const payload = { ...emptyArticle, ...values } as ArticleFormValue
      void saveArticleDraft(key, payload, article?.id, article?.updatedAt).then((draft) => setDraftStatus(`本地草稿已保存 ${formatTime(draft.localUpdatedAt)}`)).catch((saveError) => setDraftStatus(saveError instanceof Error ? `草稿保存失败：${saveError.message}` : '草稿保存失败'))
    }, 1_200)
    return () => window.clearTimeout(timer)
  }, [values, open, key, article?.id, article?.updatedAt, form.formState.isDirty])

  const submit = form.handleSubmit(async (payload) => {
    setError(null)
    try {
      await api!.request<Article>(article ? `/api/admin/articles/${article.id}` : '/api/admin/articles', {
        method: article ? 'PUT' : 'POST',
        body: payload,
      })
      await deleteArticleDraft(key)
      form.reset(payload)
      onSaved()
      onClose()
    } catch (submitError) {
      setError(submitError)
    }
  })

  const uploadCover = async (file?: File) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await api!.request<{ url: string }>('/api/admin/article-images', { method: 'POST', body, timeoutMs: 120_000 })
      form.setValue('coverImage', result.url, { shouldDirty: true })
    } catch (uploadError) {
      setError(uploadError)
    } finally {
      setUploading(false)
      if (coverInput.current) coverInput.current.value = ''
    }
  }

  const uploadSite = async (file?: File) => {
    if (!file) return
    setSiteUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await api!.request<{ siteKey: string; name: string }>('/api/admin/article-sites', { method: 'POST', body, timeoutMs: 300_000 })
      form.setValue('staticSiteKey', result.siteKey, { shouldDirty: true })
      form.setValue('staticSiteName', result.name || file.name, { shouldDirty: true })
    } catch (uploadError) {
      setError(uploadError)
    } finally {
      setSiteUploading(false)
      if (siteInput.current) siteInput.current.value = ''
    }
  }

  const requestClose = () => form.formState.isDirty ? setShowCloseConfirm(true) : onClose()

  return (
    <>
      <Dialog
        open={open}
        title={article ? '编辑文章' : '新建文章'}
        description={draftStatus || (article ? `服务端更新于 ${new Date(article.updatedAt).toLocaleString('zh-CN')}` : '尚未发布')}
        onClose={requestClose}
        size="xl"
        footer={<><Button onClick={requestClose}>关闭</Button><Button variant="primary" onClick={() => void submit()} disabled={form.formState.isSubmitting}><Save className="h-4 w-4" />{form.formState.isSubmitting ? '保存中...' : '保存到服务器'}</Button></>}
      >
        {error ? <div className="mb-4"><ErrorNotice error={error} /></div> : null}
        <form onSubmit={submit} className="grid min-h-[560px] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="space-y-4">
            <Field label="标题" error={form.formState.errors.title?.message}><Input autoFocus {...form.register('title')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="分类" error={form.formState.errors.category?.message}><Input placeholder="技术笔记" {...form.register('category')} /></Field>
              <Field label="标签" error={form.formState.errors.tags?.message} hint="多个标签用英文逗号分隔"><Input placeholder="Go, React" {...form.register('tags')} /></Field>
            </div>
            <Field label="摘要" error={form.formState.errors.summary?.message}><Textarea rows={2} {...form.register('summary')} /></Field>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field label="封面地址"><Input placeholder="/uploads/articles/..." {...form.register('coverImage')} /></Field>
              <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(event) => void uploadCover(event.target.files?.[0])} />
              <Button onClick={() => coverInput.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{uploading ? '上传中' : '上传'}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="内容类型"><Select {...form.register('contentType')}><option value="markdown">Markdown</option><option value="static">静态前端 ZIP</option></Select></Field>
              <Field label="发布状态"><Select value={form.watch('published') ? 'published' : 'draft'} onChange={(event) => form.setValue('published', event.target.value === 'published', { shouldDirty: true })}><option value="draft">草稿</option><option value="published">已发布</option></Select></Field>
            </div>
            {contentType === 'static' ? (
              <div className="border border-line bg-[var(--color-surface-subtle)] p-4" style={{ borderRadius: 6 }}>
                <input ref={siteInput} type="file" accept=".zip,application/zip" hidden onChange={(event) => void uploadSite(event.target.files?.[0])} />
                <p className="text-sm font-medium">{form.watch('staticSiteName') || '尚未上传静态站点'}</p>
                <p className="mt-1 text-xs text-muted">ZIP 根目录必须包含 index.html，预览将在系统浏览器打开。</p>
                {form.formState.errors.staticSiteKey ? <p className="mt-2 text-xs text-danger">{form.formState.errors.staticSiteKey.message}</p> : null}
                <Button className="mt-3" onClick={() => siteInput.current?.click()} disabled={siteUploading}><UploadCloud className="h-4 w-4" />{siteUploading ? '正在上传...' : '选择 ZIP'}</Button>
              </div>
            ) : <Field label="正文" error={form.formState.errors.content?.message}><Textarea rows={16} className="min-h-[360px] font-mono leading-6" {...form.register('content')} /></Field>}
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-blue-600" {...form.register('isLocked')} />需要访问密码</label>
              {isLocked ? <Field label="访问密码" error={form.formState.errors.accessPassword?.message} hint={article?.isLocked ? '留空表示保留原密码' : undefined}><Input type="password" autoComplete="new-password" {...form.register('accessPassword')} /></Field> : null}
            </div>
          </div>

          <aside className="min-w-0 border border-line bg-[var(--color-surface-subtle)]" style={{ borderRadius: 6 }}>
            <div className="border-b border-line px-4 py-3 text-sm font-medium">安全预览</div>
            <div className="scrollbar-thin h-[calc(100%-45px)] max-h-[680px] overflow-y-auto p-5">
              <h1 className="break-words text-2xl font-semibold">{form.watch('title') || '未命名文章'}</h1>
              {form.watch('summary') ? <p className="mt-3 text-sm leading-6 text-muted">{form.watch('summary')}</p> : null}
              {contentType === 'markdown' ? <div className="prose prose-sm mt-6 max-w-none break-words dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{form.watch('content') || '*开始输入正文后，这里会显示预览。*'}</ReactMarkdown></div> : <p className="mt-6 text-sm text-muted">静态前端内容不会在管理窗口中执行。</p>}
            </div>
          </aside>
        </form>
      </Dialog>
      <ConfirmDialog open={showCloseConfirm} title="关闭编辑器？" description="本地草稿已经自动保存，下次打开时可以继续编辑。" confirmLabel="关闭" onCancel={() => setShowCloseConfirm(false)} onConfirm={() => { setShowCloseConfirm(false); onClose() }} />
    </>
  )
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
