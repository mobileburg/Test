import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Share2 } from 'lucide-react'
import { createShare, hasSessionToken, type Coin } from './api'
import { CoinFace } from './CoinFace'

function isShareRoute() {
  return /^\/share\/[^/?#]+\/?$/.test(window.location.pathname)
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

function displayText(value: string | number | null | undefined, fallback = 'Не указана') {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

function displayYear(year: number | null | undefined) {
  if (!year || !Number.isFinite(year) || year <= 0) return 'Не указана'
  return String(year)
}

function formatPrice(value: number | null | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return '0 ₽'
  return new Intl.NumberFormat('ru-RU').format(value as number) + ' ₽'
}

export default function CoinDetail({
  coin,
  onBack,
  backLabel = 'К коллекции',
}: {
  coin: Coin
  onBack: () => void
  backLabel?: string
}) {
  const canShare = hasSessionToken() && !isShareRoute()
  const [shareUrl, setShareUrl] = useState('')
  const [shareError, setShareError] = useState('')
  const [sharePending, setSharePending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [coin.id])

  useEffect(() => {
    setShareUrl('')
    setShareError('')
    setCopied(false)
  }, [coin.id])

  const title = displayText(coin.title)
  const year = displayYear(coin.year)
  const subtitle = displayText(coin.subtitle)
  const country = displayText(coin.country)
  const metal = displayText(coin.metal)
  const grade = displayText(coin.grade)

  const shareCoin = async () => {
    if (sharePending) return
    setSharePending(true)
    setShareError('')
    try {
      const created = await createShare({ access: 'read', coinId: coin.id })
      const url = created.url || `${window.location.origin}/share/${created.token}`
      setShareUrl(url)
      const ok = await copyText(url)
      setCopied(ok)
      if (!ok) setShareError('Не удалось скопировать — скопируйте ссылку вручную')
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'Не удалось создать ссылку')
    } finally {
      setSharePending(false)
    }
  }

  return (
    <main className="coin-detail-page">
      <div className="coin-detail-bar">
        <button className="ghost-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> {backLabel}
        </button>
        {canShare && (
          <button className="ghost-button" type="button" onClick={shareCoin} disabled={sharePending}>
            <Share2 size={16} /> {sharePending ? 'Создаём…' : 'Поделиться монетой'}
          </button>
        )}
      </div>
      {canShare && (shareUrl || shareError) && (
        <div className="coin-share-box">
          {shareUrl && (
            <label className="share-copy-field">
              Ссылка на монету
              <span>
                <input readOnly value={shareUrl} />
                <button className="ghost-button" type="button" onClick={async () => {
                  const ok = await copyText(shareUrl)
                  setCopied(ok)
                }}>
                  <Copy size={14} /> {copied ? 'Скопировано' : 'Копировать'}
                </button>
              </span>
            </label>
          )}
          {shareError && <p className="auth-error">{shareError}</p>}
        </div>
      )}
      <article className="detail-card" aria-labelledby="coin-detail-title">
        <div className="detail-stage">
          <span className="detail-grade">{grade}</span>
          <div className="detail-podium">
            <CoinFace coin={coin} large />
          </div>
        </div>
        <div className="detail-info">
          <div className="detail-headline">
            <h1 id="coin-detail-title">{title}</h1>
            <strong className="detail-year">{year}</strong>
          </div>
          <p className="detail-subtitle">{subtitle}</p>
          <p className="detail-origin">{country} • {metal}</p>
          <div className="detail-value">
            <span>Оценка</span>
            <strong>{formatPrice(coin.value)}</strong>
          </div>
        </div>
      </article>
    </main>
  )
}
