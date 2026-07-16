import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FileText, Loader, Move, Music, Pause, Play, Settings, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useUserAuth } from '../contexts/UserAuthContext'

const DEFAULT_TOP = 96
const PLAYER_HEIGHT = 56
const COLLAPSED_WIDTH = 56
const EDGE_GAP_MOBILE = 16
const EDGE_GAP_DESKTOP = 24
const DRAG_THRESHOLD = 6
const COLLAPSE_DELAY = 3000
const PLAYLIST_REFRESH_INTERVAL = 45000
const LYRICS_SETTINGS_KEY = 'music-lyrics-module-settings'
const LYRICS_MIN_WIDTH_DESKTOP = 280
const LYRICS_MIN_WIDTH_MOBILE = 240
const LYRICS_MAX_WIDTH = 680
const LYRICS_MIN_HEIGHT = 150
const LYRICS_MAX_HEIGHT = 520
const DEFAULT_LYRICS_SETTINGS = {
  enabled: true,
  effect: 'pop',
  fontSize: 16,
  opacity: 88,
  lineCount: 3,
  width: 360,
  height: 176,
  primaryLyricLine: 'first',
  showTranslation: true,
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

function edgeGap() {
  if (typeof window === 'undefined') return EDGE_GAP_MOBILE
  return window.innerWidth >= 640 ? EDGE_GAP_DESKTOP : EDGE_GAP_MOBILE
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, input, select, textarea, a, label, [data-drag-ignore="true"]'))
}

function isPlayableSong(song) {
  return song?.isPublic !== false
}

export default function MusicPlayer() {
	const { user, loading: authLoading, openLogin, authFetch } = useUserAuth()
  const audioRef = useRef(null)
  const rootRef = useRef(null)
  const playerRef = useRef(null)
  const dragRef = useRef(null)
  const dragPointRef = useRef(null)
  const dragFrameRef = useRef(null)
  const collapseTimerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const songsRef = useRef([])
  const playlistFetchedAtRef = useRef(0)
  const playlistRefreshPromiseRef = useRef(null)
  const userRef = useRef(user)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [playlistError, setPlaylistError] = useState('')
  const [open, setOpen] = useState(false)
  const [currentSong, setCurrentSong] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [dockSide, setDockSide] = useState('right')
  const [dockTop, setDockTop] = useState(DEFAULT_TOP)
  const [dragging, setDragging] = useState(false)
  const [dragPoint, setDragPoint] = useState(null)
  const [idleCollapsed, setIdleCollapsed] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [lyricsLines, setLyricsLines] = useState([])
  const [lyricsStatus, setLyricsStatus] = useState('none')
  const [lyricsSettings, setLyricsSettings] = useState(() => readLyricsSettings())

  const setPublicSongs = useCallback((list) => {
    songsRef.current = list
    setSongs(list)
    setLoaded(true)
    playlistFetchedAtRef.current = Date.now()
		setPlaylistError('')
  }, [])

  const getCachedPublicSongs = useCallback(() => songsRef.current.filter(isPlayableSong), [])

  const isPlaylistFresh = useCallback(() => (
    Date.now() - playlistFetchedAtRef.current < PLAYLIST_REFRESH_INTERVAL
  ), [])

  const loadPublicSongs = useCallback(async ({ force = false } = {}) => {
    if (!user) return []
    const cached = getCachedPublicSongs()
    if (!force && playlistFetchedAtRef.current > 0 && isPlaylistFresh()) {
      return cached
    }
    if (playlistRefreshPromiseRef.current) {
      return playlistRefreshPromiseRef.current
    }

		const controller = new AbortController()
		const timeout = window.setTimeout(() => controller.abort(), 6000)
		playlistRefreshPromiseRef.current = authFetch('/api/public/music', { signal: controller.signal, clearSessionOnUnauthorized: true })
			.then(async res => {
				if (!res.ok) {
					throw new Error(res.status === 401 || res.status === 403 ? '登录状态已失效' : '歌曲加载失败，请稍后重试')
				}
				const data = await res.json()
				const list = Array.isArray(data) ? data.filter(isPlayableSong) : []
				if (!userRef.current) return []
				setPublicSongs(list)
				return list
			})
			.finally(() => {
				window.clearTimeout(timeout)
				playlistRefreshPromiseRef.current = null
			})

    return playlistRefreshPromiseRef.current
	}, [authFetch, getCachedPublicSongs, isPlaylistFresh, setPublicSongs, user])

	useEffect(() => {
		userRef.current = user
	}, [user])

  useEffect(() => {
    if (user) return
    setSongs([])
    setLoaded(false)
    setCurrentSong(null)
    setPlaying(false)
		setCurrentTime(0)
		setPlaylistError('')
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
  }, [user])

  useEffect(() => {
    songsRef.current = songs
  }, [songs])

  useEffect(() => {
    if (!currentSong) return
    const stillPublic = isPlayableSong(currentSong)
      && (!loaded || songs.some(song => song.id === currentSong.id))
    if (stillPublic) return
    setCurrentSong(null)
    setPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [currentSong, loaded, songs])

  const fetchSongs = useCallback(async () => {
    if ((loaded || loading) && isPlaylistFresh()) return getCachedPublicSongs()
    setLoading(true)
    try {
      return await loadPublicSongs()
		} catch (error) {
			if (userRef.current) setPlaylistError(error.message || '歌曲加载失败，请稍后重试')
			return []
    } finally {
      setLoading(false)
    }
  }, [getCachedPublicSongs, isPlaylistFresh, loadPublicSongs, loaded, loading])

  useEffect(() => {
    if (!currentSong || !audioRef.current) return
    audioRef.current.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [currentSong])

  useEffect(() => {
    if (!currentSong?.lyricsUrl) {
      setLyricsLines([])
      setLyricsStatus(currentSong ? 'missing' : 'none')
      return undefined
    }

    const controller = new AbortController()
    setLyricsStatus('loading')
    setLyricsLines([])
    fetch(currentSong.lyricsUrl, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        return decodeLyricsBuffer(buffer)
      })
      .then(text => {
        const lines = parseLrc(text)
        setLyricsLines(lines)
        setLyricsStatus(lines.length > 0 ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLyricsLines([])
          setLyricsStatus('error')
        }
      })
    return () => controller.abort()
  }, [currentSong?.id, currentSong?.lyricsUrl])

  useEffect(() => {
    const keepInViewport = () => {
      const gap = edgeGap()
      setDockTop(value => clamp(value, gap, window.innerHeight - PLAYER_HEIGHT - gap))
    }

    window.addEventListener('resize', keepInViewport)
    return () => window.removeEventListener('resize', keepInViewport)
  }, [])

  useEffect(() => {
    return () => {
      removeDragListeners()
      cancelDragPaint()
      clearCollapseTimer()
    }
  }, [])

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer()
    if (!currentSong || dragging) return
    collapseTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setIdleCollapsed(true)
    }, COLLAPSE_DELAY)
  }, [currentSong, dragging])

  const wakePlayer = useCallback(() => {
    clearCollapseTimer()
    if (currentSong) setIdleCollapsed(false)
  }, [currentSong])

  const markPlayerActivity = useCallback(() => {
    wakePlayer()
    window.setTimeout(scheduleCollapse, 0)
  }, [scheduleCollapse, wakePlayer])

  useEffect(() => {
    if (!currentSong || dragging) {
      clearCollapseTimer()
      setIdleCollapsed(false)
      return
    }
    setIdleCollapsed(false)
    scheduleCollapse()
  }, [currentSong, playing, dragging, scheduleCollapse])

  const beginDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    wakePlayer()
    const rect = playerRef.current?.getBoundingClientRect()
    if (!rect) return

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    }
    window.addEventListener('pointermove', moveDrag)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', cancelDrag)
  }

  const removeDragListeners = () => {
    window.removeEventListener('pointermove', moveDrag)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', cancelDrag)
  }

  const paintDragPoint = (point) => {
    const root = rootRef.current
    if (!root) return
    root.style.left = `${point.x}px`
    root.style.top = `${point.y}px`
    root.style.right = 'auto'
  }

  const scheduleDragPaint = (point) => {
    dragPointRef.current = point
    if (dragFrameRef.current) return
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null
      if (dragPointRef.current) paintDragPoint(dragPointRef.current)
    })
  }

  const cancelDragPaint = () => {
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    if (!drag) return

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (!drag.started && distance < DRAG_THRESHOLD) return

    event.preventDefault()
    if (!drag.started) {
      drag.started = true
      suppressClickRef.current = true
      setDragging(true)
      setOpen(false)
    }

    const gap = edgeGap()
    const x = clamp(event.clientX - COLLAPSED_WIDTH / 2, gap, window.innerWidth - COLLAPSED_WIDTH - gap)
    const y = clamp(event.clientY - PLAYER_HEIGHT / 2, gap, window.innerHeight - PLAYER_HEIGHT - gap)
    const point = { x, y }
    if (!dragPointRef.current) setDragPoint(point)
    scheduleDragPaint(point)
  }

  const finishDrag = (event, shouldSnap) => {
    const drag = dragRef.current
    dragRef.current = null
    removeDragListeners()
    cancelDragPaint()

    if (!drag?.started) {
      suppressClickRef.current = false
      return
    }

    const gap = edgeGap()
    const latestPoint = dragPointRef.current
    const x = latestPoint?.x ?? dragPoint?.x ?? event.clientX - COLLAPSED_WIDTH / 2
    const y = latestPoint?.y ?? dragPoint?.y ?? event.clientY - PLAYER_HEIGHT / 2

    if (shouldSnap) {
      const centerX = x + COLLAPSED_WIDTH / 2
      setDockSide(centerX < window.innerWidth / 2 ? 'left' : 'right')
      setDockTop(clamp(y, gap, window.innerHeight - PLAYER_HEIGHT - gap))
    }

    dragPointRef.current = null
    setDragging(false)
    setDragPoint(null)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 80)
  }

  const endDrag = (event) => finishDrag(event, true)
  const cancelDrag = (event) => finishDrag(event, false)

  const playNextSong = useCallback(async () => {
    if (!user) {
      setOpen(true)
      return
    }
    let playableSongs = songs.filter(isPlayableSong)
    try {
      playableSongs = await loadPublicSongs()
    } catch {
      // Keep playback usable during a temporary network hiccup.
    }
    if (playableSongs.length === 0) {
      setPlaying(false)
      return
    }

    const currentIndex = playableSongs.findIndex(song => song.id === currentSong?.id)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playableSongs.length : 0
    if (currentSong?.id === playableSongs[nextIndex]?.id && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
    setCurrentSong(playableSongs[nextIndex])
    setCurrentTime(0)
  }, [currentSong, loadPublicSongs, songs, user])

  const playPreviousSong = useCallback(async () => {
    if (!user) {
      setOpen(true)
      return
    }
    let playableSongs = songs.filter(isPlayableSong)
    try {
      playableSongs = await loadPublicSongs()
    } catch {
      // Keep playback usable during a temporary network hiccup.
    }
    if (playableSongs.length === 0) {
      setPlaying(false)
      return
    }

    const currentIndex = playableSongs.findIndex(song => song.id === currentSong?.id)
    const previousIndex = currentIndex >= 0
      ? (currentIndex - 1 + playableSongs.length) % playableSongs.length
      : playableSongs.length - 1
    if (currentSong?.id === playableSongs[previousIndex]?.id && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
    setCurrentSong(playableSongs[previousIndex])
    setCurrentTime(0)
  }, [currentSong, loadPublicSongs, songs, user])

  const selectSong = (song) => {
    if (!user) {
      setOpen(true)
      return
    }
    if (!isPlayableSong(song)) return
    markPlayerActivity()
    setCurrentSong(song)
    setOpen(false)
    setCurrentTime(0)
  }

  const togglePlay = async () => {
    if (suppressClickRef.current) return
    markPlayerActivity()
    if (!user) {
      setOpen(true)
      return
    }
    if (!currentSong) {
      fetchSongs()
      setOpen(value => !value)
      return
    }
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    try {
      await audioRef.current.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const toggleList = () => {
    if (suppressClickRef.current) return
    markPlayerActivity()
    if (!user) {
      setOpen(value => !value)
      return
    }
    fetchSongs()
    setOpen(value => !value)
  }

  const seekTo = (value) => {
    if (!audioRef.current || !duration) return
    const nextTime = clamp(Number(value), 0, duration)
    audioRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const beginSeek = (event) => {
    event.stopPropagation()
    setSeeking(true)
    wakePlayer()
  }

  const endSeek = (event) => {
    event.stopPropagation()
    setSeeking(false)
    scheduleCollapse()
  }

  const activeLyricIndex = useMemo(() => {
    if (lyricsLines.length === 0) return -1
    let index = -1
    for (let i = 0; i < lyricsLines.length; i += 1) {
      if (lyricsLines[i].time <= currentTime + 0.2) index = i
      else break
    }
    return index
  }, [currentTime, lyricsLines])

  const updateLyricsSettings = useCallback((patch) => {
    setLyricsSettings(current => {
      const next = { ...current, ...patch }
      localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const collapsed = dragging || !currentSong || idleCollapsed
  const showText = !dragging && !currentSong
  const showSongInfo = !dragging && currentSong && !idleCollapsed
  const expandedWidth = typeof window !== 'undefined'
    ? Math.min(368, window.innerWidth - edgeGap() * 2)
    : 368
  const playerWidth = collapsed ? (showText ? 104 : COLLAPSED_WIDTH) : expandedWidth
  const panelDropsUp = typeof window !== 'undefined' && dockTop > window.innerHeight / 2
  const dockStyle = dragging && dragPoint
    ? { left: dragPoint.x, top: dragPoint.y, touchAction: 'none' }
    : {
        top: dockTop,
        left: dockSide === 'left' ? edgeGap() : undefined,
        right: dockSide === 'right' ? edgeGap() : undefined,
        touchAction: 'none',
      }
  const listHorizontalClass = dockSide === 'right' ? 'right-0' : 'left-0'
  const listVerticalClass = panelDropsUp ? 'bottom-full mb-2' : 'top-full mt-2'
  const playerContentDirection = dockSide === 'right' && !dragging ? 'flex-row-reverse' : 'flex-row'
  const revealOffset = dockSide === 'right' && !dragging ? 6 : -6

  return (
    <>
      <audio
        ref={audioRef}
        src={currentSong?.fileUrl || ''}
        preload="none"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onEnded={playNextSong}
      />

      <LyricsModule
        song={currentSong}
        playing={playing}
        status={lyricsStatus}
        lines={lyricsLines}
        activeIndex={activeLyricIndex}
        settings={lyricsSettings}
        onSettingsChange={updateLyricsSettings}
        onTogglePlay={togglePlay}
        onPrevious={() => {
          markPlayerActivity()
          playPreviousSong()
        }}
        onNext={() => {
          markPlayerActivity()
          playNextSong()
        }}
      />

      <div
        ref={rootRef}
        className="fixed z-[70]"
        style={dockStyle}
        onMouseEnter={wakePlayer}
        onMouseLeave={scheduleCollapse}
      >

      <motion.div
        ref={playerRef}
        layout
        onPointerDown={beginDrag}
        animate={{
          width: playerWidth,
          scale: dragging ? 1.06 : 1,
          boxShadow: dragging
            ? '0 22px 50px rgba(79, 70, 229, 0.28)'
            : '0 18px 35px rgba(79, 70, 229, 0.14)',
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className={`select-none overflow-hidden rounded-full border border-white/70 bg-white/90 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/90 ${
          dragging ? 'cursor-grabbing ring-4 ring-indigo-300/30' : 'cursor-grab'
        }`}
      >
        <div className={`flex h-14 items-center gap-2 px-2 ${playerContentDirection}`}>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: 'var(--theme-gradient)' }}
            title={playing ? '暂停' : '音乐'}
          >
            {loading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : currentSong ? (
              playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />
            ) : (
              <Music className="h-5 w-5" />
            )}
          </button>

          <AnimatePresence initial={false}>
            {showText && (
              <motion.button
                key="compact-label"
                type="button"
                initial={{ width: 0, opacity: 0, x: revealOffset }}
                animate={{ width: 40, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: revealOffset }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                onClick={toggleList}
                className={`overflow-hidden whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-slate-100 ${dockSide === 'right' ? 'pl-2 text-right' : 'pr-2 text-left'}`}
                title="歌曲列表"
              >
                音乐
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showSongInfo && (
              <motion.div
                key="song-info"
                initial={{ width: 0, opacity: 0, x: revealOffset }}
                animate={{ width: 'auto', opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: revealOffset }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden ${dockSide === 'right' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <button
                  type="button"
                  onClick={toggleList}
                  className={`min-w-0 flex-1 ${dockSide === 'right' ? 'text-right' : 'text-left'}`}
                  title={currentSong.title}
                >
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{currentSong.title}</div>
                  <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                    {currentSong.artist || '未知歌手'} · {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </button>
                <div
                  className={`relative h-5 w-28 rounded-full ${seeking ? 'music-progress-seeking' : ''}`}
                  onPointerDown={beginSeek}
                  onPointerUp={endSeek}
                  onPointerCancel={endSeek}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${progress}%`, background: 'var(--theme-gradient)' }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={duration > 0 ? currentTime : 0}
                    onChange={(event) => seekTo(event.target.value)}
                    onInput={(event) => seekTo(event.currentTarget.value)}
                    className="music-progress-range absolute inset-0 h-full w-full cursor-pointer"
                    aria-label="播放进度"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateLyricsSettings({ enabled: !lyricsSettings.enabled })}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    lyricsSettings.enabled
                      ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/15'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={lyricsSettings.enabled ? '关闭歌词模块' : '开启歌词模块'}
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleList}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title="歌曲列表"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && !dragging && (
          <motion.div
            initial={{ opacity: 0, y: panelDropsUp ? 8 : -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: panelDropsUp ? 8 : -8, scale: 0.98 }}
            className={`absolute ${listHorizontalClass} ${listVerticalClass} w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/95`}
          >
            {!user ? (
              <div className="px-5 py-5 text-center">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">登录后收听音乐</div>
				<p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">登录账号后即可访问歌曲和歌词。</p>
                <button
                  type="button"
                  onClick={() => openLogin(`${window.location.pathname}${window.location.search}`)}
                  disabled={authLoading}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {authLoading ? '检查登录状态...' : '立即登录'}
                </button>
              </div>
			) : songs.length === 0 ? (
			  <div className="px-4 py-5 text-center text-sm text-gray-500 dark:text-slate-400">
				{loading ? '加载中...' : playlistError ? (
				  <button type="button" onClick={() => fetchSongs()} className="font-medium text-rose-600 hover:text-rose-700 dark:text-rose-300">
					{playlistError}，点击重试
				  </button>
				) : '暂无可播放歌曲'}
			  </div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-2">
                {songs.map(song => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => selectSong(song)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      currentSong?.id === song.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                      {currentSong?.id === song.id && playing ? <Volume2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{song.title}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-slate-400">{song.artist || '未知歌手'}</div>
                    </div>
                    {song.lyricsUrl && <FileText className="h-4 w-4 shrink-0 text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  )
}

function LyricsPanel({ dockSide, verticalClass, song, status, lines, activeIndex, collapsed }) {
  const visibleLines = getVisibleLyrics(lines, activeIndex)

  return (
    <motion.div
      initial={{ opacity: 0, y: verticalClass.includes('bottom') ? 8 : -8, scale: 0.98 }}
      animate={{ opacity: collapsed ? 0.82 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: verticalClass.includes('bottom') ? 8 : -8, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-none absolute ${dockSide === 'right' ? 'right-0' : 'left-0'} ${verticalClass} w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white/88 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/88`}
    >
      <div className="border-b border-white/60 px-4 py-2.5 dark:border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5" />
          同步歌词
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{song.title}</div>
      </div>
      <div className="px-4 py-3">
        {status === 'loading' && (
          <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-slate-400">
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            歌词加载中...
          </div>
        )}
        {status === 'missing' && (
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-center text-sm text-gray-500 dark:bg-slate-900 dark:text-slate-400">
            这首歌还没有导入歌词
          </div>
        )}
        {(status === 'empty' || status === 'error') && (
          <div className="rounded-xl bg-amber-50 px-3 py-3 text-center text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
            歌词文件暂时无法显示
          </div>
        )}
        {status === 'ready' && (
          <div className="space-y-1.5">
            {visibleLines.map(item => (
              <div
                key={`${item.index}-${item.line.time}`}
                className={`truncate text-center transition-all duration-200 ${
                  item.active
                    ? 'text-base font-semibold text-indigo-600 dark:text-indigo-300'
                    : 'text-sm text-gray-400 dark:text-slate-500'
                }`}
              >
                {item.line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function LyricsModule({
  song,
  playing,
  status,
  lines,
  activeIndex,
  settings,
  onSettingsChange,
  onTogglePlay,
  onPrevious,
  onNext,
}) {
  const moduleRef = useRef(null)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const resizeFrameRef = useRef(null)
  const positionRef = useRef(null)
  const lyricsSizeRef = useRef(null)
  const onSettingsChangeRef = useRef(onSettingsChange)
  const [panelOpen, setPanelOpen] = useState(false)
  const [position, setPosition] = useState(() => readLyricsPosition())
  const [liveSize, setLiveSize] = useState(null)
  const visibleLines = getVisibleLyrics(lines, activeIndex, settings.lineCount)
  const savedModuleWidth = lyricsModuleWidth(settings.width)
  const savedModuleHeight = lyricsModuleHeight(settings.height)
  const moduleWidth = liveSize?.width ?? savedModuleWidth
  const moduleHeight = liveSize?.height ?? savedModuleHeight
  const hasBilingualLyrics = lines.some(line => Array.isArray(line.parts) && line.parts.length > 1)
  const maxShellHeight = typeof window !== 'undefined'
    ? Math.max(260, window.innerHeight - edgeGap() * 2)
    : 424
  const settingsHeight = hasBilingualLyrics ? 424 : 326
  const shellHeight = panelOpen ? Math.min(maxShellHeight, Math.max(moduleHeight, settingsHeight)) : moduleHeight

  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    lyricsSizeRef.current = {
      width: moduleWidth,
      height: shellHeight,
    }
  }, [moduleWidth, shellHeight])

  useEffect(() => {
    onSettingsChangeRef.current = onSettingsChange
  }, [onSettingsChange])

  const moveLyricsResize = useCallback((event) => {
    const resize = resizeRef.current
    if (!resize) return
    event.preventDefault()

    const dx = event.clientX - resize.startX
    const dy = event.clientY - resize.startY
    const limits = lyricsSizeLimits()
    let nextWidth = resize.startWidth
    let nextHeight = resize.startHeight
    let nextX = resize.startLeft
    let nextY = resize.startTop

    if (resize.edge.includes('e')) {
      nextWidth = clamp(resize.startWidth + dx, limits.minWidth, limits.maxWidth)
    }
    if (resize.edge.includes('s')) {
      nextHeight = clamp(resize.startHeight + dy, limits.minHeight, limits.maxHeight)
    }
    if (resize.edge.includes('w')) {
      nextWidth = clamp(resize.startWidth - dx, limits.minWidth, limits.maxWidth)
      nextX = resize.startLeft + resize.startWidth - nextWidth
    }
    if (resize.edge.includes('n')) {
      nextHeight = clamp(resize.startHeight - dy, limits.minHeight, limits.maxHeight)
      nextY = resize.startTop + resize.startHeight - nextHeight
    }

    const nextPosition = clampLyricsPosition({ x: nextX, y: nextY }, nextWidth, nextHeight)
    resize.nextWidth = nextWidth
    resize.nextHeight = nextHeight
    resize.nextPosition = nextPosition

    if (resizeFrameRef.current !== null) return
    const applyResize = () => {
      resizeFrameRef.current = null
      const current = resizeRef.current
      if (!current) return
      const nextWidth = current.nextWidth ?? current.startWidth
      const nextHeight = current.nextHeight ?? current.startHeight
      const nextPosition = current.nextPosition ?? clampLyricsPosition(
        { x: current.startLeft, y: current.startTop },
        current.startWidth,
        current.startHeight,
      )
      if (moduleRef.current) {
        moduleRef.current.style.left = `${nextPosition.x}px`
        moduleRef.current.style.top = `${nextPosition.y}px`
        moduleRef.current.style.width = `${nextWidth}px`
        moduleRef.current.style.height = `${nextHeight}px`
      }
      setLiveSize({
        width: nextWidth,
        height: nextHeight,
      })
      setPosition(nextPosition)
    }
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      resizeFrameRef.current = window.requestAnimationFrame(applyResize)
    } else {
      applyResize()
    }
  }, [])

  const endLyricsResize = useCallback(() => {
    const resize = resizeRef.current
    if (resizeFrameRef.current !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = null
    }
    if (resize) {
      const finalWidth = resize.nextWidth ?? resize.startWidth
      const finalHeight = resize.nextHeight ?? resize.startHeight
      const finalPosition = resize.nextPosition ?? clampLyricsPosition(
        { x: resize.startLeft, y: resize.startTop },
        finalWidth,
        finalHeight,
      )
      setPosition(finalPosition)
      onSettingsChangeRef.current({
        width: Math.round(finalWidth),
        height: Math.round(finalHeight),
      })
      setLiveSize(null)
    }
    resizeRef.current = null
    window.removeEventListener('pointermove', moveLyricsResize)
    window.removeEventListener('pointerup', endLyricsResize)
    window.removeEventListener('pointercancel', endLyricsResize)
  }, [moveLyricsResize])

  const moveLyricsDrag = useCallback((event) => {
    const drag = dragRef.current
    if (!drag) return
    const size = lyricsSizeRef.current || { width: DEFAULT_LYRICS_SETTINGS.width, height: DEFAULT_LYRICS_SETTINGS.height }
    setPosition(clampLyricsPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    }, size.width, size.height))
  }, [])

  const endLyricsDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', moveLyricsDrag)
    window.removeEventListener('pointerup', endLyricsDrag)
    window.removeEventListener('pointercancel', endLyricsDrag)
  }, [moveLyricsDrag])

  useEffect(() => {
    localStorage.setItem('music-lyrics-module-position', JSON.stringify(position))
  }, [position])

  useEffect(() => {
    const keepInside = () => setPosition(current => clampLyricsPosition(current))
    window.addEventListener('resize', keepInside)
    return () => window.removeEventListener('resize', keepInside)
  }, [])

  useEffect(() => {
    setPosition(current => clampLyricsPosition(current, moduleWidth, shellHeight))
  }, [moduleWidth, shellHeight])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', moveLyricsDrag)
      window.removeEventListener('pointerup', endLyricsDrag)
      window.removeEventListener('pointercancel', endLyricsDrag)
      window.removeEventListener('pointermove', moveLyricsResize)
      window.removeEventListener('pointerup', endLyricsResize)
      window.removeEventListener('pointercancel', endLyricsResize)
      if (resizeFrameRef.current !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
    }
  }, [endLyricsDrag, endLyricsResize, moveLyricsDrag, moveLyricsResize])

  if (!settings.enabled || !song) return null

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (isInteractiveTarget(event.target)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const rect = moduleRef.current?.getBoundingClientRect()
    const currentPosition = positionRef.current || position
    dragRef.current = {
      offsetX: event.clientX - (rect?.left || currentPosition.x),
      offsetY: event.clientY - (rect?.top || currentPosition.y),
    }
    window.addEventListener('pointermove', moveLyricsDrag)
    window.addEventListener('pointerup', endLyricsDrag)
    window.addEventListener('pointercancel', endLyricsDrag)
  }

  const startResize = (edge) => (event) => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const rect = moduleRef.current?.getBoundingClientRect()
    const currentPosition = positionRef.current || position
    const currentSize = lyricsSizeRef.current || { width: moduleWidth, height: shellHeight }
    resizeRef.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect?.left || currentPosition.x,
      startTop: rect?.top || currentPosition.y,
      startWidth: rect?.width || currentSize.width,
      startHeight: rect?.height || currentSize.height,
    }
    window.addEventListener('pointermove', moveLyricsResize)
    window.addEventListener('pointerup', endLyricsResize)
    window.addEventListener('pointercancel', endLyricsResize)
  }

  return (
    <motion.div
      ref={moduleRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onPointerDown={startDrag}
      className="lyrics-module-shell fixed z-[65] touch-none select-none overflow-hidden rounded-2xl border border-white/70 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl dark:border-slate-700/70"
      style={{
        left: position.x,
        top: position.y,
        width: moduleWidth,
        height: shellHeight,
        touchAction: 'none',
        '--lyrics-bg-opacity': settings.opacity / 100,
      }}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-2 border-b border-white/60 px-4 py-3 active:cursor-grabbing dark:border-slate-800/80 sm:px-3 sm:py-2"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
            <Move className="h-3.5 w-3.5" />
            同步歌词
          </div>
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{song.title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => setPanelOpen(value => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="歌词设置"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onSettingsChange({ enabled: false })}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
            title="关闭歌词"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {panelOpen && (
        <LyricsSettingsPanel
          settings={settings}
          hasBilingualLyrics={hasBilingualLyrics}
          onChange={onSettingsChange}
        />
      )}

      {!panelOpen && (
        <div className="flex h-[calc(100%-3.25rem)] flex-col overflow-hidden px-4 py-3">
          <div className="min-h-0 flex-1 overflow-hidden">
            <LyricsContent
              status={status}
              visibleLines={visibleLines}
              effect={settings.effect}
              fontSize={settings.fontSize}
              primaryLyricLine={settings.primaryLyricLine}
              showTranslation={settings.showTranslation}
            />
          </div>
          <LyricsPlaybackControls
            playing={playing}
            onTogglePlay={onTogglePlay}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        </div>
      )}
      <LyricsResizeHandles onStartResize={startResize} />
    </motion.div>
  )
}

function LyricsResizeHandles({ onStartResize }) {
  const edgeClass = 'absolute z-20 touch-none bg-transparent'
  const cornerClass = `${edgeClass} h-6 w-6 sm:h-4 sm:w-4`
  return (
    <>
      <span data-drag-ignore="true" onPointerDown={onStartResize('n')} className={`${edgeClass} left-6 right-6 top-0 h-4 cursor-ns-resize sm:h-2`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('s')} className={`${edgeClass} bottom-0 left-6 right-6 h-4 cursor-ns-resize sm:h-2`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('w')} className={`${edgeClass} bottom-6 left-0 top-6 w-4 cursor-ew-resize sm:bottom-4 sm:top-4 sm:w-2`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('e')} className={`${edgeClass} bottom-6 right-0 top-6 w-4 cursor-ew-resize sm:bottom-4 sm:top-4 sm:w-2`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('nw')} className={`${cornerClass} left-0 top-0 cursor-nwse-resize`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('ne')} className={`${cornerClass} right-0 top-0 cursor-nesw-resize`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('sw')} className={`${cornerClass} bottom-0 left-0 cursor-nesw-resize`} />
      <span data-drag-ignore="true" onPointerDown={onStartResize('se')} className={`${cornerClass} bottom-0 right-0 cursor-nwse-resize`} />
    </>
  )
}

function LyricsPlaybackControls({ playing, onTogglePlay, onPrevious, onNext }) {
  const stopDrag = event => event.stopPropagation()

  return (
    <div className="mt-2 flex shrink-0 items-center justify-center gap-2 border-t border-white/55 pt-2 dark:border-slate-800/70">
      <button
        type="button"
        onPointerDown={stopDrag}
        onClick={onPrevious}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title="上一首"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onPointerDown={stopDrag}
        onClick={onTogglePlay}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: 'var(--theme-gradient)' }}
        title={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5 translate-x-0.5" />}
      </button>
      <button
        type="button"
        onPointerDown={stopDrag}
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title="下一首"
      >
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  )
}

function LyricsSettingsPanel({ settings, hasBilingualLyrics, onChange }) {
  return (
    <div className="grid max-h-[calc(100vh-8rem)] gap-3 overflow-y-auto border-b border-white/60 bg-white/55 px-3 py-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/55">
      <label className="grid gap-1 text-gray-500 dark:text-slate-400">
        <span>显示特效</span>
        <select
          value={settings.effect}
          onChange={event => onChange({ effect: event.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="pop">逐字弹出</option>
          <option value="slide">滑入</option>
          <option value="fade">淡入</option>
          <option value="karaoke">高亮聚焦</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <RangeSetting label="字号" value={settings.fontSize} min={13} max={24} unit="px" onChange={value => onChange({ fontSize: value })} />
        <RangeSetting label="行数" value={settings.lineCount} min={1} max={5} unit="行" onChange={value => onChange({ lineCount: value })} />
      </div>
      {hasBilingualLyrics && (
        <div className="grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <label className="grid gap-1 text-gray-500 dark:text-slate-400">
            <span>主歌词行</span>
            <select
              value={settings.primaryLyricLine}
              onChange={event => onChange({ primaryLyricLine: event.target.value })}
              className="rounded-lg border border-indigo-100 bg-white px-2 py-1.5 text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="first">第一行作为主歌词</option>
              <option value="second">第二行作为主歌词</option>
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-gray-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={settings.showTranslation !== false}
              onChange={event => onChange({ showTranslation: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>显示下方翻译小字</span>
          </label>
        </div>
      )}
      <RangeSetting label="透明度" value={settings.opacity} min={45} max={100} unit="%" onChange={value => onChange({ opacity: value })} />
    </div>
  )
}

function RangeSetting({ label, value, min, max, unit, onChange }) {
  return (
    <label className="grid gap-1 text-gray-500 dark:text-slate-400">
      <span>{label}: {value}{unit}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="accent-indigo-600"
      />
    </label>
  )
}

function LyricsContent({ status, visibleLines, effect, fontSize, primaryLyricLine, showTranslation }) {
  if (status === 'loading') {
    return (
      <div className="flex w-full items-center justify-center py-5 text-sm text-gray-500 dark:text-slate-400">
        <Loader className="mr-2 h-4 w-4 animate-spin" />
        歌词加载中...
      </div>
    )
  }
  if (status === 'missing') return <LyricsNotice>这首歌还没有导入歌词</LyricsNotice>
  if (status === 'empty' || status === 'error') return <LyricsNotice tone="warn">歌词文件暂时无法显示</LyricsNotice>

  return (
    <div className="h-full w-full space-y-1.5 overflow-hidden">
      {visibleLines.map(item => (
        <LyricLine
          key={`${item.index}-${item.line.time}`}
          line={item.line}
          active={item.active}
          effect={effect}
          fontSize={fontSize}
          primaryLyricLine={primaryLyricLine}
          showTranslation={showTranslation}
        />
      ))}
    </div>
  )
}

function LyricsNotice({ tone = 'muted', children }) {
  const classes = tone === 'warn'
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
    : 'bg-gray-50 text-gray-500 dark:bg-slate-900 dark:text-slate-400'
  return <div className={`w-full rounded-xl px-3 py-3 text-center text-sm ${classes}`}>{children}</div>
}

function LyricsLineText({ text, active, effect }) {
  if (active && effect === 'pop') {
    return Array.from(text).map((char, index) => (
      <motion.span
        key={`${char}-${index}`}
        initial={{ opacity: 0, y: 8, scale: 0.72 }}
        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
        transition={{ delay: Math.min(index * 0.025, 0.7), type: 'spring', stiffness: 420, damping: 24 }}
        className="inline-block"
      >
        {char}
      </motion.span>
    ))
  }
  return text
}

function getLyricDisplayParts(line, primaryLyricLine, showTranslation) {
  const parts = Array.isArray(line?.parts) && line.parts.length > 0
    ? line.parts
    : [line?.text || '']
  const primaryIndex = primaryLyricLine === 'second' && parts.length > 1 ? 1 : 0
  const primary = parts[primaryIndex] || parts[0] || ''
  const translation = showTranslation === false
    ? ''
    : parts.filter((part, index) => index !== primaryIndex && part && part !== primary).join(' / ')
  return { primary, translation }
}

function LyricLine({ line, active, effect, fontSize, primaryLyricLine, showTranslation }) {
  const { primary, translation } = getLyricDisplayParts(line, primaryLyricLine, showTranslation)
  const baseClass = active
    ? 'font-semibold text-indigo-600 drop-shadow-sm dark:text-indigo-300'
    : 'text-gray-400 dark:text-slate-500'

  return (
    <motion.div
      initial={{
        opacity: active ? 0 : 0.72,
        y: effect === 'slide' && active ? 8 : 0,
        x: 0,
        scale: effect === 'karaoke' && active ? 0.96 : 1,
      }}
      animate={{
        opacity: 1,
        y: 0,
        x: 0,
        scale: effect === 'karaoke' && active ? 1.04 : 1,
      }}
      transition={{ duration: 0.22 }}
      className={`text-center transition-colors ${baseClass}`}
    >
      <div className="truncate" style={{ fontSize }}>
        <LyricsLineText text={primary} active={active} effect={effect} />
      </div>
      {translation && (
        <div
          className={`mt-0.5 truncate font-medium ${
            active
              ? 'text-[color:color-mix(in_srgb,var(--theme-primary)_72%,#64748b)] dark:text-indigo-200/85'
              : 'text-gray-300 dark:text-slate-600'
          }`}
          style={{ fontSize: Math.max(11, Number(fontSize) * 0.72) }}
        >
          {translation}
        </div>
      )}
    </motion.div>
  )
}

function readLyricsSettings() {
  if (typeof window === 'undefined') return DEFAULT_LYRICS_SETTINGS
  try {
    const parsed = JSON.parse(localStorage.getItem(LYRICS_SETTINGS_KEY) || '{}')
    return {
      ...DEFAULT_LYRICS_SETTINGS,
      ...parsed,
      orientation: undefined,
      fontSize: clamp(Number(parsed.fontSize) || DEFAULT_LYRICS_SETTINGS.fontSize, 13, 24),
      opacity: clamp(Number(parsed.opacity) || DEFAULT_LYRICS_SETTINGS.opacity, 45, 100),
      lineCount: clamp(Number(parsed.lineCount) || DEFAULT_LYRICS_SETTINGS.lineCount, 1, 5),
      width: lyricsModuleWidth(parsed.width || DEFAULT_LYRICS_SETTINGS.width),
      height: lyricsModuleHeight(parsed.height || DEFAULT_LYRICS_SETTINGS.height),
      primaryLyricLine: parsed.primaryLyricLine === 'second' ? 'second' : 'first',
      showTranslation: parsed.showTranslation !== false,
    }
  } catch {
    return DEFAULT_LYRICS_SETTINGS
  }
}

function readLyricsPosition() {
  if (typeof window === 'undefined') return { x: 24, y: 120 }
  try {
    const parsed = JSON.parse(localStorage.getItem('music-lyrics-module-position') || '{}')
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return clampLyricsPosition(parsed)
    }
  } catch {
    // ignore broken local settings
  }
  return clampLyricsPosition({
    x: window.innerWidth - 420,
    y: 96,
  })
}

function clampLyricsPosition(position, widthValue = DEFAULT_LYRICS_SETTINGS.width, heightValue = DEFAULT_LYRICS_SETTINGS.height) {
  if (typeof window === 'undefined') return position
  const gap = edgeGap()
  const width = lyricsModuleWidth(widthValue)
  const height = Math.max(lyricsModuleHeight(heightValue), Number(heightValue) || 0)
  const maxX = Math.max(gap, window.innerWidth - width - gap)
  const maxY = Math.max(gap, window.innerHeight - height - gap)
  return {
    x: clamp(Number(position.x) || gap, gap, maxX),
    y: clamp(Number(position.y) || DEFAULT_TOP, gap, maxY),
  }
}

function lyricsModuleWidth(value) {
  const limits = lyricsSizeLimits()
  return clamp(Number(value) || DEFAULT_LYRICS_SETTINGS.width, limits.minWidth, limits.maxWidth)
}

function lyricsModuleHeight(value) {
  const limits = lyricsSizeLimits()
  return clamp(Number(value) || DEFAULT_LYRICS_SETTINGS.height, limits.minHeight, limits.maxHeight)
}

function lyricsSizeLimits() {
  if (typeof window === 'undefined') {
    return {
      minWidth: LYRICS_MIN_WIDTH_DESKTOP,
      maxWidth: LYRICS_MAX_WIDTH,
      minHeight: LYRICS_MIN_HEIGHT,
      maxHeight: LYRICS_MAX_HEIGHT,
    }
  }
  const gap = edgeGap()
  const mobile = window.innerWidth < 640
  const minWidth = mobile ? LYRICS_MIN_WIDTH_MOBILE : LYRICS_MIN_WIDTH_DESKTOP
  const viewportWidth = Math.max(minWidth, window.innerWidth - gap * 2)
  const viewportHeight = Math.max(LYRICS_MIN_HEIGHT, window.innerHeight - gap * 2)
  return {
    minWidth,
    maxWidth: Math.max(minWidth, Math.min(LYRICS_MAX_WIDTH, viewportWidth)),
    minHeight: LYRICS_MIN_HEIGHT,
    maxHeight: Math.max(LYRICS_MIN_HEIGHT, Math.min(LYRICS_MAX_HEIGHT, viewportHeight)),
  }
}

function decodeLyricsBuffer(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function parseLrc(text) {
  const lineGroups = new Map()
  const timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/g

  String(text || '').split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim()
    if (!line) return

    const matches = [...line.matchAll(timePattern)]
    if (matches.length === 0) return

    const lyricText = line.replace(timePattern, '').trim()
    if (!lyricText) return

    matches.forEach(match => {
      const mins = Number(match[1])
      const secs = Number(match[2])
      const fraction = match[3] || '0'
      const ms = Number(fraction.padEnd(3, '0').slice(0, 3))
      const time = mins * 60 + secs + ms / 1000
      if (Number.isFinite(time)) {
        const key = time.toFixed(3)
        const group = lineGroups.get(key) || { time, parts: [] }
        if (!group.parts.includes(lyricText)) {
          group.parts.push(lyricText)
        }
        lineGroups.set(key, group)
      }
    })
  })

  return Array.from(lineGroups.values())
    .map(group => ({
      time: group.time,
      text: group.parts[0] || '',
      parts: group.parts,
    }))
    .sort((a, b) => a.time - b.time)
}

function getVisibleLyrics(lines, activeIndex, lineCount = 3) {
  if (lines.length === 0) return []
  const safeIndex = activeIndex >= 0 ? activeIndex : 0
  const count = clamp(Number(lineCount) || 3, 1, 5)
  const before = Math.floor((count - 1) / 2)
  const start = clamp(safeIndex - before, 0, Math.max(0, lines.length - count))
  return lines.slice(start, start + count).map((line, offset) => {
    const index = start + offset
    return { line, index, active: index === safeIndex }
  })
}
