import { StatusBadge } from '@shared/components/ui'
import { ResourceManagerPage, type ResourceEntity } from '@shared/components/ResourceManagerPage'

export function ProjectsPage() {
  return <ResourceManagerPage
    resourceKey="projects"
    title="项目管理"
    description="维护公开站点展示的作品、技术栈与链接"
    endpoint="/api/admin/projects"
    defaultValues={{ name: '', description: '', coverImage: '', techStack: '', githubUrl: '', demoUrl: '', stars: 0, featured: false, displayOrder: 0 }}
    fields={[
      { key: 'name', label: '项目名称', required: true },
      { key: 'techStack', label: '技术栈', placeholder: 'Go, React, MySQL' },
      { key: 'description', label: '项目说明', type: 'textarea' },
      { key: 'coverImage', label: '封面地址' },
      { key: 'githubUrl', label: 'GitHub 地址' },
      { key: 'demoUrl', label: '演示地址' },
      { key: 'stars', label: 'Stars', type: 'number', min: 0 },
      { key: 'displayOrder', label: '排序', type: 'number' },
      { key: 'featured', label: '设为精选', type: 'checkbox' },
    ]}
    columns={[
      { key: 'name', label: '项目', render: (item) => <div><p className="font-medium">{String(item.name)}</p><p className="mt-1 max-w-xl truncate text-xs text-muted">{String(item.description || '无说明')}</p></div> },
      { key: 'techStack', label: '技术栈' },
      { key: 'featured', label: '展示', render: (item) => <StatusBadge tone={item.featured ? 'success' : 'neutral'}>{item.featured ? '精选' : '普通'}</StatusBadge> },
      { key: 'displayOrder', label: '排序', className: 'w-24' },
    ]}
  />
}

export function SkillsPage() {
  return <ResourceManagerPage
    resourceKey="skills"
    title="技能管理"
    description="维护技能分类、熟练度和显示顺序"
    endpoint="/api/admin/skills"
    defaultValues={{ name: '', category: '', proficiency: 80, icon: '', displayOrder: 0 }}
    fields={[
      { key: 'name', label: '技能名称', required: true },
      { key: 'category', label: '分类' },
      { key: 'proficiency', label: '熟练度', type: 'number', min: 0, max: 100 },
      { key: 'icon', label: '图标地址' },
      { key: 'displayOrder', label: '排序', type: 'number' },
    ]}
    columns={[
      { key: 'name', label: '技能', render: (item) => <span className="font-medium">{String(item.name)}</span> },
      { key: 'category', label: '分类' },
      { key: 'proficiency', label: '熟练度', render: proficiencyCell },
      { key: 'displayOrder', label: '排序', className: 'w-24' },
    ]}
  />
}

export function FeatureCardsPage() {
  return <ResourceManagerPage
    resourceKey="feature-cards"
    title="能力卡片管理"
    description="配置首页能力卡片的中英文内容和显示状态"
    endpoint="/api/admin/feature-cards"
    paginated={false}
    defaultValues={{ title: '', titleEn: '', description: '', descriptionEn: '', icon: 'Code', gradient: 'from-blue-500 to-cyan-500', displayOrder: 0, enabled: true }}
    fields={[
      { key: 'title', label: '中文标题', required: true },
      { key: 'titleEn', label: '英文标题' },
      { key: 'description', label: '中文说明', type: 'textarea' },
      { key: 'descriptionEn', label: '英文说明', type: 'textarea' },
      { key: 'icon', label: 'Lucide 图标名' },
      { key: 'gradient', label: '渐变类名' },
      { key: 'displayOrder', label: '排序', type: 'number' },
      { key: 'enabled', label: '启用卡片', type: 'checkbox' },
    ]}
    columns={[
      { key: 'title', label: '卡片', render: (item) => <div><p className="font-medium">{String(item.title)}</p><p className="mt-1 max-w-xl truncate text-xs text-muted">{String(item.description || '无说明')}</p></div> },
      { key: 'icon', label: '图标' },
      { key: 'enabled', label: '状态', render: (item) => <StatusBadge tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? '启用' : '停用'}</StatusBadge> },
      { key: 'displayOrder', label: '排序', className: 'w-24' },
    ]}
  />
}

function proficiencyCell(item: ResourceEntity) {
  const value = Math.max(0, Math.min(100, Number(item.proficiency) || 0))
  return <div className="flex items-center gap-3"><div className="h-1.5 w-28 overflow-hidden bg-gray-200 dark:bg-gray-700" style={{ borderRadius: 999 }}><div className="h-full bg-primary" style={{ width: `${value}%` }} /></div><span className="w-10 tabular-nums text-muted">{value}%</span></div>
}
