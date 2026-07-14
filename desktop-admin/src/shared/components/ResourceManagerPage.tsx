import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { normalizePage, type PageResponse } from '@shared/api/pagination'
import { Button, ConfirmDialog, Dialog, EmptyState, ErrorNotice, Field, Input, LoadingState, PageHeader, Select, Textarea } from './ui'
import { useAuth } from '@features/auth/AuthContext'

export interface ResourceEntity { id: number; [key: string]: unknown }

export interface ResourceField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
}

export interface ResourceColumn {
  key: string
  label: string
  render?: (entity: ResourceEntity) => React.ReactNode
  className?: string
}

export function ResourceManagerPage({ resourceKey, title, description, endpoint, fields, columns, defaultValues, paginated = true }: {
  resourceKey: string
  title: string
  description: string
  endpoint: string
  fields: ResourceField[]
  columns: ResourceColumn[]
  defaultValues: Record<string, unknown>
  paginated?: boolean
}) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ResourceEntity | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<ResourceEntity | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>(defaultValues)
  const [formError, setFormError] = useState<unknown>(null)

  const list = useQuery({
    queryKey: [resourceKey, 'list'],
    queryFn: async () => {
      const path = paginated ? `${endpoint}?page=0&size=100` : endpoint
      return normalizePage(await api!.request<ResourceEntity[] | PageResponse<ResourceEntity>>(path), 0, 100)
    },
    enabled: Boolean(api),
  })

  const save = useMutation({
    mutationFn: async () => {
      validateRequired(fields, form)
      return api!.request<ResourceEntity>(editing ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing ? 'PUT' : 'POST',
        body: form,
      })
    },
    onSuccess: async () => {
      setEditing(undefined)
      setForm(defaultValues)
      await queryClient.invalidateQueries({ queryKey: [resourceKey] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: setFormError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api!.request(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null)
      await queryClient.invalidateQueries({ queryKey: [resourceKey] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const openCreate = () => { setForm({ ...defaultValues }); setFormError(null); setEditing(null) }
  const openEdit = (entity: ResourceEntity) => {
    const next = { ...defaultValues }
    for (const field of fields) next[field.key] = entity[field.key] ?? defaultValues[field.key]
    setForm(next)
    setFormError(null)
    setEditing(entity)
  }

  const dialogTitle = useMemo(() => editing ? `编辑${title.replace('管理', '')}` : `新建${title.replace('管理', '')}`, [editing, title])

  return (
    <div>
      <PageHeader title={title} description={description} actions={<><Button onClick={() => void list.refetch()}><RefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} />刷新</Button><Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />新建</Button></>} />
      <div className="panel overflow-hidden">
        {list.isPending ? <LoadingState /> : list.error ? <div className="p-4"><ErrorNotice error={list.error} onRetry={() => void list.refetch()} /></div> : !list.data?.content.length ? <EmptyState title={`还没有${title.replace('管理', '')}`} action={<Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />新建</Button>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[var(--color-surface-subtle)] text-xs text-muted"><tr>{columns.map((column) => <th key={column.key} className={`table-cell font-medium ${column.className || ''}`}>{column.label}</th>)}<th className="table-cell w-24 text-right font-medium">操作</th></tr></thead>
              <tbody>{list.data.content.map((entity) => <tr key={entity.id} className="hover:bg-[var(--color-surface-subtle)]">{columns.map((column) => <td key={column.key} className={`table-cell ${column.className || ''}`}>{column.render ? column.render(entity) : formatCell(entity[column.key])}</td>)}<td className="table-cell"><div className="flex justify-end gap-1"><Button variant="ghost" className="h-8 min-h-8 w-8 px-0" title="编辑" onClick={() => openEdit(entity)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" className="h-8 min-h-8 w-8 px-0 text-danger" title="删除" onClick={() => setDeleting(entity)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={editing !== undefined} title={dialogTitle} onClose={() => setEditing(undefined)} size="md" footer={<><Button onClick={() => setEditing(undefined)}>取消</Button><Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? '保存中...' : '保存'}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => <ResourceInput key={field.key} field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />)}
        </div>
        {formError ? <div className="mt-4"><ErrorNotice error={formError} /></div> : null}
      </Dialog>
      <ConfirmDialog open={Boolean(deleting)} title="确认删除？" description="该数据将从服务器永久删除，此操作不能撤销。" confirmLabel="删除" busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)} />
      {remove.error ? <div className="mt-4"><ErrorNotice error={remove.error} /></div> : null}
    </div>
  )
}

function ResourceInput({ field, value, onChange }: { field: ResourceField; value: unknown; onChange: (value: unknown) => void }) {
  const className = field.type === 'textarea' ? 'sm:col-span-2' : ''
  if (field.type === 'checkbox') return <label className={`flex min-h-10 items-center gap-2 self-end text-sm ${className}`}><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>
  if (field.type === 'textarea') return <Field label={field.label} className={className}><Textarea rows={4} required={field.required} placeholder={field.placeholder} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></Field>
  if (field.type === 'select') return <Field label={field.label}><Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
  return <Field label={field.label}><Input type={field.type === 'number' ? 'number' : 'text'} required={field.required} min={field.min} max={field.max} placeholder={field.placeholder} value={field.type === 'number' ? Number(value ?? 0) : String(value ?? '')} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} /></Field>
}

function validateRequired(fields: ResourceField[], form: Record<string, unknown>): void {
  const missing = fields.find((field) => field.required && !String(form[field.key] ?? '').trim())
  if (missing) throw new Error(`${missing.label}不能为空`)
}

function formatCell(value: unknown): React.ReactNode {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === null || value === undefined || value === '') return <span className="text-muted">-</span>
  return String(value)
}
