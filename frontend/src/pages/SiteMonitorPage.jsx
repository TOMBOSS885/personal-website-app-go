import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, RefreshCw, Users, Wifi } from 'lucide-react'
import LoadingIndicator from '../components/LoadingIndicator'
import { useLanguage } from '../contexts/LanguageContext'
import { fetchWithTimeout } from '../utils/network'
import {
  formatSiteMetric,
  formatTransferBytes,
  normalizeSiteMonitor,
} from '../utils/siteMonitor'

const EMPTY_STATS = normalizeSiteMonitor({})

const COPY = {
  zh: {
    title: '站点监控',
    subtitle: '查看本站累计访问情况与浏览器记录的站内传输流量。',
    views: '总访问量',
    visitors: '访问人数',
    traffic: '站点流量',
    viewsDetail: '通过安全去重后累计记录的页面访问次数。',
    visitorsDetail: '按浏览器识别的独立访客数量。',
    trafficDetail: '浏览器记录的同源资源实际传输字节估算。',
    loading: '正在读取监控数据',
    error: '监控数据暂时无法读取，请稍后重试。',
    refresh: '刷新监控数据',
    updated: '数据更新时间',
    estimated: '估算值',
  },
  en: {
    title: 'Site Monitor',
    subtitle: 'View cumulative visits and browser-observed same-origin transfer traffic.',
    views: 'Total views',
    visitors: 'Visitors',
    traffic: 'Site traffic',
    viewsDetail: 'Page visits recorded after secure deduplication.',
    visitorsDetail: 'Unique visitors identified by browser.',
    trafficDetail: 'Estimated bytes transferred for same-origin resources observed by browsers.',
    loading: 'Loading monitoring data',
    error: 'Monitoring data is temporarily unavailable. Please try again.',
    refresh: 'Refresh monitoring data',
    updated: 'Updated',
    estimated: 'Estimate',
  },
}

export default function SiteMonitorPage() {
  const { language } = useLanguage()
  const text = COPY[language] || COPY.zh
  const requestRef = useRef(null)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [hasData, setHasData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const loadStats = useCallback(async (showLoading = false) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (showLoading) setLoading(true)

    try {
      const response = await fetchWithTimeout('/api/public/site-monitor', {
        signal: controller.signal,
        credentials: 'same-origin',
        cache: showLoading ? 'no-cache' : 'default',
      }, 8000)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextStats = normalizeSiteMonitor(await response.json())
      if (controller.signal.aborted) return
      setStats(nextStats)
      setHasData(true)
      setError('')
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(text.error)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [text.error])

  useEffect(() => {
    loadStats(true)
    const timer = window.setInterval(() => {
      if (!document.hidden) loadStats(false)
    }, 60000)
    return () => {
      window.clearInterval(timer)
      requestRef.current?.abort()
    }
  }, [loadStats])

  const cards = useMemo(() => [
    {
      key: 'views',
      label: text.views,
      value: formatSiteMetric(stats.totalViews, language),
      detail: text.viewsDetail,
      icon: BarChart3,
      color: 'var(--theme-primary)',
    },
    {
      key: 'visitors',
      label: text.visitors,
      value: formatSiteMetric(stats.totalVisitors, language),
      detail: text.visitorsDetail,
      icon: Users,
      color: 'var(--theme-secondary)',
    },
    {
      key: 'traffic',
      label: text.traffic,
      value: formatTransferBytes(stats.estimatedTransferBytes, language),
      detail: text.trafficDetail,
      icon: Wifi,
      color: 'var(--theme-accent)',
      estimated: true,
    },
  ], [language, stats, text])
  const activeCard = cards[activeIndex] || cards[0]
  const ActiveIcon = activeCard.icon

  return (
    <div className="site-monitor-page relative min-h-screen pb-20 pt-24 sm:pt-28">
      <div className="mx-auto max-w-6xl px-4">
        <header className="site-monitor-header mb-5 flex items-start justify-between gap-5 sm:mb-7">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-lg sm:mb-4 sm:h-14 sm:w-14 sm:rounded-xl" style={{ background: 'var(--theme-gradient)' }}>
              <Activity className="h-7 w-7" />
            </div>
            <h1 className="page-title">{text.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-slate-300 sm:text-lg">{text.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => loadStats(true)}
            disabled={loading}
            className="theme-action-surface mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-gray-700 shadow-sm backdrop-blur-md transition hover:text-gray-950 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
            title={text.refresh}
            aria-label={text.refresh}
          >
            {loading ? <LoadingIndicator size={20} /> : <RefreshCw className="h-5 w-5" />}
          </button>
        </header>

        {error && (
          <div role="status" className="mb-6 border-y border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <section className="site-monitor-stage" aria-label={text.title}>
          <div className="site-monitor-orbit">
            <div className="site-monitor-ring" style={{ '--monitor-quantity': cards.length }}>
              {cards.map((card, index) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.key}
                    type="button"
                    className={`site-monitor-orbit-card ${activeIndex === index ? 'is-active' : ''}`}
                    style={{ '--monitor-index': index, '--monitor-card-color': card.color }}
                    onPointerEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`${card.label}: ${hasData ? card.value : text.loading}`}
                  >
                    <span className="site-monitor-orbit-card__shine" aria-hidden="true" />
                    <Icon className="site-monitor-orbit-card__icon" aria-hidden="true" />
                    <span className="site-monitor-orbit-card__label">{card.label}</span>
                    <span className="site-monitor-orbit-card__value">{hasData ? card.value : '--'}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="site-monitor-detail adaptive-surface card-glass" aria-live="polite">
            <span className="site-monitor-detail__icon" style={{ '--monitor-card-color': activeCard.color }}><ActiveIcon className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{activeCard.label}</h2>
                {activeCard.estimated && <span className="rounded-md border border-amber-300/60 bg-amber-50/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">{text.estimated}</span>}
              </div>
              <p className="site-monitor-detail__value">{hasData ? activeCard.value : '--'}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{activeCard.detail}</p>
              {stats.updatedAt && <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">{text.updated}: {formatDate(stats.updatedAt, language)}</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function formatDate(value, language) {
  try {
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return ''
  }
}
