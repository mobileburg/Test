import { Camera, ImagePlus } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { coinSideImage, type Coin, type CoinSide } from './api'

export function CoinFace({
  coin,
  large = false,
  side = 'obverse',
}: {
  coin: Coin
  large?: boolean
  side?: CoinSide
}) {
  const src = coinSideImage(coin, side) || (side === 'obverse' ? coin.imageReverse : undefined)
  if (src) {
    return (
      <img
        className={`coin-photo ${large ? 'large' : ''}`}
        src={src}
        alt={side === 'reverse' ? `${coin.title}, реверс` : coin.title}
      />
    )
  }
  return (
    <div className={`coin-face ${coin.color} ${large ? 'large' : ''}`} aria-label={`${coin.title}, ${coin.year}`}>
      <div className="coin-ring">
        <span className="coin-mark">{coin.mark}</span>
        <small>{coin.year}</small>
      </div>
    </div>
  )
}

export function CoinSidesThumb({ coin }: { coin: Coin }) {
  if (!coinSideImage(coin, 'reverse')) return <CoinFace coin={coin} />
  return (
    <div className="coin-sides-thumb">
      <CoinFace coin={coin} side="obverse" />
      <CoinFace coin={coin} side="reverse" />
    </div>
  )
}

export function CoinPhotoSlot({
  coin,
  side,
  preview,
  canEdit = false,
  busy = false,
  onFile,
}: {
  coin?: Coin
  side: CoinSide
  preview?: string
  canEdit?: boolean
  busy?: boolean
  onFile?: (side: CoinSide, file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const src = preview || (coin ? coinSideImage(coin, side) : undefined)
  const label = side === 'reverse' ? 'Реверс' : 'Аверс'
  const title = coin?.title || label

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && onFile) onFile(side, file)
  }

  return (
    <div className="coin-slot">
      <div className="coin-slot-podium">
        {src ? (
          <img className="coin-photo large" src={src} alt={`${label}: ${title}`} />
        ) : canEdit ? (
          <button
            type="button"
            className="coin-slot-empty"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={22} />
            <span>Добавить фото</span>
          </button>
        ) : (
          <div className="coin-slot-empty" aria-label={`${label}: нет фото`}>
            <span>Нет фото</span>
          </div>
        )}
      </div>
      <span className="coin-slot-label">{label}</span>
      {canEdit && (
        <div className="coin-slot-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera size={14} /> Камера
          </button>
          <button type="button" className="ghost-button" disabled={busy} onClick={() => fileRef.current?.click()}>
            Файл
          </button>
        </div>
      )}
      {canEdit && (
        <>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={pick} />
          <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={pick} />
        </>
      )}
    </div>
  )
}
