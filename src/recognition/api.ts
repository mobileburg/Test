export type RecognitionResult = {
  confidence: number
  catalogNumber: string
  title: string
  subtitle: string
  country: string
  year: number
  metal: string
  source: string
  sourceUrl: string
}

type RecognitionResponse = {
  modelVersion: string
  results: RecognitionResult[]
  excludedCatalogs?: string[]
  attribution: string
}

const API_URL = (import.meta.env.VITE_RECOGNITION_API_URL ?? '').replace(/\/$/, '')

export async function recognizeCoin(
  file: File,
  options?: { excludeCatalogs?: string[]; excludeIds?: number[] },
): Promise<RecognitionResponse> {
  const body = new FormData()
  body.append('file', file)
  if (options?.excludeCatalogs?.length) {
    body.append('exclude_catalogs', options.excludeCatalogs.join(','))
  }
  if (options?.excludeIds?.length) {
    body.append('exclude_ids', options.excludeIds.join(','))
  }
  const response = await fetch(`${API_URL}/api/v1/recognize`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    let message = 'Сервис распознавания временно недоступен'
    try {
      const error = await response.json() as { detail?: string }
      if (error.detail) message = error.detail
    } catch {
      // Сервер вернул ответ не в JSON.
    }
    throw new Error(message)
  }
  const payload = await response.json() as RecognitionResponse
  if (!payload.results.length) throw new Error('Монета не найдена в каталоге Банка России')
  return payload
}
