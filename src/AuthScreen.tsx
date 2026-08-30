import { FormEvent, useState } from 'react'
import {
  confirmPasswordReset,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  type User,
} from './api'

type AuthScreenProps = {
  onSuccess: (user: User) => void
  resetToken?: string | null
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

export function readPasswordResetToken() {
  if (window.location.pathname !== '/reset-password') return null
  return new URLSearchParams(window.location.search).get('token')
}

export default function AuthScreen({ onSuccess, resetToken = null }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  const changeMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setPasswordConfirm('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (mode === 'reset' && password !== passwordConfirm) {
      setError('Пароли не совпадают')
      return
    }
    setPending(true)
    try {
      if (mode === 'forgot') {
        setMessage(await requestPasswordReset(email))
      } else if (mode === 'reset') {
        if (!resetToken) throw new Error('В ссылке отсутствует токен восстановления')
        setMessage(await confirmPasswordReset(resetToken, password))
        history.replaceState({}, '', '/')
        setMode('login')
        setPassword('')
        setPasswordConfirm('')
      } else {
        const user = mode === 'register'
          ? await registerAccount(email, password)
          : await loginAccount(email, password)
        onSuccess(user)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось выполнить запрос')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-card">
        <div className="logo auth-logo">
          <span className="logo-coin">Н</span>
          <span>Нумизмат<small>Личный кабинет</small></span>
        </div>
        <h1>
          {mode === 'login' && 'Вход в кабинет'}
          {mode === 'register' && 'Регистрация'}
          {mode === 'forgot' && 'Восстановление пароля'}
          {mode === 'reset' && 'Новый пароль'}
        </h1>
        <p className="auth-lead">
          {mode === 'forgot'
            ? 'Укажите email. Если аккаунт существует, мы отправим одноразовую ссылку.'
            : mode === 'reset'
              ? 'Придумайте новый пароль. После смены пароля потребуется войти заново на всех устройствах.'
              : 'Коллекция и фото хранятся на сервере. Без входа синхронизация между устройствами недоступна.'}
        </p>
        {(mode === 'login' || mode === 'register') && (
          <div className="auth-switch" role="tablist">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Вход</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Регистрация</button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode !== 'reset' && (
            <label>Email
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>Пароль
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
          )}
          {mode === 'reset' && (
            <label>Повторите пароль
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required />
            </label>
          )}
          {(mode === 'register' || mode === 'reset') && <small className="auth-hint">От 8 до 128 символов, минимум одна буква и одна цифра, без пробелов.</small>}
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>
            {pending
              ? 'Подождите…'
              : mode === 'login'
                ? 'Войти'
                : mode === 'register'
                  ? 'Создать кабинет'
                  : mode === 'forgot'
                    ? 'Отправить ссылку'
                    : 'Сохранить новый пароль'}
          </button>
          {mode === 'login' && <button className="auth-link" type="button" onClick={() => changeMode('forgot')}>Забыли пароль?</button>}
          {(mode === 'forgot' || mode === 'reset') && <button className="auth-link" type="button" onClick={() => changeMode('login')}>Вернуться ко входу</button>}
        </form>
      </section>
    </div>
  )
}
