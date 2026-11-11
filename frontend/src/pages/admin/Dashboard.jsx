import { useState, useEffect, useRef } from 'react'
import { FileText, Folder, Award, BarChart3, Download, Upload, TrendingUp, Sparkles, Database, RefreshCw, Cloud, Copy, Play, Save } from 'lucide-react'
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
  const [webdav, setWebdav] = useState(null)
  const [webdavForm, setWebdavForm] = useState({ enabled: false, endpointUrl: '', remotePath: 'personal-website', username: '', webdavPassword: '', backupPassword: '', scheduleMinutes: 1440, retentionCount: 7 })
  const [webdavNotice, setWebdavNotice] = useState('')
  const [webdavDiagnostic, setWebdavDiagnostic] = useState(null)
  const [webdavSaveState, setWebdavSaveState] = useState('idle')
  const [webdavProgress, setWebdavProgress] = useState({ active: false, percent: 0, label: '' })
  const [webdavBusy, setWebdavBusy] = useState(false)
  const [remoteBackups, setRemoteBackups] = useState([])
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

  useEffect(() => {
    if (webdav?.lastStatus !== 'running') return undefined
    const timer = window.setInterval(() => {
      fetch(`${API_BASE}/api/admin/webdav-backup/settings`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => { if (data) { setWebdav(data); if (data.lastStatus === 'running') setWebdavProgress({ active: true, percent: Number(data.progressPercent) || 0, label: data.progressStage || '自动备份执行中' }) } })
        .catch(() => {})
    }, 3000)
    setWebdavProgress(current => current.active ? current : { active: true, percent: 0, label: '自动备份执行中' })
    return () => window.clearInterval(timer)
  }, [webdav?.lastStatus])

  useEffect(() => {
    if (!webdavProgress.active || !webdavProgress.label.startsWith('自动备份')) return
    if (webdav?.lastStatus === 'success' || webdav?.lastStatus === 'error') {
      const success = webdav.lastStatus === 'success'
      setWebdavProgress({ active: true, percent: 100, label: success ? '自动备份保存成功' : '自动备份保存失败' })
      setWebdavNotice(success ? `自动备份保存成功：${webdav.lastRemoteName || '已上传'}` : `自动备份保存失败：${webdav.lastError || '请查看详细诊断'}`)
      const timer = window.setTimeout(() => setWebdavProgress(current => ({ ...current, active: false })), 1800)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [webdav?.lastStatus, webdav?.lastRemoteName, webdav?.lastError, webdavProgress.active, webdavProgress.label])

  const loadHealth = () => {
    setHealthLoading(true)
    fetch(`${API_BASE}/api/admin/health`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }

  useEffect(() => { loadHealth() }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/webdav-backup/settings`, { cache: 'no-store' })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || '读取 WebDAV 设置失败'); setWebdav(data); setWebdavForm(current => ({ ...current, enabled: Boolean(data.enabled), endpointUrl: data.endpointUrl || '', remotePath: data.remotePath || 'personal-website', username: data.username || '', scheduleMinutes: data.scheduleMinutes || 1440, retentionCount: data.retentionCount || 7 })) })
      .catch(error => setWebdavNotice(error.message || '读取 WebDAV 设置失败'))
  }, [])

  const updateWebdavForm = (key, value) => setWebdavForm(current => ({ ...current, [key]: value }))
  const saveWebdav = async () => {
    setWebdavBusy(true); setWebdavNotice(''); setWebdavSaveState('idle')
    try {
      const response = await fetch(`${API_BASE}/api/admin/webdav-backup/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(webdavForm) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || '保存 WebDAV 设置失败')
      setWebdav(data); setWebdavForm(current => ({ ...current, webdavPassword: '', backupPassword: '' })); setWebdavNotice('WebDAV 设置保存成功'); setWebdavSaveState('success')
    } catch (error) { setWebdavNotice(`WebDAV 设置保存失败：${error.message || '未知错误'}`); setWebdavSaveState('error') } finally { setWebdavBusy(false) }
  }
  const testWebdav = async () => {
    setWebdavBusy(true); setWebdavNotice('正在测试 WebDAV...'); setWebdavDiagnostic(null)
    try { const response = await fetch(`${API_BASE}/api/admin/webdav-backup/test`, { method: 'POST' }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.message || '连接失败'); error.diagnostics = data.details; throw error } setWebdavNotice(data.message || 'WebDAV 连接成功'); setWebdavDiagnostic(data.diagnostics || null) } catch (error) { setWebdavNotice(error.message || 'WebDAV 连接失败'); setWebdavDiagnostic(error.diagnostics || { phase: 'browser', httpStatus: 0, reason: error.message || '浏览器请求失败', hint: '检查站点网络、登录状态和浏览器开发者工具中的 Network 请求。' }) } finally { setWebdavBusy(false) }
  }
  const runWebdavBackup = async () => {
    setWebdavBusy(true); setWebdavNotice('正在生成并上传备份...'); setWebdavDiagnostic(null); setWebdavProgress({ active: true, percent: 1, label: '准备备份' });
    try { const response = await fetch(`${API_BASE}/api/admin/webdav-backup/run`, { method: 'POST' }); const result = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(result.message || 'WebDAV 备份失败'); error.diagnostics = result.details; throw error } setWebdavProgress({ active: true, percent: 100, label: '备份保存成功' }); setWebdavNotice(`备份保存成功：${result.remoteName || '已上传'}`); setWebdav(current => ({ ...(current || {}), lastStatus: 'success', lastRemoteName: result.remoteName || '', progressPercent: 100, progressStage: '保存成功' })); window.setTimeout(() => setWebdavProgress(current => ({ ...current, active: false })), 1200) } catch (error) { setWebdavProgress({ active: true, percent: 100, label: '备份保存失败' }); setWebdavNotice(`备份保存失败：${error.message || '未知错误'}`); setWebdavDiagnostic(error.diagnostics || { phase: 'upload', httpStatus: 0, reason: error.message || '上传失败', hint: '查看服务器 PHP error_log。' }); window.setTimeout(() => setWebdavProgress(current => ({ ...current, active: false })), 1800) } finally { setWebdavBusy(false) }
  }
  const listWebdavBackups = async () => {
    setWebdavBusy(true); setWebdavDiagnostic(null)
    try { const response = await fetch(`${API_BASE}/api/admin/webdav-backup/list`, { cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.message || '读取远程备份失败'); error.diagnostics = data.details; throw error } setRemoteBackups(Array.isArray(data.items) ? data.items : []); setWebdavNotice(`已读取 ${Array.isArray(data.items) ? data.items.length : 0} 个远程备份`) } catch (error) { setWebdavNotice(error.message || '读取远程备份失败'); setWebdavDiagnostic(error.diagnostics || { phase: 'list', httpStatus: 0, reason: error.message || '读取失败', hint: '检查远程目录读取权限。' }) } finally { setWebdavBusy(false) }
  }
  const restoreWebdavBackup = async name => {
    if (!window.confirm(`恢复 ${name} 会替换当前数据库和 uploads，确定继续吗？`)) return
    const password = window.prompt('请输入该备份密码'); if (!password) return
    setWebdavBusy(true); setWebdavNotice('正在下载并恢复远程备份...'); setWebdavDiagnostic(null)
    try { const response = await fetch(`${API_BASE}/api/admin/webdav-backup/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.message || '远程恢复失败'); error.diagnostics = data.details; throw error } setWebdavNotice('恢复成功，正在返回登录页...'); window.setTimeout(() => { window.location.href = `${adminBasePath}/login` }, 700) } catch (error) { setWebdavNotice(error.message || '远程恢复失败'); setWebdavDiagnostic(error.diagnostics || { phase: 'restore', httpStatus: 0, reason: error.message || '恢复失败', hint: '确认备份密码和远程文件读取权限。' }) } finally { setWebdavBusy(false) }
  }
  const copyCronToken = async () => { if (!webdav?.cronToken) return; try { await navigator.clipboard.writeText(webdav.cronToken); setWebdavNotice('Cron Token 已复制') } catch { setWebdavNotice('复制失败，请手动复制') } }

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

      <div className="mt-6 rounded-xl border border-sky-100 bg-white p-5 shadow-sm dark:border-sky-500/20 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100"><Cloud className="h-5 w-5 text-sky-500" />WebDAV 远程备份</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={testWebdav} disabled={webdavBusy || !webdav} className="inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-50"><Cloud className="h-4 w-4" />检测连接</button><button type="button" onClick={runWebdavBackup} disabled={webdavBusy || !webdav?.backupPasswordConfigured} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Play className="h-4 w-4" />立即备份</button><button type="button" onClick={listWebdavBackups} disabled={webdavBusy || !webdav} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">读取远程备份</button></div></div>
        {!webdav ? <p className="mt-4 text-sm text-gray-500">正在读取 WebDAV 设置...</p> : <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-600 dark:text-slate-300">WebDAV HTTPS 地址<input value={webdavForm.endpointUrl} onChange={event => updateWebdavForm('endpointUrl', event.target.value)} placeholder="https://dav.example.com" className="admin-input mt-1" /></label>
            <label className="text-sm text-gray-600 dark:text-slate-300">远程目录<input value={webdavForm.remotePath} onChange={event => updateWebdavForm('remotePath', event.target.value)} className="admin-input mt-1" /></label>
            <label className="text-sm text-gray-600 dark:text-slate-300">WebDAV 用户名<input value={webdavForm.username} onChange={event => updateWebdavForm('username', event.target.value)} className="admin-input mt-1" /></label>
            <label className="text-sm text-gray-600 dark:text-slate-300">WebDAV 密码<input type="password" value={webdavForm.webdavPassword} onChange={event => updateWebdavForm('webdavPassword', event.target.value)} placeholder={webdav.webdavPasswordConfigured ? '已配置，留空保持不变' : '请输入密码'} className="admin-input mt-1" /></label>
            <label className="text-sm text-gray-600 dark:text-slate-300">备份密码（恢复时输入）<input type="password" value={webdavForm.backupPassword} onChange={event => updateWebdavForm('backupPassword', event.target.value)} placeholder={webdav.backupPasswordConfigured ? '已配置，留空保持不变' : '至少 12 个字符'} className="admin-input mt-1" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm text-gray-600 dark:text-slate-300">间隔（分钟）<input type="number" min="5" max="10080" value={webdavForm.scheduleMinutes} onChange={event => updateWebdavForm('scheduleMinutes', event.target.value)} className="admin-input mt-1" /></label><label className="text-sm text-gray-600 dark:text-slate-300">保留份数<input type="number" min="1" max="100" value={webdavForm.retentionCount} onChange={event => updateWebdavForm('retentionCount', event.target.value)} className="admin-input mt-1" /></label></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200"><input type="checkbox" checked={webdavForm.enabled} onChange={event => updateWebdavForm('enabled', event.target.checked)} />启用自动备份</label><button type="button" onClick={saveWebdav} disabled={webdavBusy} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"><Save className="h-4 w-4" />保存设置</button></div>
          {webdavSaveState !== 'idle' && <p className={`mt-2 text-sm ${webdavSaveState === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} role="status">{webdavSaveState === 'success' ? '设置保存成功' : '设置保存失败，请查看提示信息'}</p>}
          {webdavProgress.active && <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-500/20 dark:bg-sky-500/10" role="status" aria-live="polite"><div className="flex items-center justify-between gap-3 text-sm text-sky-800 dark:text-sky-200"><span>{webdavProgress.label}</span><span>{webdavProgress.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-700"><div className={`h-full rounded-full bg-sky-500 transition-all duration-500 ${webdavProgress.percent < 100 ? 'animate-pulse' : ''}`} style={{ width: `${webdavProgress.percent}%` }} /></div></div>}
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-gray-500 dark:bg-slate-800/70 dark:text-slate-400"><p>状态：{webdav.lastStatus === 'success' ? '正常' : webdav.lastStatus === 'error' ? '最近一次失败' : '尚未执行'}{webdav.lastRunAt ? ` · ${webdav.lastRunAt}` : ''}{webdav.nextRunAt ? ` · 下次 ${webdav.nextRunAt}` : ''}</p>{webdav.lastError && <p className="mt-1 text-rose-500">最近错误：{webdav.lastError}</p>}<p className="mt-1">请在主机 Cron/Web Cron 中定期访问下面接口，频率由后台设置控制。</p>{webdav.cronToken && <div className="mt-2 flex flex-wrap items-center gap-2"><code className="break-all">/api/webdav-backup/cron?token={webdav.cronToken}</code><button type="button" onClick={copyCronToken} className="inline-flex items-center gap-1 text-sky-600 hover:underline"><Copy className="h-3.5 w-3.5" />复制 Token</button></div>}</div>
          {webdavNotice && <p className="mt-3 text-sm text-sky-600 dark:text-sky-300" role="status">{webdavNotice}</p>}
          {webdavDiagnostic && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert"><p className="font-semibold">详细诊断</p><dl className="mt-2 grid gap-1 sm:grid-cols-[120px_1fr]"><dt>操作</dt><dd>{webdavDiagnostic.operation || 'WebDAV'}</dd><dt>阶段</dt><dd>{webdavDiagnostic.phase || '未知'}</dd><dt>HTTP 状态</dt><dd>{webdavDiagnostic.httpStatus || '无 HTTP 响应'}</dd><dt>原因</dt><dd className="break-words">{webdavDiagnostic.reason || '未提供原因'}</dd><dt>建议</dt><dd className="break-words">{webdavDiagnostic.hint || '请查看服务器 PHP error_log。'}</dd></dl></div>}
          {remoteBackups.length > 0 && <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100 dark:border-slate-700"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-slate-800"><tr><th className="px-3 py-2">远程备份</th><th className="px-3 py-2 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-800">{remoteBackups.map(item => <tr key={item.name}><td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-slate-300">{item.name}</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => restoreWebdavBackup(item.name)} disabled={webdavBusy} className="text-amber-600 hover:underline disabled:opacity-50">输入密码并恢复</button></td></tr>)}</tbody></table></div>}
        </>}
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
