import { useEffect, useState } from 'react'
import { ArrowLeft, Check, GraduationCap, Shield, Users, X } from 'lucide-react'
import { type AdminUser, type Coin, fetchAdminUserCoins, fetchAdminUsers, revokeCoinImages } from './api'
import { CoinFace } from './CoinFace'
import {
  approveFeedback,
  fetchAdminFeedback,
  rejectFeedback,
  revokeFeedbackImages,
  type FeedbackItem,
  type FeedbackReviewStatus,
} from './learning/feedback'

function formatCreated(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ru-RU')
}

function roleLabel(role: AdminUser['role']) {
  return role === 'admin' ? 'Администратор' : 'Пользователь'
}

function verdictLabel(verdict: FeedbackItem['verdict']) {
  return verdict === 'correct' ? 'Верно' : 'Неверно'
}

function statusLabel(status: FeedbackItem['reviewStatus']) {
  if (status === 'approved') return 'Одобрено'
  if (status === 'rejected') return 'Отклонено'
  return 'На модерации'
}

function FeedbackQueue() {
  const [status, setStatus] = useState<FeedbackReviewStatus>('pending')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async (nextStatus = status) => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchAdminFeedback(nextStatus)
      setItems((prev) => {
        revokeFeedbackImages(prev)
        return list
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить очередь обучения')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(status)
    return () => { revokeFeedbackImages(items) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- загрузка при смене фильтра
  }, [status])

  const decide = async (item: FeedbackItem, action: 'approve' | 'reject') => {
    setBusyId(item.id)
    setError('')
    try {
      const updated = action === 'approve' ? await approveFeedback(item.id) : await rejectFeedback(item.id)
      setItems((prev) => {
        const next = prev.map((row) => (row.id === item.id ? { ...row, ...updated, photo: row.photo } : row))
        return status === 'pending' ? next.filter((row) => row.id !== item.id) : next
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить оценку')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="admin-filter">
        {([
          ['pending', 'На модерации'],
          ['approved', 'Одобрено'],
          ['rejected', 'Отклонено'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={status === value ? 'active' : ''}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="auth-error admin-error">{error}</p>}
      {loading && <p className="admin-muted">Загружаем очередь обучения…</p>}
      {!loading && items.length === 0 && (
        <div className="empty">
          <GraduationCap size={28} />
          <h3>{status === 'pending' ? 'Очередь пуста' : 'Записей нет'}</h3>
          <p>
            {status === 'pending'
              ? 'Обычные пользователи оставляют оценки после скана. Одобрите верные — они попадут в следующее обучение.'
              : 'Смените фильтр, чтобы увидеть другие оценки.'}
          </p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="feedback-queue">
          {items.map((item) => (
            <article className="feedback-card" key={item.id}>
              <div className="feedback-thumb">
                {item.photo ? <img src={item.photo} alt="Фото для обучения" /> : <span>Нет фото</span>}
              </div>
              <div className="feedback-body">
                <p className="feedback-meta">
                  <strong>{verdictLabel(item.verdict)}</strong>
                  <span>{statusLabel(item.reviewStatus)}</span>
                  {item.retry && <span>Повтор без этого класса</span>}
                </p>
                <h3>{item.predictedTitle || item.predictedCatalog}</h3>
                <p>Каталог: {item.predictedCatalog}</p>
                {item.comment && <p className="feedback-user-comment">{item.comment}</p>}
                <p className="admin-muted">{item.userEmail} · {formatCreated(item.createdAt)}</p>
                {item.reviewStatus === 'pending' && (
                  <div className="feedback-moderation">
                    <button type="button" className="primary-button" disabled={busyId === item.id} onClick={() => decide(item, 'approve')}>
                      <Check size={16} /> Одобрить
                    </button>
                    <button type="button" className="outline-button" disabled={busyId === item.id} onClick={() => decide(item, 'reject')}>
                      <X size={16} /> Отклонить
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export default function AdminScreen() {
  const [tab, setTab] = useState<'users' | 'learning'>('users')
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
            <h2>
              {tab === 'learning'
                ? 'Очередь обучения'
                : selected
                  ? 'Коллекция пользователя'
                  : 'Пользователи'}
            </h2>
            <p>
              {tab === 'learning'
                ? 'Правки обычных пользователей ждут модерации. Оценки администратора уже приняты как истина.'
                : selected
                  ? `${selected.email} · ${roleLabel(selected.role)} · ${selected.coinsCount} монет`
                  : 'Список кабинетов и коллекций. Доступно только администратору.'}
            </p>
          </div>
          {selected && tab === 'users' && (
            <button className="ghost-button" type="button" onClick={backToUsers}>
              <ArrowLeft size={16} /> К списку
            </button>
          )}
        </div>

        <div className="admin-tabs">
          <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            <Users size={16} /> Пользователи
          </button>
          <button type="button" className={tab === 'learning' ? 'active' : ''} onClick={() => { setTab('learning'); setSelected(null) }}>
            <GraduationCap size={16} /> Очередь обучения
          </button>
        </div>

        {tab === 'learning' ? <FeedbackQueue /> : (
        <>
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
        </>
        )}
      </section>
    </main>
  )
}
