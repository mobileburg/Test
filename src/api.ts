export type User = {
  id: number
  email: string
  role: 'user' | 'admin'
}

export type CoinSide = 'obverse' | 'reverse'

export type CoinPhotos = {
  obverse?: File
  reverse?: File
}

export type Coin = {
  id: number
  title: string
  subtitle: string
  country: string
  year: number
  metal: string
  grade: string
  value: number
  color: string
  mark: string
  hasPhoto?: boolean
  hasPhotoObverse?: boolean
  hasPhotoReverse?: boolean
  image?: string
  imageObverse?: string
  imageReverse?: string
}

export type AdminUser = {
  id: number
  email: string
  role: 'user' | 'admin'
  coinsCount: number
  created: string
}

export type ShareAccess = 'read' | 'write'
export type ShareScope = 'collection' | 'coin'

export type ShareLink = {
  id: number
  token: string
  url: string
  access: ShareAccess
  email: string | null
  userId: number | null
  created: string
  scope: ShareScope
  coinId: number | null
  coinTitle?: string | null
  ownerId?: number
  ownerEmail?: string
  coinsCount?: number
}

export type SharedCollection = {
  token: string
  access: ShareAccess
  scope?: ShareScope
  coinId?: number | null
  owner: { id: number; email: string } | null
  coins: Coin[]
}

export type CoinDraft = Omit<
  Coin,
  'id' | 'hasPhoto' | 'hasPhotoObverse' | 'hasPhotoReverse' | 'image' | 'imageObverse' | 'imageReverse'
>

const API_BASE = (import.meta.env.VITE_RECOGNITION_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'numismat-token'
const USER_KEY = 'numismat-user'
export const COINS_CACHE_KEY = 'numismat-coins'
function importedKey() {
  const user = readCachedUser()
  return `numismat-local-imported:${user?.id ?? 'anon'}`
}

type AuthResponse = { token: string; user: User }

function readToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function hasSessionToken() {
  return Boolean(readToken())
}

export function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function readCachedCoins(): Coin[] {
  try {
    const raw = localStorage.getItem(COINS_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Coin[]) : []
  } catch {
    return []
  }
}

function stripBlob(value?: string) {
  return value?.startsWith('blob:') ? undefined : value
}

export function writeCachedCoins(coins: Coin[]) {
  const serializable = coins.map((coin) => ({
    ...coin,
    image: stripBlob(coin.image),
    imageObverse: stripBlob(coin.imageObverse),
    imageReverse: stripBlob(coin.imageReverse),
  }))
  localStorage.setItem(COINS_CACHE_KEY, JSON.stringify(serializable))
}

export function revokeCoinImages(coins: Coin[]) {
  const seen = new Set<string>()
  for (const coin of coins) {
    for (const value of [coin.image, coin.imageObverse, coin.imageReverse]) {
      if (value?.startsWith('blob:') && !seen.has(value)) {
        seen.add(value)
        URL.revokeObjectURL(value)
      }
    }
  }
}

export function coinSideImage(coin: Coin, side: CoinSide = 'obverse'): string | undefined {
  if (side === 'reverse') return coin.imageReverse
  return coin.imageObverse || coin.image
}

function storeSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function messageFromDetail(detail: unknown, fallback: string) {
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && 'msg' in detail[0]) {
    return String((detail[0] as { msg: string }).msg)
  }
  return fallback
}

async function parseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { detail?: unknown }
    return messageFromDetail(payload.detail, fallback)
  } catch {
    return fallback
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = readToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  return fetch(url, { ...init, headers, credentials: 'include' })
}

async function jsonFetch<T>(path: string, init: RequestInit = {}, fallback: string): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/v1/auth/')) clearSession()
    throw new Error(await parseError(response, fallback))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function registerAccount(email: string, password: string): Promise<User> {
  const payload = await jsonFetch<AuthResponse>(
    '/api/v1/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    'Не удалось зарегистрироваться',
  )
  storeSession(payload.token, payload.user)
  return payload.user
}

export async function loginAccount(email: string, password: string): Promise<User> {
  const payload = await jsonFetch<AuthResponse>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    'Не удалось войти',
  )
  storeSession(payload.token, payload.user)
  return payload.user
}

export async function requestPasswordReset(email: string): Promise<string> {
  const payload = await jsonFetch<{ message: string }>(
    '/api/v1/auth/password-reset/request',
    { method: 'POST', body: JSON.stringify({ email }) },
    'Не удалось отправить запрос. Попробуйте позже',
  )
  return payload.message
}

export async function confirmPasswordReset(token: string, password: string): Promise<string> {
  const payload = await jsonFetch<{ message: string }>(
    '/api/v1/auth/password-reset/confirm',
    { method: 'POST', body: JSON.stringify({ token, password }) },
    'Не удалось изменить пароль',
  )
  clearSession()
  return payload.message
}

export async function logoutAccount() {
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    // Сессию на устройстве всё равно сбрасываем.
  }
  clearSession()
}

export async function fetchMe(): Promise<User> {
  const user = await jsonFetch<User>('/api/v1/me', {}, 'Сессия недействительна')
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

async function hydrateSide(coin: Coin, side: CoinSide): Promise<string | undefined> {
  const existing = coinSideImage(coin, side)
  const has =
    side === 'reverse'
      ? Boolean(coin.hasPhotoReverse || coin.imageReverse)
      : Boolean(coin.hasPhotoObverse || coin.hasPhoto || coin.imageObverse || coin.image)
  if (!has && !existing) return undefined
  if (existing?.startsWith('data:') || existing?.startsWith('blob:')) return existing
  const photoPath =
    existing && !existing.startsWith('http')
      ? existing
      : `/api/v1/coins/${coin.id}/photo?side=${side}`
  const response = await apiFetch(photoPath)
  if (!response.ok) return undefined
  return URL.createObjectURL(await response.blob())
}

async function hydratePhoto(coin: Coin): Promise<Coin> {
  const [image, imageReverse] = await Promise.all([
    hydrateSide(coin, 'obverse'),
    hydrateSide(coin, 'reverse'),
  ])
  return {
    ...coin,
    hasPhoto: Boolean(image),
    hasPhotoObverse: Boolean(image),
    hasPhotoReverse: Boolean(imageReverse),
    image,
    imageObverse: image,
    imageReverse,
  }
}

export async function fetchCoins(): Promise<Coin[]> {
  const coins = await jsonFetch<Coin[]>('/api/v1/coins', {}, 'Не удалось загрузить коллекцию')
  return Promise.all(coins.map(hydratePhoto))
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return jsonFetch<AdminUser[]>('/api/v1/admin/users', {}, 'Не удалось загрузить пользователей')
}

export async function fetchAdminUserCoins(userId: number): Promise<Coin[]> {
  const coins = await jsonFetch<Coin[]>(
    `/api/v1/admin/users/${userId}/coins`,
    {},
    'Не удалось загрузить коллекцию пользователя',
  )
  return Promise.all(coins.map(hydratePhoto))
}

function normalizePhotos(photos?: File | CoinPhotos): CoinPhotos {
  if (!photos) return {}
  if (photos instanceof File) return { obverse: photos }
  return photos
}

export async function uploadCoinPhoto(coinId: number, file: File, side: CoinSide = 'obverse'): Promise<Coin> {
  const body = new FormData()
  body.append('file', file)
  const updated = await jsonFetch<Coin>(
    `/api/v1/coins/${coinId}/photo?side=${side}`,
    { method: 'POST', body },
    'Не удалось загрузить фото',
  )
  return hydratePhoto(updated)
}

export async function createCoin(
  draft: CoinDraft,
  photos?: File | CoinPhotos,
  hydrate = true,
): Promise<Coin> {
  const created = await jsonFetch<Coin>(
    '/api/v1/coins',
    { method: 'POST', body: JSON.stringify(draft) },
    'Не удалось сохранить монету',
  )
  const { obverse, reverse } = normalizePhotos(photos)
  let current = created
  if (obverse) {
    const body = new FormData()
    body.append('file', obverse)
    current = await jsonFetch<Coin>(
      `/api/v1/coins/${created.id}/photo?side=obverse`,
      { method: 'POST', body },
      'Монета сохранена, но фото аверса не загрузилось',
    )
  }
  if (reverse) {
    const body = new FormData()
    body.append('file', reverse)
    current = await jsonFetch<Coin>(
      `/api/v1/coins/${created.id}/photo?side=reverse`,
      { method: 'POST', body },
      'Монета сохранена, но фото реверса не загрузилось',
    )
  }
  if (!obverse && !reverse) return created
  return hydrate ? hydratePhoto(current) : current
}

export async function deleteCoin(id: number) {
  await jsonFetch<void>(`/api/v1/coins/${id}`, { method: 'DELETE' }, 'Не удалось удалить монету')
}

export async function createShare(body: { access?: ShareAccess; email?: string; coinId?: number } = {}): Promise<ShareLink> {
  return jsonFetch<ShareLink>(
    '/api/v1/shares',
    {
      method: 'POST',
      body: JSON.stringify({
        access: body.access ?? 'read',
        email: body.email,
        coin_id: body.coinId,
      }),
    },
    'Не удалось создать ссылку',
  )
}

export async function fetchShares(): Promise<ShareLink[]> {
  return jsonFetch<ShareLink[]>('/api/v1/shares', {}, 'Не удалось загрузить выданные доступы')
}

export async function fetchShareInbox(): Promise<ShareLink[]> {
  return jsonFetch<ShareLink[]>('/api/v1/shares/inbox', {}, 'Не удалось загрузить открытые коллекции')
}

export async function revokeShare(id: number) {
  await jsonFetch<void>(`/api/v1/shares/${id}`, { method: 'DELETE' }, 'Не удалось отозвать доступ')
}

export async function fetchSharedCollection(token: string): Promise<SharedCollection> {
  const payload = await jsonFetch<SharedCollection>(
    `/api/v1/shares/view/${encodeURIComponent(token)}`,
    {},
    'Ссылка недействительна или доступ отозван',
  )
  return {
    ...payload,
    coins: await Promise.all(payload.coins.map(hydratePhoto)),
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const parts = dataUrl.split(',')
  if (parts.length < 2) return null
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = Uint8Array.from(atob(parts[1]), (char) => char.charCodeAt(0))
  return new File([bytes], filename, { type: mime })
}

let importInFlight: Promise<Coin[] | null> | null = null

export async function importLocalCoinsIfNeeded(): Promise<Coin[] | null> {
  if (importInFlight) return importInFlight
  importInFlight = (async () => {
    const flag = importedKey()
    if (localStorage.getItem(flag) === '1') return null
    const local = readCachedCoins().filter((coin) => coin.title)
    const server = await jsonFetch<Coin[]>('/api/v1/coins', {}, 'Не удалось загрузить коллекцию')
    if (server.length > 0 || local.length === 0) {
      localStorage.setItem(flag, '1')
      return null
    }
    for (const coin of local) {
      const photo = coin.image?.startsWith('data:')
        ? dataUrlToFile(coin.image, `coin-${coin.id}.jpg`) ?? undefined
        : undefined
      await createCoin(
        {
          title: coin.title,
          subtitle: coin.subtitle,
          country: coin.country,
          year: coin.year,
          metal: coin.metal,
          grade: coin.grade,
          value: coin.value,
          color: coin.color,
          mark: coin.mark,
        },
        photo,
        false,
      )
    }
    localStorage.setItem(flag, '1')
    return fetchCoins()
  })()
  try {
    return await importInFlight
  } finally {
    importInFlight = null
  }
}
