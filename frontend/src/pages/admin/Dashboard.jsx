import { useState, useEffect, useRef } from 'react'
import { FileText, Folder, Award, BarChart3, Download, Upload, TrendingUp, Sparkles, Database, RefreshCw } from 'lucide-react'
import { getAdminBasePath } from '../../utils/adminEntry'

const API_BASE = ''

export default function Dashboard() {
  const adminBasePath = getAdminBasePath()
  const [stats, setStats] = useState({ articles: 0, projects: 0, skills: 0, visits: 0 })
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [backupNotice, setBackupNotice] = useState('')
  const backupFileRef = useRef(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/dashboard-stats`)
      .then(r => r.json())
      .then(data => {
        setStats({
          articles: data?.articleCount || 0,
          projects: data?.projectCount || 0,
          skills: data?.skillCount || 0,
          visits: data?.totalVisits || 0
        })
      })
      .catch(err => console.error('获取统计失败:', err))
      .finally(() => setLoading(false))
  }, [])

  const loadHealth = () => {
    setHealthLoading(true)
    fetch(`${API_BASE}/api/admin/health`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }

  useEffect(() => { loadHealth() }, [])

  const downloadBackup = async () => {
    const password = window.prompt('请设置备份密码（至少 12 个字符，恢复时必须使用相同密码）')
    if (!password) return
    if (password.length < 12) { setBackupNotice('备份密码至少需要 12 个字符'); return }
    setBackupLoading(true)
    setBackupNotice('')
    try {
      const response = await fetch(`${API_BASE}/api/admin/backup-export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || '备份生成失败')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `personal-website-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      link.click()
      URL.revokeObjectURL(url)
      setBackupNotice('完整备份已下载，请安全保存备份密码')
    } catch (error) {
      setBackupNotice(error.message || '备份生成失败')
    } finally {
      setBackupLoading(false)
    }
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('导入会替换当前数据库和 uploads 文件，确定继续吗？')) return
    const password = window.prompt('请输入备份密码')
    if (!password) return
    setRestoreLoading(true)
    setBackupNotice('')
    try {
      const form = new FormData()
      form.append('backup', file)
      form.append('password', password)
      const response = await fetch(`${API_BASE}/api/admin/backup-import`, { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '备份恢复失败')
      setBackupNotice('恢复成功，正在返回登录页面...')
      window.setTimeout(() => { window.location.href = `${adminBasePath}/login` }, 700)
    } catch (error) {
      setBackupNotice(error.message || '备份恢复失败')
    } finally {
      setRestoreLoading(false)
    }
  }

  const cards = [
    { label: '文章总数', value: stats.articles, icon: FileText, color: 'blue', bg: 'from-blue-500 to-cyan-500' },
    { label: '项目总数', value: stats.projects, icon: Folder, color: 'green', bg: 'from-green-500 to-emerald-500' },
    { label: '专业技能', value: stats.skills, icon: Award, color: 'purple', bg: 'from-purple-500 to-pink-500' },
    { label: '网站访问次数', value: stats.visits, icon: BarChart3, color: 'orange', bg: 'from-orange-500 to-red-500' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-7 h-7" style={{ color: 'var(--theme-primary)' }} />
          概览
        </h1>
        <p className="text-gray-500 text-sm mt-1">查看网站整体数据概况</p>
      </div>

      <div className="grid md:grid-cols-4 gap-5">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stack-card-hover bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className={`h-1.5 rounded-t-xl bg-gradient-to-r ${bg}`} />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '-' : value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100"><Database className="h-5 w-5 text-emerald-500" />站点健康与备份</h2><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={downloadBackup} disabled={backupLoading || restoreLoading} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"><Download className="h-4 w-4" />{backupLoading ? '打包中...' : '导出完整备份'}</button><button type="button" onClick={() => backupFileRef.current?.click()} disabled={backupLoading || restoreLoading} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10"><Upload className="h-4 w-4" />{restoreLoading ? '恢复中...' : '导入完整备份'}</button><input ref={backupFileRef} type="file" accept=".zip,application/zip" onChange={importBackup} className="hidden" /><button type="button" onClick={loadHealth} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw className={`h-4 w-4 ${healthLoading ? 'animate-spin' : ''}`} />刷新</button></div></div>
        {health?.manifest ? <div className="mt-4 grid gap-3 text-sm text-gray-600 dark:text-slate-300 sm:grid-cols-3"><div><span className="block text-xs text-gray-400">数据库结构</span><strong className="text-gray-900 dark:text-slate-100">schema {health.schema}</strong></div><div><span className="block text-xs text-gray-400">上传目录</span><strong className="text-gray-900 dark:text-slate-100">{formatBytes(health.manifest.uploadBytes)} · {health.manifest.uploadFiles?.length ?? 0} 个文件</strong></div><div><span className="block text-xs text-gray-400">文章 / 留言</span><strong className="text-gray-900 dark:text-slate-100">{health.manifest.tables?.articles ?? '-'} / {health.manifest.tables?.guest_messages ?? '-'}</strong></div></div> : <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">{healthLoading ? '正在检查数据库和上传目录...' : '健康检查暂时不可用，请确认已导入迁移。'}</p>}
        <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">完整备份包含数据库结构与全部数据、账号与日志、OAuth/SMTP 配置、思维导图及 uploads 文件；导入时会覆盖当前数据库和 uploads。操作日志最多保留最近 200000 条。</p>
        {backupNotice && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300" role="status">{backupNotice}</p>}
      </div>

      <div 
        className="mt-8 p-6 rounded-xl shadow-lg"
        style={{ background: 'var(--theme-gradient)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp className="w-6 h-6 text-white" />
          <h2 className="text-lg font-semibold text-white">欢迎使用管理后台</h2>
        </div>
        <p className="text-white/80">
          在这里你可以管理文章、项目、首页能力卡片、专业技能和个人信息。使用左侧导航栏切换不同的管理模块。
        </p>
        <div className="mt-4 flex gap-3">
          <a href={`${adminBasePath}/articles`} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors">
            管理文章
          </a>
          <a href={`${adminBasePath}/projects`} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors">
            管理项目
          </a>
          <a href={`${adminBasePath}/feature-cards`} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors">
            管理能力卡片
          </a>
          <a href={`${adminBasePath}/skills`} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors">
            管理专业技能
          </a>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div className="stack-card-hover bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            快速操作
          </h3>
          <div className="space-y-3">
            <a href={`${adminBasePath}/articles`} className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-gray-700">📝 新建文章</span>
            </a>
            <a href={`${adminBasePath}/projects`} className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-gray-700">📁 新建项目</span>
            </a>
            <a href={`${adminBasePath}/feature-cards`} className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-gray-700">管理能力卡片</span>
            </a>
            <a href={`${adminBasePath}/skills`} className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-gray-700">⚡ 添加专业技能</span>
            </a>
          </div>
        </div>

        <div className="stack-card-hover bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            提示
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• 文章支持 Markdown 格式编写</p>
            <p>• 精选项目会在首页优先展示</p>
            <p>• 能力卡片对应首页“我能做什么”模块</p>
            <p>• 专业技能熟练度用于首页进度条展示</p>
            <p>• 个人信息会显示在网站各处</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
