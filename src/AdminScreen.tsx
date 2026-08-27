import { useEffect, useState } from 'react'
import { ArrowLeft, Shield, Users } from 'lucide-react'
import { type AdminUser, type Coin, fetchAdminUserCoins, fetchAdminUsers, revokeCoinImages } from './api'
import { CoinFace } from './CoinFace'

function formatCreated(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ru-RU')
}

function roleLabel(role: AdminUser['role']) {
  return role === 'admin' ? 'Администратор' : 'Пользователь'
}

export default function AdminScreen() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [coinsLoading, setCoinsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchAdminUsers()
        if (!cancelled) setUsers(list)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить админку')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => { revokeCoinImages(coins) }
  }, [coins])

  const openCollection = async (user: AdminUser) => {
    setSelected(user)
    setCoinsLoading(true)
    setError('')
    try {
      const next = await fetchAdminUserCoins(user.id)
      setCoins((prev) => {
        revokeCoinImages(prev)
        return next
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить коллекцию')
      setCoins((prev) => {
        revokeCoinImages(prev)
        return []
      })
    } finally {
      setCoinsLoading(false)
    }
  }

  const backToUsers = () => {
    revokeCoinImages(coins)
    setCoins([])
    setSelected(null)
    setError('')
  }

  return (
    <main>
      <section className="admin-panel" id="admin">
        <div className="section-heading">
          <div>
            <p className="kicker"><span /> Админка</p>
            <h2>{selected ? 'Коллекция пользователя' : 'Пользователи'}</h2>
            <p>
              {selected
                ? `${selected.email} · ${roleLabel(selected.role)} · ${selected.coinsCount} монет`
                : 'Список кабинетов и коллекций. Доступно только администратору.'}
            </p>
          </div>
          {selected && (
            <button className="ghost-button" type="button" onClick={backToUsers}>
              <ArrowLeft size={16} /> К списку
            </button>
          )}
        </div>

        {error && <p className="auth-error admin-error">{error}</p>}

        {!selected && loading && <p className="admin-muted">Загружаем пользователей…</p>}

        {!selected && !loading && users.length === 0 && (
          <div className="empty">
            <Users size={28} />
            <h3>Пользователей пока нет</h3>
            <p>После регистрации кабинеты появятся в этом списке</p>
          </div>
        )}

        {!selected && users.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Монет</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <button className="admin-user-link" type="button" onClick={() => openCollection(user)}>
                        {user.role === 'admin' && <Shield size={14} />}
                        {user.email}
                      </button>
                    </td>
                    <td>{roleLabel(user.role)}</td>
                    <td>{user.coinsCount}</td>
                    <td>{formatCreated(user.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && coinsLoading && <p className="admin-muted">Загружаем коллекцию…</p>}

        {selected && !coinsLoading && coins.length === 0 && (
          <div className="empty">
            <Users size={28} />
            <h3>Коллекция пуста</h3>
            <p>У этого пользователя ещё нет сохранённых монет</p>
          </div>
        )}

        {selected && coins.length > 0 && (
          <div className="coin-grid">
            {coins.map((coin) => (
              <article className="coin-card" key={coin.id}>
                <div className="coin-stage">
                  <CoinFace coin={coin} />
                  <span className="grade">{coin.grade}</span>
                </div>
                <div className="coin-info">
                  <div className="coin-title">
                    <div>
                      <h3>{coin.title}</h3>
                      <p>{coin.subtitle}</p>
                    </div>
                    <strong>{coin.year}</strong>
                  </div>
                  <div className="coin-meta"><span>{coin.country}</span><i /><span>{coin.metal}</span></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
