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
  reviewStatus: 'pending'
}

const QUEUE_KEY = 'numismat-learning-feedback-v1'

export function queueRecognitionFeedback(
  feedback: Omit<RecognitionFeedback, 'id' | 'createdAt' | 'consent' | 'reviewStatus'>,
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
    reviewStatus: 'pending',
  })
  // Фото остаётся в записи монеты и связывается по coinId. Очередь сама ничего не отправляет.
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)))
}
