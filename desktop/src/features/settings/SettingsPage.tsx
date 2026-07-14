import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  Globe2,
  LockKeyhole,
  Monitor,
  Moon,
  Music2,
  Pencil,
  RotateCcw,
  Save,
  Server,
  Sun,
  TestTube2,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { isSecureServerUrl, normalizeServerUrl, publicApi } from '../../shared/api/client'
import { DEFAULT_SERVER_URL, useSettings, type ColorMode } from '../../shared/settings/SettingsContext'

type TestState = { kind: 'idle' | 'testing' | 'success' | 'error'; message?: string }

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const queryClient = useQueryClient()
  const [serverDraft, setServerDraft] = useState(settings.serverUrl)
  const [editingServer, setEditingServer] = useState(false)
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  useEffect(() => setServerDraft(settings.serverUrl), [settings.serverUrl])

  const normalized = (() => {
    try { return normalizeServerUrl(serverDraft) } catch { return null }
  })()
  const secure = normalized ? isSecureServerUrl(normalized) : false

  const saveServer = () => {
    if (!normalized) return
    if (normalized !== settings.serverUrl && !window.confirm('更改内容服务器会切换全部博客数据，并退出当前服务器的登录状态。确定继续吗？')) return
    updateSettings({ serverUrl: normalized })
    queryClient.removeQueries()
    setEditingServer(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const testServer = async () => {
    if (!normalized) return setTest({ kind: 'error', message: '服务器地址格式不正确' })
    setTest({ kind: 'testing' })
    try {
      await publicApi.health(normalized)
      setTest({ kind: 'success', message: '连接正常' })
    } catch (error) {
      setTest({ kind: 'error', message: error instanceof Error ? error.message : '连接失败' })
    }
  }

  const cancelServerEdit = () => {
    setServerDraft(settings.serverUrl)
    setEditingServer(false)
    setTest({ kind: 'idle' })
  }

  return (
    <div className="page settings-page">
      <header className="settings-heading"><h2>设置</h2></header>

      <section className="settings-section split-settings">
        <div>
          <div className="setting-title"><span><Globe2 size={18} /></span><div><h3>内容语言</h3></div></div>
          <div className="segmented-control">
            <button className={settings.language === 'zh' ? 'active' : ''} onClick={() => { updateSettings({ language: 'zh' }); queryClient.removeQueries() }}>中文</button>
            <button className={settings.language === 'en' ? 'active' : ''} onClick={() => { updateSettings({ language: 'en' }); queryClient.removeQueries() }}>English</button>
          </div>
        </div>
        <div>
          <div className="setting-title"><span><Monitor size={18} /></span><div><h3>外观</h3></div></div>
          <div className="segmented-control icon-segments">
            <ModeButton mode="system" value={settings.colorMode} icon={<Monitor size={15} />} label="跟随系统" onSelect={(colorMode) => updateSettings({ colorMode })} />
            <ModeButton mode="light" value={settings.colorMode} icon={<Sun size={15} />} label="浅色" onSelect={(colorMode) => updateSettings({ colorMode })} />
            <ModeButton mode="dark" value={settings.colorMode} icon={<Moon size={15} />} label="深色" onSelect={(colorMode) => updateSettings({ colorMode })} />
          </div>
        </div>
      </section>

      <section className="settings-section media-settings">
        <div className="setting-title"><span><Music2 size={18} /></span><div><h3>音乐播放栏</h3></div></div>
        <label className="single-toggle"><input aria-label="音乐播放栏" type="checkbox" checked={settings.musicEnabled} onChange={(event) => updateSettings({ musicEnabled: event.target.checked })} /></label>
      </section>

      <details className="advanced-settings">
        <summary><span><LockKeyhole size={17} /><strong>高级选项</strong></span><ChevronDown size={17} /></summary>
        <div className="advanced-content">
          <div className="advanced-title"><span><Server size={18} /></span><div><h3>内容服务器</h3><code>{settings.serverUrl}</code></div></div>

          {!editingServer ? (
            <div className="advanced-actions">
              {saved && <span className="saved-indicator"><CheckCircle2 size={14} /> 已保存</span>}
              <button className="button button-ghost" onClick={() => setEditingServer(true)}><Pencil size={15} /> 编辑地址</button>
            </div>
          ) : (
            <div className="server-editor">
              <label className="text-field"><span>服务器地址</span><input value={serverDraft} onChange={(event) => { setServerDraft(event.target.value); setTest({ kind: 'idle' }) }} autoComplete="off" spellCheck={false} /></label>
              <div className="server-editor-actions">
                <button className="button button-ghost" onClick={() => { setServerDraft(DEFAULT_SERVER_URL); setTest({ kind: 'idle' }) }}><RotateCcw size={15} /> 恢复默认</button>
                <button className="button button-secondary" onClick={testServer} disabled={!normalized || test.kind === 'testing'}><TestTube2 size={15} /> {test.kind === 'testing' ? '测试中' : '测试连接'}</button>
                <button className="button button-primary" onClick={saveServer} disabled={!normalized}><Save size={15} /> 确认更改</button>
                <button className="button button-ghost" onClick={cancelServerEdit}>取消</button>
              </div>
              {test.kind !== 'idle' && test.kind !== 'testing' && <div className={`setting-notice ${test.kind}`}>{test.kind === 'success' ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}{test.message}</div>}
              {normalized && !secure && <div className="setting-notice warning"><TriangleAlert size={15} />远程服务器必须使用 HTTPS</div>}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

function ModeButton({ mode, value, icon, label, onSelect }: { mode: ColorMode; value: ColorMode; icon: ReactNode; label: string; onSelect: (mode: ColorMode) => void }) {
  return <button className={value === mode ? 'active' : ''} onClick={() => onSelect(mode)}>{icon}{label}</button>
}
