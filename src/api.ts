export type User = {
  id: number
  email: string
  role: 'user' | 'admin'
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
  image?: string
}

export type AdminUser = {
  id: number
  email: string
  role: 'user' | 'admin'
  coinsCount: number
  created: string
}

export type CoinDraft = Omit<Coin, 'id' | 'hasPhoto' | 'image'>

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

export function writeCachedCoins(coins: Coin[]) {
  const serializable = coins.map((coin) => ({
    ...coin,
    image: coin.image?.startsWith('blob:') ? undefined : coin.image,
  }))
  localStorage.setItem(COINS_CACHE_KEY, JSON.stringify(serializable))
}

export function revokeCoinImages(coins: Coin[]) {
  for (const coin of coins) {
    if (coin.image?.startsWith('blob:')) URL.revokeObjectURL(coin.image)
  }
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

async function hydratePhoto(coin: Coin): Promise<Coin> {
  if (!coin.hasPhoto && !coin.image) return { ...coin, image: undefined }
  if (coin.image?.startsWith('data:') || coin.image?.startsWith('blob:')) return coin
  const response = await apiFetch(`/api/v1/coins/${coin.id}/photo`)
  if (!response.ok) return { ...coin, image: undefined }
  const blob = await response.blob()
  return { ...coin, hasPhoto: true, image: URL.createObjectURL(blob) }
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

export async function createCoin(draft: CoinDraft, photo?: File, hydrate = true): Promise<Coin> {
  const created = await jsonFetch<Coin>(
    '/api/v1/coins',
    { method: 'POST', body: JSON.stringify(draft) },
    'Не удалось сохранить монету',
  )
  if (!photo) return created
  const body = new FormData()
  body.append('file', photo)
  const withPhoto = await jsonFetch<Coin>(
    `/api/v1/coins/${created.id}/photo`,
    { method: 'POST', body },
    'Монета сохранена, но фото не загрузилось',
  )
  return hydrate ? hydratePhoto(withPhoto) : withPhoto
}

export async function deleteCoin(id: number) {
  await jsonFetch<void>(`/api/v1/coins/${id}`, { method: 'DELETE' }, 'Не удалось удалить монету')
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
