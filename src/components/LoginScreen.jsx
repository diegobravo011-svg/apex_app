import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

    .login-wrap {
      min-height: 100dvh;
      background: #F0EDE8;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 32px;
      font-family: 'DM Sans', sans-serif;
      max-width: 430px;
      margin: 0 auto;
    }
    .login-logo {
      font-size: 48px;
      font-weight: 300;
      letter-spacing: -2px;
      color: #1A1917;
      margin-bottom: 6px;
    }
    .login-sub {
      font-size: 13px;
      color: #9E9A94;
      margin-bottom: 56px;
      font-weight: 400;
    }
    .login-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .login-input {
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E5E1DA;
      border-radius: 14px;
      padding: 16px 18px;
      font-size: 15px;
      color: #1A1917;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }
    .login-input:focus { border-color: #1A1917; }
    .login-input::placeholder { color: #9E9A94; }
    .login-btn {
      width: 100%;
      margin-top: 4px;
      padding: 16px;
      background: #1A1917;
      color: #F0EDE8;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: opacity 0.15s;
    }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .login-error {
      font-size: 12px;
      color: #C0392B;
      font-family: 'DM Mono', monospace;
      text-align: center;
    }
    .login-hint {
      font-size: 10px;
      color: #C8C4BE;
      font-family: 'DM Mono', monospace;
      text-align: center;
      margin-top: 24px;
    }
  `

  return (
    <>
      <style>{css}</style>
      <div className="login-wrap">
        <div className="login-logo">apex</div>
        <div className="login-sub">Foundational Fitness Protocol</div>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            className="login-input"
            type="email"
            placeholder="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <div className="login-hint">acceso privado · apex fitness</div>
      </div>
    </>
  )
}
