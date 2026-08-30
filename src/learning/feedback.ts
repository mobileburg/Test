import { apiFetch } from '../api'

export type RecognitionFeedback = {
  id: string
  coinId: number
  createdAt: string
  prediction: {
    title: string
    country: string
    year: number
    metal: string
  }
  correction: {
    title: string
    country: string
    year: number
    metal: string
  }
  consent: true
  reviewStatus: 'pending' | 'approved' | 'rejected'
}

export type FeedbackVerdict = 'correct' | 'incorrect'
export type FeedbackReviewStatus = 'pending' | 'approved' | 'rejected'

export type FeedbackItem = {
  id: number
  userId: number
  userEmail: string
  coinId: number | null
  predictedCatalog: string
  predictedTitle: string
  predicted: Record<string, unknown>
  verdict: FeedbackVerdict
  comment: string
  retry: boolean
  reviewStatus: FeedbackReviewStatus
  createdAt: string
  reviewedAt: string | null
  hasPhoto: boolean
  photo?: string | null
}

const QUEUE_KEY = 'numismat-learning-feedback-v1'

export function queueRecognitionFeedback(
  feedback: Omit<RecognitionFeedback, 'id' | 'createdAt' | 'consent' | 'reviewStatus'> & {
    reviewStatus?: RecognitionFeedback['reviewStatus']
  },
) {
  let queue: RecognitionFeedback[]
  try {
    queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as RecognitionFeedback[]
  } catch {
    queue = []
  }
  queue.push({
    ...feedback,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    consent: true,
    reviewStatus: feedback.reviewStatus ?? 'pending',
  })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)))
}

export type SubmitFeedbackInput = {
  coinId?: number
  photo?: File
  predictedCatalog: string
  predictedTitle?: string
  predicted?: Record<string, unknown>
  verdict: FeedbackVerdict
  comment?: string
  retry?: boolean
}

export async function submitRecognitionFeedback(input: SubmitFeedbackInput): Promise<FeedbackItem> {
  const body = new FormData()
  if (input.coinId != null) body.append('coin_id', String(input.coinId))
  if (input.photo) body.append('photo', input.photo)
  body.append('predicted_catalog', input.predictedCatalog)
  if (input.predictedTitle) body.append('predicted_title', input.predictedTitle)
  if (input.predicted) body.append('predicted_json', JSON.stringify(input.predicted))
  body.append('verdict', input.verdict)
  if (input.comment) body.append('comment', input.comment)
  body.append('retry', input.retry ? 'true' : 'false')

  const response = await apiFetch('/api/v1/feedback', { method: 'POST', body })
  if (!response.ok) {
    let message = 'Не удалось сохранить оценку распознавания'
    try {
      const error = (await response.json()) as { detail?: string }
      if (error.detail) message = error.detail
    } catch {
      // Сервер вернул ответ не в JSON.
    }
    throw new Error(message)
  }
  return (await response.json()) as FeedbackItem
}

export async function fetchAdminFeedback(status: FeedbackReviewStatus | 'all' = 'pending'): Promise<FeedbackItem[]> {
  const items = await jsonAdmin<FeedbackItem[]>(
    `/api/v1/admin/feedback?status=${encodeURIComponent(status)}`,
    'Не удалось загрузить очередь обучения',
  )
  return Promise.all(items.map(hydrateFeedbackPhoto))
}

export async function approveFeedback(id: number): Promise<FeedbackItem> {
  return jsonAdmin<FeedbackItem>(
    `/api/v1/admin/feedback/${id}/approve`,
    'Не удалось одобрить оценку',
    { method: 'POST' },
  )
}

export async function rejectFeedback(id: number): Promise<FeedbackItem> {
  return jsonAdmin<FeedbackItem>(
    `/api/v1/admin/feedback/${id}/reject`,
    'Не удалось отклонить оценку',
    { method: 'POST' },
  )
}

async function jsonAdmin<T>(path: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) {
    let message = fallback
    try {
      const error = (await response.json()) as { detail?: string }
      if (error.detail) message = error.detail
    } catch {
      // Сервер вернул ответ не в JSON.
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export async function hydrateFeedbackPhoto(item: FeedbackItem): Promise<FeedbackItem> {
  if (!item.hasPhoto && !item.photo) return { ...item, photo: undefined }
  if (item.photo?.startsWith('blob:') || item.photo?.startsWith('data:')) return item
  const path = item.photo && !item.photo.startsWith('http')
    ? item.photo
    : `/api/v1/admin/feedback/${item.id}/photo`
  const response = await apiFetch(path)
  if (!response.ok) return { ...item, photo: undefined }
  const blob = await response.blob()
  return { ...item, hasPhoto: true, photo: URL.createObjectURL(blob) }
}

export function revokeFeedbackImages(items: FeedbackItem[]) {
  for (const item of items) {
    if (item.photo?.startsWith('blob:')) URL.revokeObjectURL(item.photo)
  }
}
