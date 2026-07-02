import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader, Music, Pause, Play, Volume2 } from 'lucide-react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

export default function MusicPlayer() {
  const audioRef = useRef(null)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [currentSong, setCurrentSong] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    fetch('/api/public/music')
      .then(res => res.json())
      .then(data => setSongs(Array.isArray(data) ? data : []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!currentSong || !audioRef.current) return
    audioRef.current.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [currentSong])

  const selectSong = (song) => {
    setCurrentSong(song)
    setOpen(false)
    setCurrentTime(0)
  }

  const togglePlay = async () => {
    if (!currentSong) {
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fixed bottom-6 left-4 z-[70] sm:left-6">
      <audio
        ref={audioRef}
        src={currentSong?.fileUrl || ''}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={() => setPlaying(false)}
      />

      <motion.div
        layout
        className={`overflow-hidden rounded-full border border-white/70 bg-white/90 shadow-xl shadow-indigo-500/15 backdrop-blur-xl ${
          currentSong ? 'w-[min(23rem,calc(100vw-2rem))]' : 'w-[6.5rem]'
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

          {!currentSong && (
            <button
              type="button"
              onClick={() => setOpen(value => !value)}
              className="pr-2 text-sm font-semibold text-gray-800"
              title="歌曲列表"
            >
              音乐
            </button>
          )}

          {currentSong && (
            <>
              <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="min-w-0 flex-1 text-left"
                title={currentSong.title}
              >
                <div className="truncate text-sm font-semibold text-gray-900">{currentSong.title}</div>
                <div className="truncate text-xs text-gray-500">
                  {currentSong.artist || '未知歌手'} · {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </button>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${progress}%`, background: 'var(--theme-gradient)' }}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                title="歌曲列表"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            </>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: -8, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute bottom-full left-0 mb-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl"
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
