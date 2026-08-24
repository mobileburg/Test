# Backend императорского портрета

Сервис принимает фотографию в `multipart/form-data`, передаёт её в
`gpt-image-2` и возвращает JPEG. Исходные и готовые фотографии не сохраняются.

## Переменные окружения

- `OPENAI_API_KEY` — обязательный секрет OpenAI;
- `APP_TOKEN` — рекомендуемый токен между приложением и сервером;
- `PORT` — порт HTTP-сервера, по умолчанию `8080`.

Не добавляйте ключи в Git, APK или Docker-образ.

## Локальный запуск

```bash
npm ci
OPENAI_API_KEY=... APP_TOKEN=... npm start
```

Проверка состояния:

```bash
curl http://localhost:8080/health
```

Генерация:

```bash
curl -X POST http://localhost:8080/v1/imperial-portrait \
  -H "Authorization: Bearer $APP_TOKEN" \
  -F "photo=@portrait.jpg" \
  --output imperial.jpg
```

Docker-образ готов к развёртыванию в Cloud Run, Render, Fly.io или другом
сервисе с HTTPS. Для публичного запуска дополнительно рекомендуется проверять
Firebase App Check либо другой аттестат приложения, чтобы токен нельзя было
извлечь из APK и использовать для чужих запросов.
