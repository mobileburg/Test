import type { Coin } from './api'

export function CoinFace({ coin, large = false }: { coin: Coin; large?: boolean }) {
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
