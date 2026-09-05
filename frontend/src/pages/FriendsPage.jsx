import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Check, Clipboard, ExternalLink, FolderKanban, Globe2, Link2, Mail, MessageCircle, MessageSquare, Send, User, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { fetchWithTimeout } from '../utils/network'
import { safeExternalHref } from '../utils/safeUrl'
import DropdownSelect from '../components/DropdownSelect'
import LoadingIndicator from '../components/LoadingIndicator'
import { guestMessageTargetUrl, messageIdFromHash, parseGuestbookTarget } from '../utils/guestMessageTarget'

const emptyMessage = { nickname: '', email: '', website: '', content: '', company: '', targetType: '', targetId: '' }

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function FriendAvatar({ friend }) {
  const [failed, setFailed] = useState(false)
  const avatar = safeExternalHref(friend.avatarUrl)
  if (!avatar || failed) {
    return <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xl font-bold text-white">{friend.name?.slice(0, 1) || '?'}</span>
  }
  return <img src={avatar} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-14 w-14 rounded-xl object-cover" />
}

function CopyField({ label, value, onCopy, copied }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/20 py-3 last:border-0 dark:border-slate-700/40">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 break-all text-sm font-medium text-gray-900 dark:text-slate-100">{value}</p>
      </div>
      <button type="button" onClick={() => onCopy(label, value)} className="theme-action-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/70 text-gray-600 transition hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300" title={`复制${label}`}>
        {copied === label ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      </button>
    </div>
  )
}

function GuestbookField({ children, icon: Icon, className = '', multiline = false }) {
  return (
    <span className={`guestbook-field ${multiline ? 'guestbook-field--multiline' : ''} ${className}`.trim()}>
      <span className="guestbook-field__underline" aria-hidden="true" />
      <span className="guestbook-field__ripple" aria-hidden="true" />
      <span className="guestbook-field__fade" aria-hidden="true" />
      <span className="guestbook-field__dots" aria-hidden="true"><span /><span /><span /><span /></span>
      {children}
      <span className="guestbook-field__icon" aria-hidden="true"><Icon className="h-5 w-5" /></span>
    </span>
  )
}

function GuestMessageCard({ message, focused = false }) {
  const website = safeExternalHref(message.website)
  const targetUrl = guestMessageTargetUrl(message.target)
  const TargetIcon = message.target?.type === 'article' ? BookOpen : FolderKanban
  return (
    <article
      id={`message-${message.id}`}
      tabIndex="-1"
      className={`guest-message-card stack-card-hover card-glass adaptive-surface scroll-mt-28 p-5 outline-none ${focused ? 'guest-message-card--focused' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 font-bold text-white">{message.nickname?.slice(0, 1) || '?'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">{message.nickname}</a> : message.nickname}</h3>
            <time className="text-xs text-gray-500 dark:text-slate-400">{formatDate(message.createdAt)}</time>
          </div>
          {targetUrl && <Link to={targetUrl} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border border-indigo-200/70 bg-indigo-50/80 px-3 py-1.5 text-xs font-medium text-indigo-800 transition hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-100 dark:hover:bg-indigo-500/20"><TargetIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">关联{message.target.type === 'article' ? '文章' : '项目'}：{message.target.title}</span></Link>}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 dark:text-slate-200">{message.content}</p>
        </div>
      </div>
    </article>
  )
}

export default function FriendsPage() {
  const location = useLocation()
  const guestbookRef = useRef(null)
  const [friends, setFriends] = useState([])
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [focusedMessage, setFocusedMessage] = useState(null)
  const [messageTargets, setMessageTargets] = useState({ articles: [], projects: [] })
  const [messagePage, setMessagePage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [copied, setCopied] = useState('')
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('guestbook-identity') || '{}')
      return { ...emptyMessage, nickname: saved.nickname || '', email: saved.email || '', website: saved.website || '' }
    } catch {
      return emptyMessage
    }
  })

  const loadMessages = async (page, signal) => {
    const response = await fetchWithTimeout(`/api/public/guest-messages?page=${page}&size=20`, { signal }, 8000)
    if (!response.ok) throw new Error('留言加载失败')
    const data = await response.json()
    setMessages(Array.isArray(data.content) ? data.content : [])
    setMessagePage(data.page || 0)
    setTotalPages(data.totalPages || 0)
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      fetchWithTimeout('/api/public/friends', { signal: controller.signal }, 8000).then(response => response.ok ? response.json() : []),
      fetchWithTimeout('/api/public/profile', { signal: controller.signal }, 8000).then(response => response.ok ? response.json() : null),
      fetchWithTimeout('/api/public/guest-message-targets', { signal: controller.signal }, 8000).then(response => response.ok ? response.json() : { articles: [], projects: [] }),
      loadMessages(0, controller.signal),
    ]).then(([friendList, profileData, targetData]) => {
      setFriends(Array.isArray(friendList) ? friendList : [])
      setProfile(profileData)
      setMessageTargets({
        articles: Array.isArray(targetData?.articles) ? targetData.articles : [],
        projects: Array.isArray(targetData?.projects) ? targetData.projects : [],
      })
    }).catch(error => {
      if (error.name !== 'AbortError') setNotice({ type: 'error', text: '页面数据暂时加载失败，请稍后重试。' })
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const preset = parseGuestbookTarget(location.search)
    if (!preset) return
    const options = preset.type === 'article' ? messageTargets.articles : messageTargets.projects
    if (!options.some(item => Number(item.id) === preset.id)) return
    setForm(current => ({ ...current, targetType: preset.type, targetId: String(preset.id) }))
  }, [location.search, messageTargets])

  useEffect(() => {
    const messageId = messageIdFromHash(location.hash)
    if (!messageId || loading) {
      if (!messageId) setFocusedMessage(null)
      return undefined
    }
    let cancelled = false
    const focusCard = () => window.setTimeout(() => {
      if (cancelled) return
      const element = document.getElementById(`message-${messageId}`)
      if (!element) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      element.focus({ preventScroll: true })
    }, 0)
    const existing = messages.find(message => Number(message.id) === messageId)
    if (existing) {
      setFocusedMessage(null)
      focusCard()
      return () => { cancelled = true }
    }
    fetchWithTimeout(`/api/public/guest-messages/${messageId}`, {}, 8000)
      .then(response => response.ok ? response.json() : null)
      .then(message => {
        if (cancelled || !message) return
        setFocusedMessage(message)
        focusCard()
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loading, location.hash, messages])

  useEffect(() => {
    if (loading || (location.pathname !== '/guestbook' && location.hash !== '#guestbook')) return
    guestbookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, location])

  const categories = useMemo(() => ['全部', ...new Set(friends.map(friend => friend.category).filter(Boolean))], [friends])
  const visibleFriends = selectedCategory === '全部' ? friends : friends.filter(friend => friend.category === selectedCategory)
  const visibleMessages = focusedMessage && !messages.some(message => Number(message.id) === Number(focusedMessage.id)) ? [focusedMessage, ...messages] : messages
  const siteUrl = safeExternalHref(profile?.website) || (typeof window !== 'undefined' ? window.location.origin : '')
  const siteAvatar = safeExternalHref(profile?.avatar)
  const siteDescription = profile?.bio || '欢迎来到我的个人网站。'

  const copyField = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1500)
    } catch {
      setNotice({ type: 'error', text: '复制失败，请手动选择文本。' })
    }
  }

  const submitMessage = async event => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setNotice({ type: '', text: '' })
    try {
      const response = await fetchWithTimeout('/api/public/guest-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }, 10000)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || '留言发送失败')
      localStorage.setItem('guestbook-identity', JSON.stringify({ nickname: form.nickname, email: form.email, website: form.website }))
      setMessages(current => [data, ...current].slice(0, 20))
      setForm(current => ({ ...current, content: '', company: '' }))
      setMessagePage(0)
      setNotice({ type: 'success', text: '留言已发布。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.name === 'AbortError' ? '请求超时，请稍后重试。' : error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const changeMessagePage = async nextPage => {
    if (nextPage < 0 || nextPage >= totalPages || nextPage === messagePage) return
    try {
      await loadMessages(nextPage)
      guestbookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setNotice({ type: 'error', text: '留言加载失败，请稍后重试。' })
    }
  }

  return (
    <div className="friends-page relative min-h-screen pb-20 pt-28">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-lg"><Users className="h-7 w-7" /></div>
          <h1 className="page-title">友链与留言</h1>
          <p className="mt-5 text-lg text-gray-600 dark:text-slate-300">认识彼此的网站，也欢迎在这里留下你的想法。</p>
        </header>

        <section aria-labelledby="friends-heading" className="mb-16">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><h2 id="friends-heading" className="text-2xl font-bold text-gray-900 dark:text-slate-100">朋友们</h2><p className="mt-1 text-gray-600 dark:text-slate-400">点击卡片访问对方站点</p></div>
            {categories.length > 2 && <div className="flex flex-wrap gap-2" aria-label="友链分类">{categories.map(category => <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${selectedCategory === category ? 'text-white shadow-md' : 'theme-action-surface border border-white/60 bg-white/65 text-gray-700 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200'}`} style={selectedCategory === category ? { background: 'var(--theme-gradient)' } : {}}>{category}</button>)}</div>}
          </div>
          {loading ? <div className="flex min-h-36 items-center justify-center text-indigo-600 dark:text-indigo-300"><LoadingIndicator size={32} label="加载友链" /></div> : visibleFriends.length === 0 ? <div className="adaptive-surface border-y border-white/40 py-12 text-center text-gray-500 dark:border-slate-700/50 dark:text-slate-400">暂无友链，可在后台添加第一位朋友。</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleFriends.map((friend, index) => {
            const href = safeExternalHref(friend.url)
            return <motion.a key={friend.id} href={href || undefined} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.24) }} className="stack-card-hover card-glass adaptive-surface group flex min-h-32 items-center gap-4 p-5"><FriendAvatar friend={friend} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-bold text-gray-900 dark:text-slate-100">{friend.name}</h3><ExternalLink className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-indigo-500" /></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{friend.description || '去看看这个网站'}</p>{friend.category && <span className="mt-3 inline-flex rounded-md border border-indigo-200/60 bg-indigo-50/70 px-2 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200">{friend.category}</span>}</div></motion.a>
          })}</div>}
        </section>
      </div>

      <section className="adaptive-surface mb-16 border-y border-white/50 bg-white/55 py-12 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/55">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_1.1fr]">
          <div><div className="mb-5 flex items-center gap-3"><Link2 className="h-6 w-6 text-indigo-500" /><h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">本站友链信息</h2></div><CopyField label="站点名称" value={profile?.nickname || '个人网站'} onCopy={copyField} copied={copied} /><CopyField label="站点描述" value={siteDescription} onCopy={copyField} copied={copied} /><CopyField label="站点链接" value={siteUrl} onCopy={copyField} copied={copied} /><CopyField label="头像链接" value={siteAvatar} onCopy={copyField} copied={copied} /></div>
          <div><h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">申请友链</h2><ol className="mt-6 space-y-5">{[['1', '先添加本站', '请先将左侧的本站信息加入你的友链页面。'], ['2', '提交你的信息', '在下方留言中写明站点名称、描述、链接和头像链接。'], ['3', '等待确认', '确认站点可以正常访问且内容合规后，会在后台添加。']].map(item => <li key={item[0]} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{item[0]}</span><div><h3 className="font-semibold text-gray-900 dark:text-slate-100">{item[1]}</h3><p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-300">{item[2]}</p></div></li>)}</ol></div>
        </div>
      </section>

      <section id="guestbook" ref={guestbookRef} aria-labelledby="guestbook-heading" className="mx-auto max-w-6xl scroll-mt-24 px-4">
        <div className="mb-7"><div className="flex items-center gap-3"><MessageCircle className="h-6 w-6 text-emerald-500" /><h2 id="guestbook-heading" className="text-2xl font-bold text-gray-900 dark:text-slate-100">留言区</h2></div></div>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={submitMessage} className="card-glass adaptive-surface self-start p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                昵称<span className="text-red-500"> *</span>
                <GuestbookField icon={User} className="mt-2">
                  <input required maxLength={40} autoComplete="nickname" placeholder="怎么称呼你" value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} className="guestbook-field__control" />
                </GuestbookField>
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                邮箱
                <GuestbookField icon={Mail} className="mt-2">
                  <input type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="guestbook-field__control" />
                </GuestbookField>
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-slate-200">
              个人网站
              <GuestbookField icon={Globe2} className="mt-2">
                <input type="url" maxLength={500} placeholder="https://" autoComplete="url" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} className="guestbook-field__control" />
              </GuestbookField>
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-slate-200">
              关联内容
              <GuestbookField icon={Link2} className="mt-2">
                <DropdownSelect
                  value={form.targetType && form.targetId ? `${form.targetType}:${form.targetId}` : ''}
                  onChange={event => {
                    const [targetType = '', targetId = ''] = event.target.value.split(':')
                    setForm({ ...form, targetType, targetId })
                  }}
                  className="guestbook-field__control appearance-none"
                  options={[{ value: '', label: '不关联文章或项目' }, ...messageTargets.articles.map(item => ({ value: `article:${item.id}`, label: `文章：${item.title}` })), ...messageTargets.projects.map(item => ({ value: `project:${item.id}`, label: `项目：${item.title}` }))]}
                />
              </GuestbookField>
              <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">选择后，这条留言会显示在对应内容中</span>
            </label>
            <label className="sr-only" aria-hidden="true">公司<input tabIndex="-1" autoComplete="off" value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} /></label>
            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-slate-200">
              留言<span className="text-red-500"> *</span>
              <GuestbookField icon={MessageSquare} className="mt-2" multiline>
                <textarea required maxLength={1000} rows={7} placeholder="写下想说的话..." value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} className="guestbook-field__control resize-y" />
              </GuestbookField>
            </label>
            <div className="mt-2 flex justify-end text-xs text-gray-500 dark:text-slate-400">{form.content.length}/1000</div>
            {notice.text && <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'}`}>{notice.text}</div>}
            <button type="submit" disabled={submitting} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: 'var(--theme-gradient)' }}>{submitting ? <LoadingIndicator size={20} /> : <Send className="h-5 w-5" />}{submitting ? '发送中...' : '发送留言'}</button>
          </form>

          <div className="space-y-4">{visibleMessages.length === 0 ? <div className="adaptive-surface border-y border-white/40 py-12 text-center text-gray-500 dark:border-slate-700/50 dark:text-slate-400">还没有留言，来写下第一条吧。</div> : visibleMessages.map(message => <GuestMessageCard key={message.id} message={message} focused={messageIdFromHash(location.hash) === Number(message.id)} />)}{totalPages > 1 && <div className="flex items-center justify-between pt-3"><button type="button" disabled={messagePage <= 0} onClick={() => changeMessagePage(messagePage - 1)} className="theme-action-surface rounded-lg border border-white/60 bg-white/65 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">上一页</button><span className="text-sm text-gray-600 dark:text-slate-300">{messagePage + 1} / {totalPages}</span><button type="button" disabled={messagePage + 1 >= totalPages} onClick={() => changeMessagePage(messagePage + 1)} className="theme-action-surface rounded-lg border border-white/60 bg-white/65 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">下一页</button></div>}</div>
        </div>
      </section>
    </div>
  )
}
