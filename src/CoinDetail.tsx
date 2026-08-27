import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Coin } from './api'
import { CoinFace } from './CoinFace'

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

export default function CoinDetail({ coin, onBack }: { coin: Coin; onBack: () => void }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [coin.id])

  const title = displayText(coin.title)
  const year = displayYear(coin.year)
  const subtitle = displayText(coin.subtitle)
  const country = displayText(coin.country)
  const metal = displayText(coin.metal)
  const grade = displayText(coin.grade)

  return (
    <main className="coin-detail-page">
      <div className="coin-detail-bar">
        <button className="ghost-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> К коллекции
        </button>
      </div>
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
