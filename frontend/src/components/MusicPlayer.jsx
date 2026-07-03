import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader, Music, Pause, Play, Volume2 } from 'lucide-react'

const DEFAULT_TOP = 96
const PLAYER_HEIGHT = 56
const COLLAPSED_WIDTH = 56
const EDGE_GAP_MOBILE = 16
const EDGE_GAP_DESKTOP = 24
const DRAG_THRESHOLD = 6
const COLLAPSE_DELAY = 3000

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

export default function MusicPlayer() {
  const audioRef = useRef(null)
  const rootRef = useRef(null)
  const playerRef = useRef(null)
  const dragRef = useRef(null)
  const dragPointRef = useRef(null)
  const dragFrameRef = useRef(null)
  const collapseTimerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
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

  const fetchSongs = useCallback(async () => {
    if (loaded || loading) return

    setLoading(true)
    try {
      const res = await fetch('/api/public/music')
      const data = res.ok ? await res.json() : []
      setSongs(Array.isArray(data) ? data : [])
      setLoaded(true)
    } catch {
      setSongs([])
    } finally {
      setLoading(false)
    }
  }, [loaded, loading])

  useEffect(() => {
    if (!currentSong || !audioRef.current) return
    audioRef.current.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [currentSong])

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
    if (currentSong) {
      setIdleCollapsed(false)
    }
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
      if (dragPointRef.current) {
        paintDragPoint(dragPointRef.current)
      }
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
    if (!dragPointRef.current) {
      setDragPoint(point)
    }
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

  const playNextSong = useCallback(() => {
    if (songs.length === 0) {
      setPlaying(false)
      return
    }

    const currentIndex = songs.findIndex(song => song.id === currentSong?.id)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % songs.length : 0
    if (currentSong?.id === songs[nextIndex]?.id && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
    setCurrentSong(songs[nextIndex])
    setCurrentTime(0)
  }, [currentSong, songs])

  const selectSong = (song) => {
    markPlayerActivity()
    setCurrentSong(song)
    setOpen(false)
    setCurrentTime(0)
  }

  const togglePlay = async () => {
    if (suppressClickRef.current) return
    markPlayerActivity()
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

  return (
    <div
      ref={rootRef}
      className="fixed z-[70]"
      style={dockStyle}
      onMouseEnter={wakePlayer}
      onMouseLeave={scheduleCollapse}
    >
      <audio
        ref={audioRef}
        src={currentSong?.fileUrl || ''}
        preload="none"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={playNextSong}
      />

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
        className={`select-none overflow-hidden rounded-full border border-white/70 bg-white/90 backdrop-blur-xl ${
          dragging ? 'cursor-grabbing ring-4 ring-indigo-300/30' : 'cursor-grab'
        }`}
      >
        <div className="flex h-14 items-center gap-2 px-2">
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
                initial={{ width: 0, opacity: 0, x: -6 }}
                animate={{ width: 40, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                onClick={toggleList}
                className="overflow-hidden whitespace-nowrap pr-2 text-sm font-semibold text-gray-800"
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
                initial={{ width: 0, opacity: 0, x: -6 }}
                animate={{ width: 'auto', opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
              >
              <button
                type="button"
                onClick={toggleList}
                className="min-w-0 flex-1 text-left"
                title={currentSong.title}
              >
                <div className="truncate text-sm font-semibold text-gray-900">{currentSong.title}</div>
                <div className="truncate text-xs text-gray-500">
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
                <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200">
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
                onClick={toggleList}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
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
            className={`absolute ${listHorizontalClass} ${listVerticalClass} w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl`}
          >
            {songs.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-gray-500">
                {loading ? '加载中...' : '暂无可播放歌曲'}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-2">
                {songs.map(song => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => selectSong(song)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      currentSong?.id === song.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-indigo-600">
                      {currentSong?.id === song.id && playing ? <Volume2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{song.title}</div>
                      <div className="truncate text-xs text-gray-500">{song.artist || '未知歌手'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
