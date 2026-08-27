import { FormEvent, useState } from 'react'
import { loginAccount, registerAccount, type User } from './api'

type AuthScreenProps = {
  onSuccess: (user: User) => void
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const user = mode === 'register'
        ? await registerAccount(email, password)
        : await loginAccount(email, password)
      onSuccess(user)
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
        <h1>{mode === 'login' ? 'Вход в кабинет' : 'Регистрация'}</h1>
        <p className="auth-lead">
          Коллекция и фото хранятся на сервере. Без входа синхронизация между устройствами недоступна.
        </p>
        <div className="auth-switch" role="tablist">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Вход</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Регистрация</button>
        </div>
        <form onSubmit={submit}>
          <label>Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>Пароль
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {mode === 'register' && <small className="auth-hint">Не менее 8 символов. Пароль хранится в виде хеша.</small>}
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>
            {pending ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать кабинет'}
          </button>
        </form>
      </section>
    </div>
  )
}
