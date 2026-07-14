import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Globe2, Monitor, Moon, Music2, Save, Server, Sun, TestTube2, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { isSecureServerUrl, normalizeServerUrl, publicApi } from '../../shared/api/client'
import { useSettings, type ColorMode } from '../../shared/settings/SettingsContext'

type TestState = { kind: 'idle' | 'testing' | 'success' | 'error'; message?: string }

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const queryClient = useQueryClient()
  const [serverDraft, setServerDraft] = useState(settings.serverUrl)
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  useEffect(() => setServerDraft(settings.serverUrl), [settings.serverUrl])

  const normalized = (() => {
    try { return normalizeServerUrl(serverDraft) } catch { return null }
  })()
  const secure = normalized ? isSecureServerUrl(normalized) : false

  const saveServer = () => {
    if (!normalized) return
    updateSettings({ serverUrl: normalized })
    queryClient.removeQueries()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }
  const testServer = async () => {
    if (!normalized) return setTest({ kind: 'error', message: '服务器地址格式不正确' })
    setTest({ kind: 'testing' })
    try {
      await publicApi.health(normalized)
      setTest({ kind: 'success', message: '服务器连接正常' })
    } catch (error) {
      setTest({ kind: 'error', message: error instanceof Error ? error.message : '连接失败' })
    }
  }

  return (
    <div className="page settings-page">
      <section className="settings-heading">
        <span className="section-label">PREFERENCES</span>
        <h2>应用设置</h2>
      </section>

      <section className="settings-section">
        <div className="setting-title"><span><Server size={18} /></span><div><h3>内容服务器</h3><p>公开博客 API 与媒体资源的根地址</p></div></div>
        <div className="server-setting-row">
          <label className="text-field">
            <span>服务器地址</span>
            <input value={serverDraft} onChange={(event) => { setServerDraft(event.target.value); setTest({ kind: 'idle' }) }} placeholder="https://blog.example.com" />
          </label>
          <button className="button button-secondary" onClick={testServer} disabled={!normalized || test.kind === 'testing'}>
            <TestTube2 size={16} /> {test.kind === 'testing' ? '测试中' : '测试连接'}
          </button>
          <button className="button button-primary" onClick={saveServer} disabled={!normalized}>
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />} {saved ? '已保存' : '保存'}
          </button>
        </div>
        {test.kind !== 'idle' && test.kind !== 'testing' && (
          <div className={`setting-notice ${test.kind}`}>
            {test.kind === 'success' ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}{test.message}
          </div>
        )}
        {normalized && !secure && <div className="setting-notice warning"><TriangleAlert size={16} />生产服务器应使用 HTTPS，避免内容在传输中被篡改。</div>}
      </section>

      <section className="settings-section split-settings">
        <div>
          <div className="setting-title"><span><Globe2 size={18} /></span><div><h3>内容语言</h3><p>优先读取服务器上的对应简介</p></div></div>
          <div className="segmented-control">
            <button className={settings.language === 'zh' ? 'active' : ''} onClick={() => { updateSettings({ language: 'zh' }); queryClient.removeQueries() }}>中文</button>
            <button className={settings.language === 'en' ? 'active' : ''} onClick={() => { updateSettings({ language: 'en' }); queryClient.removeQueries() }}>English</button>
          </div>
        </div>
        <div>
          <div className="setting-title"><span><Monitor size={18} /></span><div><h3>外观</h3><p>选择阅读界面的明暗模式</p></div></div>
          <div className="segmented-control icon-segments">
            <ModeButton mode="system" value={settings.colorMode} icon={<Monitor size={15} />} label="跟随系统" onSelect={(colorMode) => updateSettings({ colorMode })} />
            <ModeButton mode="light" value={settings.colorMode} icon={<Sun size={15} />} label="浅色" onSelect={(colorMode) => updateSettings({ colorMode })} />
            <ModeButton mode="dark" value={settings.colorMode} icon={<Moon size={15} />} label="深色" onSelect={(colorMode) => updateSettings({ colorMode })} />
          </div>
        </div>
      </section>

      <section className="settings-section media-settings">
        <div className="setting-title"><span><Music2 size={18} /></span><div><h3>桌面体验</h3><p>控制从服务器同步的可选媒体功能</p></div></div>
        <div className="toggle-list">
          <label><span><Music2 size={16} /><span><strong>音乐播放栏</strong><small>登录后加载 Web 端公开歌单</small></span></span><input type="checkbox" checked={settings.musicEnabled} onChange={(event) => updateSettings({ musicEnabled: event.target.checked })} /></label>
        </div>
      </section>

      <section className="settings-meta"><span>Personal Blog Desktop</span><span>0.1.0</span><span>Tauri + React</span></section>
    </div>
  )
}

function ModeButton({ mode, value, icon, label, onSelect }: { mode: ColorMode; value: ColorMode; icon: ReactNode; label: string; onSelect: (mode: ColorMode) => void }) {
  return <button className={value === mode ? 'active' : ''} onClick={() => onSelect(mode)}>{icon}{label}</button>
}
