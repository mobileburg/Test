import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, Copy, Link2, Share2, Trash2, Users } from 'lucide-react'
import {
  type Coin,
  type ShareLink,
  createShare,
  fetchShareInbox,
  fetchSharedCollection,
  fetchShares,
  revokeCoinImages,
  revokeShare,
} from './api'
import CoinDetail from './CoinDetail'
import { CoinFace } from './CoinFace'

function formatCreated(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ru-RU')
}

function accessLabel(access: ShareLink['access']) {
  return access === 'write' ? 'Просмотр (запись позже)' : 'Только просмотр'
}

export function readShareToken() {
  const match = window.location.pathname.match(/^\/share\/([^/?#]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.left = '-9999px'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  }
}

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [shares, setShares] = useState<ShareLink[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [freshUrl, setFreshUrl] = useState('')

  const reload = async () => {
    const list = await fetchShares()
    setShares(list)
  }

  useEffect(() => {
    if (!open) return
    setError('')
    setFreshUrl('')
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchShares()
        if (!cancelled) setShares(list)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить доступы')
      }
    })()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const markCopied = async (share: ShareLink) => {
    const url = `${window.location.origin}/share/${share.token}`
    const ok = await copyText(url)
    if (ok) {
      setCopiedId(share.id)
      setFreshUrl(url)
    } else {
      setError('Не удалось скопировать — скопируйте ссылку вручную')
      setFreshUrl(url)
    }
  }

  const createLink = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const created = await createShare({ access: 'read' })
      setShares((prev) => [created, ...prev])
      await markCopied(created)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать ссылку')
    } finally {
      setPending(false)
    }
  }

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      const created = await createShare({ access: 'read', email: email.trim() })
      await reload()
      setEmail('')
      await markCopied(created)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить приглашение')
    } finally {
      setPending(false)
    }
  }

  const revoke = async (id: number) => {
    if (!confirm('Отозвать доступ по этой ссылке?')) return
    try {
      await revokeShare(id)
      setShares((prev) => prev.filter((item) => item.id !== id))
      if (copiedId === id) setCopiedId(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отозвать доступ')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button className="icon-button close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
        <p className="eyebrow">Доступ к коллекции</p>
        <h2 id="share-title">Поделиться</h2>
        <p className="share-lead">Создайте ссылку — гость увидит фото и названия, но не сможет удалять монеты. Запись в чужую коллекцию пока не включена.</p>
        <button className="primary-button" type="button" onClick={createLink} disabled={pending}>
          <Link2 size={16} /> {pending ? 'Создаём…' : 'Создать ссылку для просмотра'}
        </button>
        {freshUrl && (
          <label className="share-copy-field">
            Ссылка
            <span>
              <input readOnly value={freshUrl} />
              <button className="ghost-button" type="button" onClick={() => copyText(freshUrl)}>
                <Copy size={14} /> {copiedId ? 'Скопировано' : 'Копировать'}
              </button>
            </span>
          </label>
        )}
        <form className="share-invite" onSubmit={invite}>
          <label>
            Пригласить по email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="friend@example.com"
              required
            />
          </label>
          <button className="outline-button" type="submit" disabled={pending}>Открыть доступ</button>
        </form>
        {error && <p className="auth-error">{error}</p>}
        <h3 className="share-list-title">Выданные доступы</h3>
        {shares.length === 0 ? (
          <p className="admin-muted">Пока никому не открывали коллекцию</p>
        ) : (
          <ul className="share-list">
            {shares.map((share) => (
              <li key={share.id}>
                <div>
                  <strong>{share.email || 'Ссылка без email'}</strong>
                  <small>{accessLabel(share.access)} · {formatCreated(share.created)}</small>
                </div>
                <div className="share-list-actions">
                  <button className="ghost-button" type="button" onClick={() => markCopied(share)}>
                    <Copy size={14} /> {copiedId === share.id ? 'Скопировано' : 'Копировать'}
                  </button>
                  <button className="ghost-button" type="button" aria-label="Отозвать" onClick={() => revoke(share.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function SharedInbox({ onOpen }: { onOpen: (token: string) => void }) {
  const [items, setItems] = useState<ShareLink[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchShareInbox()
        if (!cancelled) setItems(list)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить список')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <main>
      <section className="admin-panel" id="inbox">
        <div className="section-heading">
          <div>
            <p className="kicker"><span /> Доступ</p>
            <h2>Мне открыли</h2>
            <p>Коллекции, которыми с вами поделились по email. Можно только смотреть.</p>
          </div>
        </div>
        {error && <p className="auth-error admin-error">{error}</p>}
        {loading && <p className="admin-muted">Загружаем открытые коллекции…</p>}
        {!loading && items.length === 0 && (
          <div className="empty">
            <Users size={28} />
            <h3>Пока ничего не открыли</h3>
            <p>Когда кто-то пригласит ваш email, коллекция появится здесь. Ссылку можно открыть и без входа.</p>
          </div>
        )}
        {items.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Владелец</th>
                  <th>Доступ</th>
                  <th>Монет</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button className="admin-user-link" type="button" onClick={() => onOpen(item.token)}>
                        <Share2 size={14} />
                        {item.ownerEmail}
                      </button>
                    </td>
                    <td>{accessLabel(item.access)}</td>
                    <td>{item.coinsCount ?? 0}</td>
                    <td>{formatCreated(item.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export function SharedCollectionPage({
  token,
  onBack,
  backLabel = 'На главную',
}: {
  token: string
  onBack: () => void
  backLabel?: string
}) {
  const [coins, setCoins] = useState<Coin[]>([])
  const [ownerEmail, setOwnerEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Coin | null>(null)

  useEffect(() => {
    let cancelled = false
    setSelected(null)
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const payload = await fetchSharedCollection(token)
        if (cancelled) {
          revokeCoinImages(payload.coins)
          return
        }
        setCoins((prev) => {
          revokeCoinImages(prev)
          return payload.coins
        })
        setOwnerEmail(payload.owner?.email ?? '')
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Не удалось открыть коллекцию')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    return () => { revokeCoinImages(coins) }
  }, [coins])

  if (selected) {
    return <CoinDetail coin={selected} onBack={() => setSelected(null)} />
  }

  return (
    <main>
      <section className="collection share-collection" id="shared">
        <div className="section-heading">
          <div>
            <p className="kicker"><span /> Открытая коллекция</p>
            <h2>{ownerEmail || 'Коллекция по ссылке'}</h2>
            <p>Только просмотр: фото и названия. Удалять чужие монеты нельзя.</p>
          </div>
          <button className="ghost-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>
        {error && <p className="auth-error admin-error">{error}</p>}
        {loading && <p className="admin-muted">Загружаем коллекцию…</p>}
        {!loading && !error && coins.length === 0 && (
          <div className="empty">
            <Share2 size={28} />
            <h3>Коллекция пуста</h3>
            <p>Владелец ещё не добавил монеты</p>
          </div>
        )}
        {coins.length > 0 && (
          <div className="coin-grid">
            {coins.map((coin) => (
              <article
                className="coin-card"
                key={coin.id}
                role="link"
                tabIndex={0}
                aria-label={`${coin.title}, открыть карточку`}
                onClick={() => setSelected(coin)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelected(coin)
                  }
                }}
              >
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
