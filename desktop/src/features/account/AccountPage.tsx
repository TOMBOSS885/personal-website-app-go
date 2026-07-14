import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Save,
  Send,
  ShieldCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useUserAuth } from './UserAuthContext'

type Mode = 'login' | 'register' | 'reset'

export function AccountPage() {
  const auth = useUserAuth()
  if (auth.loading) return <div className="account-loading"><LoaderCircle className="spin" /><span>正在恢复安全会话</span></div>
  return auth.user ? <AccountProfile /> : <AccountAccess />
}

function AccountAccess() {
  const { login, register, requestCode, resetPassword } = useUserAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [cooldown, setCooldown] = useState(0)
  const [pending, setPending] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const changeMode = (next: Mode) => {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
    setCode('')
  }

  const sendCode = async () => {
    if (!email.trim() || sendingCode || cooldown > 0) return
    setSendingCode(true)
    setError('')
    try {
      await requestCode(email, mode === 'register' ? 'register' : 'reset')
      setCooldown(60)
      setMessage('验证码已发送，请检查邮箱。')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSendingCode(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!validPassword(password)) return setError('密码长度需要为 8-72 字节。')
    if (mode !== 'login' && password !== confirmPassword) return setError('两次输入的密码不一致。')
    if (mode !== 'login' && !/^\d{6}$/.test(code)) return setError('请输入 6 位邮箱验证码。')
    if (mode === 'register' && !/^[\p{L}\p{N}_-]{2,30}$/u.test(username.trim())) return setError('用户名需要为 2-30 位文字、数字、下划线或短横线。')

    setPending(true)
    try {
      if (mode === 'login') {
        await login(identifier, password, remember)
      } else if (mode === 'register') {
        await register({ email, code, username, password, remember })
      } else {
        await resetPassword({ email, code, password })
        setIdentifier(email)
        changeMode('login')
        setMessage('密码已重设，请使用新密码登录。')
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page account-page">
      <section className="account-access">
        <aside className="account-intro">
          <span className="account-emblem"><ShieldCheck size={28} /></span>
          <h2>把博客讨论与账号带到桌面</h2>
          <p>使用与 Web 端相同的普通用户账号。登录凭据由 Windows 安全凭据库保存，不写入浏览器存储。</p>
          <div className="account-benefits">
            <span><CheckCircle2 size={15} /> 发表评论与回复</span>
            <span><CheckCircle2 size={15} /> 使用受保护音乐</span>
            <span><CheckCircle2 size={15} /> 与网页端共用账号</span>
          </div>
        </aside>

        <div className="account-form-panel">
          <div className="account-tabs" role="tablist">
            <Tab active={mode === 'login'} icon={<LogIn size={15} />} label="登录" onClick={() => changeMode('login')} />
            <Tab active={mode === 'register'} icon={<UserPlus size={15} />} label="注册" onClick={() => changeMode('register')} />
            <Tab active={mode === 'reset'} icon={<KeyRound size={15} />} label="重设" onClick={() => changeMode('reset')} />
          </div>
          <div className="account-form-heading">
            <h3>{mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建读者账号' : '重设账号密码'}</h3>
            <p>{mode === 'login' ? '使用用户名或邮箱登录。' : '验证码将发送到你的注册邮箱。'}</p>
          </div>
          <form className="account-form" onSubmit={submit}>
            {mode === 'login' ? (
              <Field icon={<UserRound size={16} />} label="用户名或邮箱"><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="用户名或 name@example.com" required /></Field>
            ) : (
              <>
                <Field icon={<Mail size={16} />} label="邮箱地址"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@example.com" required /></Field>
                {mode === 'register' && <Field icon={<AtSign size={16} />} label="用户名"><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="2-30 位唯一用户名" required /></Field>}
                <label className="account-field"><span>邮箱验证码</span><div className="code-input"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6 位验证码" required /><button type="button" onClick={sendCode} disabled={!email.trim() || cooldown > 0 || sendingCode}>{sendingCode ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}{cooldown > 0 ? `${cooldown} 秒` : '发送'}</button></div></label>
              </>
            )}
            <PasswordField label={mode === 'login' ? '密码' : '设置密码'} value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode !== 'login' && <PasswordField label="确认密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />}
            {mode !== 'reset' && <label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>在此设备保持登录</span></label>}
            {message && <div className="form-message success"><CheckCircle2 size={15} />{message}</div>}
            {error && <div className="form-message error" role="alert">{error}</div>}
            <button className="button button-primary account-submit" disabled={pending || (mode === 'login' ? !identifier.trim() || !password : !email.trim() || !password || !confirmPassword || code.length !== 6)}>
              {pending ? <LoaderCircle className="spin" size={16} /> : mode === 'login' ? <LogIn size={16} /> : <ShieldCheck size={16} />}
              {pending ? '正在提交' : mode === 'login' ? '登录账号' : mode === 'register' ? '完成注册' : '重设密码'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function AccountProfile() {
  const { user, updateUsername, logout } = useUserAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  if (!user) return null
  return (
    <div className="page account-page">
      <section className="profile-overview">
        <span className="profile-monogram">{user.username.slice(0, 1).toUpperCase()}</span>
        <div><h2>{user.username}</h2><p>{user.email}</p></div>
        <span className="profile-status"><CheckCircle2 size={14} /> 已登录</span>
      </section>
      <section className="account-settings-grid">
        <div className="account-setting-card">
          <h3>公开用户名</h3><p>评论和回复会显示这个名称。</p>
          <label className="account-field"><span>用户名</span><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={30} /></label>
          {message && <div className="form-message success"><CheckCircle2 size={15} />{message}</div>}{error && <div className="form-message error">{error}</div>}
          <button className="button button-primary" disabled={pending || username.trim() === user.username} onClick={async () => { setPending(true); setError(''); try { await updateUsername(username); setMessage('用户名已更新。') } catch (caught) { setError(errorMessage(caught)) } finally { setPending(false) } }}><Save size={15} /> 保存用户名</button>
        </div>
        <div className="account-setting-card session-card"><h3>当前会话</h3><p>账号令牌安全保存在 Windows 凭据库中。</p><dl><div><dt>账号状态</dt><dd>{user.status}</dd></div><div><dt>注册时间</dt><dd>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</dd></div></dl><button className="button button-ghost logout-button" onClick={() => logout()}><LogOut size={15} /> 退出登录</button></div>
      </section>
    </div>
  )
}

function Tab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) { return <button type="button" role="tab" aria-selected={active} className={active ? 'active' : ''} onClick={onClick}>{icon}{label}</button> }
function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) { return <label className="account-field"><span>{label}</span><div className="field-with-icon">{icon}{children}</div></label> }
function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) { const [visible, setVisible] = useState(false); return <label className="account-field"><span>{label}</span><div className="field-with-icon"><KeyRound size={16} /><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required /><button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} title={visible ? '隐藏密码' : '显示密码'}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label> }
function validPassword(value: string) { const length = new TextEncoder().encode(value).length; return length >= 8 && length <= 72 && !/[\u0000-\u001f\u007f]/.test(value) }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : '请求失败，请稍后重试。' }
