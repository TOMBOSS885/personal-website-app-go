import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, RefreshCw, UploadCloud } from 'lucide-react'
import { normalizePage, type PageResponse } from '@shared/api/pagination'
import { resolveAssetUrl } from '@shared/api/client'
import { Button, EmptyState, ErrorNotice, LoadingState, PageHeader } from '@shared/components/ui'
import { useAuth } from '@features/auth/AuthContext'

interface ImageAsset { name: string; url: string; size: number }

export function ImagesPage() {
  const { api, profile } = useAuth()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const images = useQuery({ queryKey: ['assets', 'images'], queryFn: async () => normalizePage(await api!.request<ImageAsset[] | PageResponse<ImageAsset>>('/api/admin/article-images?page=0&size=100'), 0, 100), enabled: Boolean(api) })
  const upload = useMutation({
    mutationFn: async (file: File) => { const body = new FormData(); body.append('file', file); return api!.request<ImageAsset>('/api/admin/article-images', { method: 'POST', body, timeoutMs: 120_000 }) },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['assets', 'images'] }) },
  })

  return (
    <div>
      <PageHeader title="图片资源" description="管理文章封面与正文图片" actions={<><Button onClick={() => void images.refetch()}><RefreshCw className={`h-4 w-4 ${images.isFetching ? 'animate-spin' : ''}`} />刷新</Button><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><Button variant="primary" onClick={() => input.current?.click()} disabled={upload.isPending}><UploadCloud className="h-4 w-4" />{upload.isPending ? '上传中...' : '上传图片'}</Button></>} />
      {upload.error ? <div className="mb-4"><ErrorNotice error={upload.error} /></div> : null}
      <div className="panel overflow-hidden p-4">
        {images.isPending ? <LoadingState /> : images.error ? <ErrorNotice error={images.error} onRetry={() => void images.refetch()} /> : !images.data?.content.length ? <EmptyState title="还没有图片" description="上传图片后可在文章编辑器中作为封面使用。" action={<Button variant="primary" onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" />上传图片</Button>} /> : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-6">
            {images.data.content.map((image) => <article key={`${image.url}-${image.name}`} className="overflow-hidden border border-line bg-surface" style={{ borderRadius: 6 }}><div className="aspect-[4/3] bg-[var(--color-surface-subtle)]">{profile ? <img src={resolveAssetUrl(profile.origin, image.url)} alt={image.name} className="h-full w-full object-cover" loading="lazy" /> : null}</div><div className="p-2"><p className="truncate text-xs font-medium" title={image.name}>{image.name}</p><p className="mt-1 text-[11px] text-muted">{formatBytes(image.size)}</p></div></article>)}
          </div>
        )}
      </div>
    </div>
  )
}

function formatBytes(value: number): string {
  if (!value) return '-'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
