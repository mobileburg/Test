import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  type Coin,
  type CoinDraft,
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
import AuthScreen from './AuthScreen'
import { queueRecognitionFeedback } from './learning/feedback'
import { recognizeCoin, type RecognitionResult } from './recognition/api'

const formatPrice = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

function CoinFace({ coin, large = false }: { coin: Coin; large?: boolean }) {
  if (coin.image) return <img className={`coin-photo ${large ? 'large' : ''}`} src={coin.image} alt={coin.title} />
  return (
    <div className={`coin-face ${coin.color} ${large ? 'large' : ''}`} aria-label={`${coin.title}, ${coin.year}`}>
      <div className="coin-ring">
        <span className="coin-mark">{coin.mark}</span>
        <small>{coin.year}</small>
      </div>
    </div>
  )
}

function Scanner({ onClose, onAdd }: { onClose: () => void; onAdd: (draft: CoinDraft, photo?: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'pick' | 'analyzing' | 'result' | 'error'>('pick')
  const [preview, setPreview] = useState('')
  const [photoFile, setPhotoFile] = useState<File | undefined>()
  const [error, setError] = useState('')
  const [match, setMatch] = useState<RecognitionResult | null>(null)
  const [learningConsent, setLearningConsent] = useState(false)
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

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = async () => {
      setPreview(String(reader.result))
      setStep('analyzing')
      try {
        const response = await recognizeCoin(file)
        const result = response.results[0]
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
        setStep('result')
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Не удалось распознать монету')
        setStep('error')
      }
    }
    reader.readAsDataURL(file)
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
      await onAdd(draft, photoFile)
      if (learningConsent) {
        queueRecognitionFeedback({
          coinId: Date.now(),
          prediction: {
            title: match?.title ?? draft.title,
            country: match?.country ?? draft.country,
            year: match?.year ?? draft.year,
            metal: match?.metal ?? draft.metal,
          },
          correction: {
            title: draft.title,
            country: draft.country,
            year: draft.year,
            metal: draft.metal,
          },
        })
      }
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
            <p className="scanner-lead">Сфотографируйте аверс при хорошем освещении. Для более точного результата загрузите также реверс.</p>
            <div className="upload-zone" onClick={() => inputRef.current?.click()}>
              <div className="upload-coin"><ImagePlus size={30} /></div>
              <strong>Перетащите изображение сюда</strong>
              <span>или выберите JPG, PNG, WEBP до 15 МБ</span>
              <button className="outline-button" type="button"><Upload size={17} /> Выбрать файл</button>
            </div>
            <button className="camera-button" onClick={() => cameraRef.current?.click()}><Camera size={19} /> Сделать фото</button>
            <input ref={inputRef} hidden type="file" accept="image/*" onChange={chooseFile} />
            <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile} />
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
              <img src={preview} alt="Монета" />
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
            <label className="learning-consent">
              <input type="checkbox" checked={learningConsent} onChange={(event) => setLearningConsent(event.target.checked)} />
              <span><strong>Помочь улучшить распознавание</strong><small>Сохранить исправления в локальной очереди обучения. Ничего не отправляется без вашего действия.</small></span>
            </label>
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

  const addCoin = async (draft: CoinDraft, photo?: File) => {
    const created = await createCoin(draft, photo)
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
  }

  if (!authReady) {
    return (
      <div className="auth-screen">
        <section className="auth-card"><p className="auth-lead">Загружаем кабинет…</p></section>
      </div>
    )
  }

  if (!session) return <AuthScreen onSuccess={handleAuth} />

  return (
    <div className="app-shell">
      <header>
        <a className="logo" href="#" aria-label="Нумизмат, главная">
          <span className="logo-coin">Н</span>
          <span>Нумизмат<small>Ваша коллекция монет</small></span>
        </a>
        <nav className={menuOpen ? 'open' : ''}>
          <a className="active" href="#" onClick={() => setMenuOpen(false)}>Главная</a>
          <a href="#collection" onClick={() => setMenuOpen(false)}>Моя коллекция</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>Как это работает</a>
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
            <button className="primary-button" onClick={() => setScannerOpen(true)}><Plus size={18} /> Добавить монету</button>
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
                <article className="coin-card" key={coin.id}>
                  <div className="coin-stage">
                    <CoinFace coin={coin} />
                    <span className="grade">{coin.grade}</span>
                    <button className="coin-delete" type="button" aria-label="Удалить монету" onClick={() => removeCoin(coin.id)}><Trash2 size={14} /></button>
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
      <footer><div className="logo"><span className="logo-coin">Н</span><span>Нумизмат<small>История в каждой монете</small></span></div><p>Коллекция хранится в личном кабинете на сервере · Версия 0.2</p></footer>
      {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} onAdd={addCoin} />}
    </div>
  )
}
