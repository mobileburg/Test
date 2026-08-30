import { useEffect, useMemo, useState } from 'react'
import {
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Grid2X2,
  ImagePlus,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  type Coin,
  type CoinDraft,
  type CoinPhotos,
  type CoinSide,
  type User,
  createCoin,
  deleteCoin,
  fetchCoins,
  fetchMe,
  hasSessionToken,
  importLocalCoinsIfNeeded,
  logoutAccount,
  readCachedCoins,
  readCachedUser,
  revokeCoinImages,
  writeCachedCoins,
} from './api'
import AdminScreen from './AdminScreen'
import AuthScreen, { readPasswordResetToken } from './AuthScreen'
import CoinDetail from './CoinDetail'
import { CoinFace, CoinPhotoSlot } from './CoinFace'
import { ShareDialog, SharedCollectionPage, SharedInbox, readShareToken } from './ShareScreen'
import { queueRecognitionFeedback, submitRecognitionFeedback } from './learning/feedback'
import { recognizeCoin, type RecognitionResult } from './recognition/api'

const formatPrice = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

function Scanner({
  onClose,
  onAdd,
  isAdmin,
}: {
  onClose: () => void
  onAdd: (draft: CoinDraft, photos?: File | CoinPhotos) => Promise<void>
  isAdmin: boolean
}) {
  const [step, setStep] = useState<'pick' | 'analyzing' | 'result' | 'error'>('pick')
  const [preview, setPreview] = useState('')
  const [photoFile, setPhotoFile] = useState<File | undefined>()
  const [reversePreview, setReversePreview] = useState('')
  const [reverseFile, setReverseFile] = useState<File | undefined>()
  const [error, setError] = useState('')
  const [match, setMatch] = useState<RecognitionResult | null>(null)
  const [comment, setComment] = useState('')
  const [retryWrong, setRetryWrong] = useState(false)
  const [excludedCatalogs, setExcludedCatalogs] = useState<string[]>([])
  const [feedbackNote, setFeedbackNote] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    country: 'Россия',
    year: '',
    metal: '',
    grade: 'Не указана',
    value: '0',
  })

  const chooseSide = (side: CoinSide, file: File) => {
    if (side === 'reverse') {
      setReverseFile(file)
      const reader = new FileReader()
      reader.onload = () => setReversePreview(String(reader.result))
      reader.readAsDataURL(file)
      return
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = async () => {
      setPreview(String(reader.result))
      setStep('analyzing')
      try {
        const response = await recognizeCoin(file)
        const result = response.results[0]
        setMatch(result)
        setExcludedCatalogs([])
        setComment('')
        setRetryWrong(false)
        setFeedbackNote('')
        setForm({
          title: result.title,
          subtitle: result.subtitle,
          country: result.country,
          year: String(result.year),
          metal: result.metal,
          grade: 'Не указана',
          value: '0',
        })
        setStep('result')
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Не удалось распознать монету')
        setStep('error')
      }
    }
    reader.readAsDataURL(file)
  }

  const applyResult = (result: RecognitionResult) => {
    setMatch(result)
    setForm({
      title: result.title,
      subtitle: result.subtitle,
      country: result.country,
      year: String(result.year),
      metal: result.metal,
      grade: 'Не указана',
      value: '0',
    })
  }

  const sendFeedback = async (verdict: 'correct' | 'incorrect') => {
    if (!match || !photoFile || feedbackBusy) return
    setFeedbackBusy(true)
    setError('')
    const retry = verdict === 'incorrect' && retryWrong
    const prediction = {
      title: match.title,
      country: match.country,
      year: match.year,
      metal: match.metal,
    }
    const correction = {
      title: form.title,
      country: form.country,
      year: Number(form.year) || match.year,
      metal: form.metal,
    }
    try {
      const saved = await submitRecognitionFeedback({
        photo: photoFile,
        predictedCatalog: match.catalogNumber,
        predictedTitle: match.title,
        predicted: { ...match },
        verdict,
        comment,
        retry,
      })
      queueRecognitionFeedback({
        coinId: Date.now(),
        prediction,
        correction,
        reviewStatus: saved.reviewStatus,
      })
      if (isAdmin) {
        setFeedbackNote('Оценка принята как истина и попадёт в следующее обучение без модерации.')
      } else {
        setFeedbackNote('Оценка сохранена и ждёт проверки администратора. В обучение она не пойдёт, пока её не одобрят.')
      }
      if (retry) {
        const nextExcluded = [...excludedCatalogs, match.catalogNumber]
        setExcludedCatalogs(nextExcluded)
        setStep('analyzing')
        try {
          const response = await recognizeCoin(photoFile, {
            excludeCatalogs: nextExcluded,
            excludeIds: [saved.id],
          })
          const result = response.results[0]
          applyResult(result)
          setComment('')
          setRetryWrong(false)
          setFeedbackNote(
            isAdmin
              ? `Предыдущий вариант ${match.catalogNumber} исключён. Новая оценка администратора снова будет принята сразу.`
              : `Предыдущий вариант ${match.catalogNumber} исключён. Проверьте новый результат.`,
          )
          setStep('result')
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Других вариантов в каталоге нет')
          setStep('error')
        }
      }
    } catch (reason) {
      setFeedbackNote(reason instanceof Error ? reason.message : 'Не удалось отправить оценку')
    } finally {
      setFeedbackBusy(false)
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    const draft: CoinDraft = {
      ...form,
      year: Number(form.year),
      value: Number(form.value),
      color: 'silver',
      mark: '₽',
    }
    try {
      await onAdd(draft, { obverse: photoFile, reverse: reverseFile })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить монету')
      setStep('error')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="scanner" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <button className="icon-button close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        {step === 'pick' && (
          <>
            <div className="scanner-icon"><Sparkles size={26} /></div>
            <p className="eyebrow">Умное распознавание</p>
            <h2 id="scanner-title">Добавьте фото монеты</h2>
            <p className="scanner-lead">Сначала снимите или загрузите аверс — по нему распознаём монету. Реверс можно добавить сразу или позже, по очереди.</p>
            <div className="scanner-sides">
              <CoinPhotoSlot side="obverse" preview={preview} canEdit onFile={chooseSide} />
              <CoinPhotoSlot side="reverse" preview={reversePreview} canEdit onFile={chooseSide} />
            </div>
            <div className="privacy"><Check size={15} /> Изображение используется только для распознавания</div>
          </>
        )}
        {step === 'analyzing' && (
          <div className="analyzing">
            <div className="preview-wrap"><img src={preview} alt="Загруженная монета" /><div className="scan-line" /></div>
            <div className="loader"><span /><span /><span /></div>
            <h2>Изучаем монету…</h2>
            <p>Считываем надписи, год и детали чеканки</p>
          </div>
        )}
        {step === 'error' && (
          <div className="recognition-error">
            <div className="scanner-icon"><CircleHelp size={26} /></div>
            <p className="eyebrow">Распознавание не выполнено</p>
            <h2>Не удалось определить монету</h2>
            <p>{error}</p>
            <button className="primary-button" onClick={() => setStep('pick')}>Попробовать другое фото</button>
          </div>
        )}
        {step === 'result' && (
          <div className="result">
            <div className="result-heading">
              <div><p className="eyebrow success"><Check size={13} /> Найдено совпадение · {Math.round((match?.confidence ?? 0) * 100)}%</p><h2>Проверьте результат</h2></div>
            </div>
            <div className="scanner-sides result-sides">
              <CoinPhotoSlot side="obverse" preview={preview} canEdit onFile={chooseSide} />
              <CoinPhotoSlot side="reverse" preview={reversePreview} canEdit onFile={chooseSide} />
            </div>
            <div className="source-note"><Sparkles size={16} /><span><strong>Источник: Банк России.</strong> Каталожный № {match?.catalogNumber}. <a href={match?.sourceUrl} target="_blank" rel="noreferrer">Открыть эталон</a></span></div>
            <div className="form-grid">
              <label className="span-2">Номинал<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="span-2">Описание<input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></label>
              <label>Страна<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
              <label>Год<input inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
              <label>Металл<input value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })} /></label>
              <label>Сохранность<input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></label>
              <label className="span-2">Оценочная стоимость, ₽<input inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
            </div>
            <div className="feedback-panel">
              <p className="feedback-title">Оценка распознавания</p>
              <p className="feedback-lead">Это поможет ИИ учиться. Напишите, что верно, а что нет.</p>
              <label className="feedback-comment">
                Комментарий
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  placeholder="Что правильно, что нет, какой должна быть монета"
                />
              </label>
              <label className="feedback-retry">
                <input type="checkbox" checked={retryWrong} onChange={(event) => setRetryWrong(event.target.checked)} />
                <span>Попробуй распознать ещё, этот вариант неверный</span>
              </label>
              <div className="feedback-verdict">
                <button type="button" className="primary-button" disabled={feedbackBusy} onClick={() => sendFeedback('correct')}>
                  Верно
                </button>
                <button type="button" className="outline-button" disabled={feedbackBusy} onClick={() => sendFeedback('incorrect')}>
                  Неверно
                </button>
              </div>
              {feedbackNote && <p className="feedback-status">{feedbackNote}</p>}
              {isAdmin && <p className="feedback-admin-hint">Ваша оценка как администратора принимается сразу, без очереди модерации.</p>}
            </div>
            <div className="result-actions">
              <button className="text-button" onClick={() => setStep('pick')}>Загрузить другое фото</button>
              <button className="primary-button" onClick={save} disabled={saving}><Plus size={18} /> {saving ? 'Сохраняем…' : 'Добавить в коллекцию'}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const resetToken = readPasswordResetToken()
  const [session, setSession] = useState<User | null>(readCachedUser)
  const [authReady, setAuthReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [coins, setCoins] = useState<Coin[]>(readCachedCoins)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('Все страны')
  const [metal, setMetal] = useState('Все металлы')
  const [sort, setSort] = useState('Сначала новые')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState<'cabinet' | 'admin' | 'inbox'>('cabinet')
  const [selectedCoinId, setSelectedCoinId] = useState<number | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(readShareToken)

  const replaceCoins = (next: Coin[]) => {
    setCoins((prev) => {
      revokeCoinImages(prev)
      return next
    })
    writeCachedCoins(next)
  }

  const loadCollection = async () => {
    try {
      const imported = await importLocalCoinsIfNeeded()
      replaceCoins(imported ?? await fetchCoins())
      setOffline(false)
    } catch {
      setOffline(true)
      setCoins(readCachedCoins())
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSessionToken()) {
        if (!cancelled) {
          setSession(null)
          setAuthReady(true)
        }
        return
      }
      try {
        const user = await fetchMe()
        if (cancelled) return
        setSession(user)
        await loadCollection()
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase()
    const result = coins.filter((coin) =>
      `${coin.title} ${coin.subtitle} ${coin.country} ${coin.year}`.toLowerCase().includes(normalized)
      && (country === 'Все страны' || coin.country === country)
      && (metal === 'Все металлы' || coin.metal === metal),
    )
    return [...result].sort((a, b) => sort === 'По стоимости' ? b.value - a.value : sort === 'Сначала старые' ? a.year - b.year : b.id - a.id)
  }, [coins, query, country, metal, sort])

  const countries = ['Все страны', ...new Set(coins.map((coin) => coin.country))]
  const metals = ['Все металлы', ...new Set(coins.map((coin) => coin.metal))]
  const total = coins.reduce((sum, coin) => sum + coin.value, 0)
  const selectedCoin = selectedCoinId == null ? null : coins.find((coin) => coin.id === selectedCoinId) ?? null

  useEffect(() => {
    const onPop = () => setShareToken(readShareToken())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const leaveShareUrl = () => {
    if (readShareToken()) history.pushState({}, '', '/')
    setShareToken(null)
  }

  const goCabinet = () => {
    leaveShareUrl()
    setPage('cabinet')
    setSelectedCoinId(null)
    setMenuOpen(false)
    setShareOpen(false)
  }

  const goInbox = () => {
    leaveShareUrl()
    setPage('inbox')
    setSelectedCoinId(null)
    setMenuOpen(false)
    setShareOpen(false)
  }

  const openShared = (token: string) => {
    history.pushState({}, '', `/share/${token}`)
    setShareToken(token)
    setSelectedCoinId(null)
    setMenuOpen(false)
    setShareOpen(false)
  }

  const addCoin = async (draft: CoinDraft, photos?: File | CoinPhotos) => {
    const created = await createCoin(draft, photos)
    setCoins((prev) => {
      const next = [created, ...prev]
      writeCachedCoins(next)
      return next
    })
    setScannerOpen(false)
  }

  const removeCoin = async (id: number) => {
    if (!confirm('Удалить монету из коллекции на сервере?')) return
    await deleteCoin(id)
    setCoins((prev) => {
      const removed = prev.filter((coin) => coin.id === id)
      revokeCoinImages(removed)
      const next = prev.filter((coin) => coin.id !== id)
      writeCachedCoins(next)
      return next
    })
  }

  const handleAuth = async (user: User) => {
    setSession(user)
    await loadCollection()
  }

  const handleLogout = async () => {
    revokeCoinImages(coins)
    await logoutAccount()
    setSession(null)
    setCoins([])
    writeCachedCoins([])
    setMenuOpen(false)
    setPage('cabinet')
    setSelectedCoinId(null)
    setShareOpen(false)
    leaveShareUrl()
  }

  if (resetToken) return <AuthScreen onSuccess={handleAuth} resetToken={resetToken} />

  if (!authReady) {
    return (
      <div className="auth-screen">
        <section className="auth-card"><p className="auth-lead">Загружаем кабинет…</p></section>
      </div>
    )
  }

  if (shareToken) {
    return (
      <div className="app-shell">
        <header>
          <a className="logo" href="#" aria-label="Нумизмат, главная" onClick={(event) => { event.preventDefault(); goCabinet() }}>
            <span className="logo-coin">Н</span>
            <span>Нумизмат<small>Открытая коллекция</small></span>
          </a>
          {session ? (
            <div className="account-bar">
              <span className="account-email" title={session.email}>{session.email}</span>
              <button className="ghost-button" onClick={handleLogout}><LogOut size={16} /> Выйти</button>
            </div>
          ) : (
            <div className="account-bar">
              <button className="ghost-button" type="button" onClick={goCabinet}>Войти</button>
            </div>
          )}
        </header>
        <SharedCollectionPage
          token={shareToken}
          onBack={goCabinet}
          backLabel={session ? 'К кабинету' : 'На главную'}
        />
        <footer><div className="logo"><span className="logo-coin">Н</span><span>Нумизмат<small>История в каждой монете</small></span></div><p>Коллекция открыта по ссылке · только просмотр</p></footer>
      </div>
    )
  }

  if (!session) return <AuthScreen onSuccess={handleAuth} />

  return (
    <div className="app-shell">
      <header>
        <a className="logo" href="#" aria-label="Нумизмат, главная" onClick={(event) => { event.preventDefault(); goCabinet() }}>
          <span className="logo-coin">Н</span>
          <span>Нумизмат<small>Ваша коллекция монет</small></span>
        </a>
        <nav className={menuOpen ? 'open' : ''}>
          <a className={page === 'cabinet' && !selectedCoinId ? 'active' : ''} href="#" onClick={goCabinet}>Главная</a>
          <a href="#collection" onClick={goCabinet}>Моя коллекция</a>
          <a className={page === 'inbox' ? 'active' : ''} href="#inbox" onClick={(event) => { event.preventDefault(); goInbox() }}>Мне открыли</a>
          {session.role === 'admin' && (
            <a className={page === 'admin' ? 'active' : ''} href="#admin" onClick={() => { setPage('admin'); setSelectedCoinId(null); setMenuOpen(false) }}>Админка</a>
          )}
          <a href="#about" onClick={goCabinet}>Как это работает</a>
        </nav>
        <div className="account-bar">
          <span className="account-email" title={session.email}>{session.email}</span>
          <button className="ghost-button" onClick={handleLogout}><LogOut size={16} /> Выйти</button>
        </div>
        <button className="help-button"><CircleHelp size={18} /> Как это работает</button>
        <button className="menu-button" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {page === 'admin' && session.role === 'admin' ? (
        <AdminScreen />
      ) : page === 'inbox' ? (
        <SharedInbox onOpen={openShared} />
      ) : selectedCoin ? (
        <CoinDetail
          coin={selectedCoin}
          onBack={goCabinet}
          canEditPhotos
          onCoinChange={(updated) => {
            setCoins((prev) => {
              revokeCoinImages(prev.filter((item) => item.id === updated.id))
              const next = prev.map((item) => (item.id === updated.id ? updated : item))
              writeCachedCoins(next)
              return next
            })
          }}
        />
      ) : (
      <main>
        {offline && <div className="offline-banner">Показана копия с этого устройства. Нет связи с сервером — изменения появятся после входа при восстановлении связи.</div>}
        <section className="hero">
          <div>
            <p className="kicker"><span /> Личный кабинет</p>
            <h1>Монеты, которые<br />рассказывают <em>историю</em></h1>
            <p className="hero-copy">Оцифруйте коллекцию, узнайте больше о каждой монете и сохраните карточки и фото на сервере — они будут доступны после входа с любого устройства.</p>
            <button className="primary-button hero-button" onClick={() => setScannerOpen(true)}><Camera size={20} /> Распознать монету</button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-coin coin-a"><div>₽<small>1897</small></div></div>
            <div className="floating-coin coin-b"><div>5<small>РУБЛЕЙ</small></div></div>
            <div className="sparkle s-one">✦</div><div className="sparkle s-two">✦</div>
          </div>
        </section>

        <section className="stats">
          <div><span className="stat-icon"><LayoutGrid size={21} /></span><p><strong>{coins.length}</strong><small>монет в коллекции</small></p></div>
          <div><span className="stat-icon"><Grid2X2 size={21} /></span><p><strong>{new Set(coins.map((coin) => coin.country)).size}</strong><small>стран и эпох</small></p></div>
          <div><span className="stat-icon ruble">₽</span><p><strong>{formatPrice(total)}</strong><small>оценочная стоимость</small></p></div>
        </section>

        <section className="collection" id="collection">
          <div className="section-heading">
            <div><p className="kicker"><span /> Каталог</p><h2>Моя коллекция</h2><p>Все ваши находки хранятся на сервере</p></div>
            <div className="heading-actions">
              <button className="outline-button" type="button" onClick={() => setShareOpen(true)}><Share2 size={18} /> Поделиться</button>
              <button className="primary-button" onClick={() => setScannerOpen(true)}><Plus size={18} /> Добавить монету</button>
            </div>
          </div>
          <div className="toolbar">
            <label className="search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию, году или стране…" /></label>
            <label className="select-wrap"><SlidersHorizontal size={16} /><select value={country} onChange={(e) => setCountry(e.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
            <label className="select-wrap"><select value={metal} onChange={(e) => setMetal(e.target.value)}>{metals.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
            <label className="select-wrap sort"><select value={sort} onChange={(e) => setSort(e.target.value)}><option>Сначала новые</option><option>Сначала старые</option><option>По стоимости</option></select><ChevronDown size={15} /></label>
            <div className="view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Плитка"><LayoutGrid size={18} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Список"><List size={18} /></button></div>
          </div>

          {filtered.length ? (
            <div className={`coin-grid ${view}`}>
              {filtered.map((coin) => (
                <article
                  className="coin-card"
                  key={coin.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`${coin.title}, открыть карточку`}
                  onClick={() => setSelectedCoinId(coin.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedCoinId(coin.id)
                    }
                  }}
                >
                  <div className="coin-stage">
                    <CoinFace coin={coin} />
                    <span className="grade">{coin.grade}</span>
                    <button className="coin-delete" type="button" aria-label="Удалить монету" onClick={(event) => { event.stopPropagation(); removeCoin(coin.id) }}><Trash2 size={14} /></button>
                  </div>
                  <div className="coin-info">
                    <div className="coin-title"><div><h3>{coin.title}</h3><p>{coin.subtitle}</p></div><strong>{coin.year}</strong></div>
                    <div className="coin-meta"><span>{coin.country}</span><i /><span>{coin.metal}</span></div>
                    <div className="coin-value"><span>Оценка</span><strong>{formatPrice(coin.value)}</strong></div>
                  </div>
                </article>
              ))}
            </div>
          ) : coins.length === 0 ? (
            <div className="empty">
              <ImagePlus size={28} />
              <h3>Коллекция пока пуста</h3>
              <p>Сфотографируйте монету или загрузите снимок — карточка сохранится в вашем кабинете</p>
              <button className="text-button" onClick={() => setScannerOpen(true)}>Добавить первую монету</button>
            </div>
          ) : (
            <div className="empty"><Search size={28} /><h3>Ничего не найдено</h3><p>Измените запрос или сбросьте фильтры</p><button className="text-button" onClick={() => { setQuery(''); setCountry('Все страны'); setMetal('Все металлы') }}>Сбросить фильтры</button></div>
          )}
        </section>

        <section className="how" id="about">
          <div><p className="kicker light"><span /> Быстро и просто</p><h2>От фотографии<br />до карточки монеты</h2></div>
          <div className="steps">
            <div><b>01</b><Camera /><h3>Сфотографируйте</h3><p>Сделайте чёткий снимок монеты с двух сторон</p></div>
            <div><b>02</b><Sparkles /><h3>Проверьте результат</h3><p>Мы предложим страну, номинал, год и металл</p></div>
            <div><b>03</b><Plus /><h3>Сохраните</h3><p>Карточка и фото попадут в ваш кабинет на сервере</p></div>
          </div>
        </section>
      </main>
      )}
      <footer><div className="logo"><span className="logo-coin">Н</span><span>Нумизмат<small>История в каждой монете</small></span></div><p>Коллекция хранится в личном кабинете на сервере · Версия 0.2</p></footer>
      {scannerOpen && page === 'cabinet' && <Scanner onClose={() => setScannerOpen(false)} onAdd={addCoin} isAdmin={session.role === 'admin'} />}
      {shareOpen && page === 'cabinet' && <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
