import { useEffect, useState } from 'react'
import { Download, FileSearch, Loader, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

const ACTION_LABELS = {
  login_success: '登录成功',
  login_failed: '登录失败',
  login_blocked: '登录锁定',
  save_article: '保存文章',
  delete_article: '删除文章',
  upload_article_image: '上传文章图片',
  save_project: '保存项目',
  delete_project: '删除项目',
  save_skill: '保存技能',
  delete_skill: '删除技能',
  save_theme: '保存主题',
  upload_background_image: '上传背景',
  delete_background_image: '删除背景',
  upload_avatar: '上传头像',
  upload_music: '上传音乐',
  delete_music: '删除音乐',
  upload_music_lyrics: '上传歌词',
  delete_music_lyrics: '删除歌词',
  change_live2d_model: '修改 Live2D',
  delete_live2d_model: '删除 Live2D',
  save_profile: '保存资料',
  change_password: '修改密码',
  save_upload_settings: '保存上传限制',
}

export default function StabilityManager() {
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchLogs()
  }, [])

  const authHeaders = () => token ? { Authorization: `Bearer ${token}` } : {}

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/admin/operation-logs?page=0&size=30', {
        headers: authHeaders(),
      })
      const data = res.ok ? await res.json() : { content: [] }
      setLogs(Array.isArray(data.content) ? data.content : [])
    } catch {
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/export', {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      link.href = url
      link.download = `personal-website-backup-${stamp}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      alert('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const runSearch = async (event) => {
    event?.preventDefault()
    const keyword = query.trim()
    if (!keyword) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(keyword)}`, {
        headers: authHeaders(),
      })
      const data = res.ok ? await res.json() : []
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
          <ShieldCheck className="h-7 w-7 text-indigo-600" />
          站点稳定性
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">查看后台操作、导出核心数据，并快速检索内容。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">数据备份 / 导出</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">导出文章、项目、主题、音乐、Live2D、个人资料等核心数据。</p>
            </div>
            <button
              type="button"
              onClick={exportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--theme-gradient)', boxShadow: 'var(--theme-shadow)' }}
            >
              {exporting ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              导出
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">后台全站搜索</h2>
          <form onSubmit={runSearch} className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文章、项目、技能"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-700"
            >
              {searching ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              搜索
            </button>
          </form>
          {results.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-slate-800 dark:border-slate-800">
              {results.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={item.url}
                  className="block bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  <div className="font-medium text-gray-900 dark:text-slate-100">{item.title}</div>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{typeLabel(item.type)} · {item.description || '无描述'}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">后台操作日志</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">记录登录、上传、删除、修改等关键操作。</p>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="mr-2 h-5 w-5 animate-spin" />
            加载日志中...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileSearch className="mb-2 h-10 w-10" />
            暂无操作日志
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">时间</th>
                  <th className="px-5 py-3">用户</th>
                  <th className="px-5 py-3">操作</th>
                  <th className="px-5 py-3">路径</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="text-gray-700 dark:text-slate-200">
                    <td className="whitespace-nowrap px-5 py-3">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-5 py-3">{log.username || '-'}</td>
                    <td className="px-5 py-3">{ACTION_LABELS[log.action] || log.action}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-gray-500 dark:text-slate-400">{log.path}</td>
                    <td className="px-5 py-3">{log.status}</td>
                    <td className="px-5 py-3">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function typeLabel(type) {
  if (type === 'article') return '文章'
  if (type === 'project') return '项目'
  if (type === 'skill') return '技能'
  return type
}
