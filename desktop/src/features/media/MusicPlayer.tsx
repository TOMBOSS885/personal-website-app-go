import { useQuery } from '@tanstack/react-query'
import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { resolveSameOriginServerUrl, userApi } from '../../shared/api/client'
import { useSettings } from '../../shared/settings/SettingsContext'
import { useUserAuth } from '../account/UserAuthContext'

export function MusicPlayer() {
  const { settings } = useSettings()
  const auth = useUserAuth()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(.72)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const query = useQuery({
    queryKey: ['music', settings.serverUrl, auth.user?.id],
    queryFn: ({ signal }) => userApi.music(settings.serverUrl, auth.accessToken!, signal),
    enabled: settings.musicEnabled && Boolean(auth.accessToken),
    staleTime: 8 * 60_000,
  })
  const tracks = query.data ?? []
  const track = tracks[index % Math.max(1, tracks.length)]
  const source = resolveSameOriginServerUrl(settings.serverUrl, track?.fileUrl)

  useEffect(() => {
    if (index >= tracks.length && tracks.length) setIndex(0)
  }, [index, tracks.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !source) return
    audio.src = source
    audio.load()
    setProgress(0)
    setDuration(0)
    if (playing) void audio.play().catch(() => setPlaying(false))
  }, [source])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  if (!settings.musicEnabled || !auth.isAuthenticated || tracks.length === 0) return null
  const move = (step: number) => {
    setIndex((current) => (current + step + tracks.length) % tracks.length)
    setPlaying(true)
  }
  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { try { await audio.play(); setPlaying(true) } catch { setPlaying(false) } }
  }

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => move(1)}
        onError={() => void query.refetch()}
      />
      <div className="now-playing"><span className="album-mark"><ListMusic size={17} /></span><span><strong>{track.title}</strong><small>{track.artist || '未知艺术家'}</small></span></div>
      <div className="player-controls">
        <button title="上一首" onClick={() => move(-1)}><SkipBack size={17} /></button>
        <button className="play-button" title={playing ? '暂停' : '播放'} onClick={toggle}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button title="下一首" onClick={() => move(1)}><SkipForward size={17} /></button>
      </div>
      <div className="player-progress"><span>{formatTime(progress)}</span><input aria-label="播放进度" type="range" min={0} max={Math.max(duration, 1)} step={1} value={Math.min(progress, Math.max(duration, 1))} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setProgress(next) }} /><span>{formatTime(duration)}</span></div>
      <div className="player-volume"><Volume2 size={15} /><input aria-label="音量" type="range" min={0} max={1} step={.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
      <button className="playlist-button" title="播放列表" onClick={() => setPlaylistOpen((open) => !open)}><ListMusic size={17} /><small>{tracks.length}</small></button>
      {playlistOpen && (
        <div className="playlist-popover">
          <div><strong>播放列表</strong><button title="关闭播放列表" onClick={() => setPlaylistOpen(false)}><X size={15} /></button></div>
          <ol>{tracks.map((item, itemIndex) => <li key={item.id}><button className={itemIndex === index ? 'active' : ''} onClick={() => { setIndex(itemIndex); setPlaying(true); setPlaylistOpen(false) }}><span>{String(itemIndex + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.artist || '未知艺术家'}</small></span>{itemIndex === index && <i>{playing ? '播放中' : '已暂停'}</i>}</button></li>)}</ol>
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minute = Math.floor(seconds / 60)
  return `${minute}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
