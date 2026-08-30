# Нумизмат

MVP веб-приложения для оцифровки личной коллекции монет.

## Возможности

- каталог с поиском, фильтрами и сортировкой;
- адаптивный интерфейс для телефона и компьютера;
- загрузка изображения или съёмка камерой телефона;
- два фото на карточке: аверс и реверс (старое одно фото считается аверсом);
- проверка и редактирование результата распознавания;
- локальное хранение коллекции в `localStorage` без регистрации;
- подключение к собственному API распознавания на основе CLIP;
- воспроизводимый контур обучения на легально доступных русскоязычных данных;
- очередь оценок распознавания: пользователь отмечает «Верно» / «Неверно»,
  может попросить распознать ещё без этого класса и оставить комментарий;
- правки обычных пользователей ждут модерации (`pending`); оценка администратора
  сразу считается истиной (`approved`) и может попасть в следующее обучение.

После входа под `role=admin` в меню появляется пункт **Админка**: список пользователей,
просмотр чужих коллекций и **Очередь обучения**. Обычный кабинет по-прежнему показывает
только свою коллекцию.

## Администратор

Роль `admin` выдаётся так:

1. если в базе ещё нет ни одного администратора — **первый зарегистрированный** пользователь становится `admin` (в том числе уже существующий с минимальным `id`);
2. либо email из переменной окружения `NUMISMAT_ADMIN_EMAIL` (при регистрации, входе и старте сервиса);
3. вручную: `python scripts/promote_admin.py you@example.com`  
   или SQL: `UPDATE users SET role = 'admin' WHERE email = 'you@example.com';`  
   (файл БД: `$NUMISMAT_DATA_DIR/app.db`, на проде обычно `/opt/data/app.db`).

API только для администратора: `GET /api/v1/admin/users`,
`GET /api/v1/admin/users/:id/coins`, `GET /api/v1/admin/feedback` и
`POST /api/v1/admin/feedback/:id/approve|reject`. Остальные получают `403`.

## Запуск

Для определения реальных монет необходимо собрать индекс и запустить сервис из
каталога [`ml`](./ml/README.md). Без доступного API экран сканирования покажет
ошибку и предложит выбрать другое фото.

## Запуск

```bash
npm install
npm run dev
```

При локальном запуске API на порту 8000 передайте его адрес:

```bash
VITE_RECOGNITION_API_URL=http://localhost:8000 npm run dev
```

Проверка production-сборки:

```bash
npm run build
```

## Восстановление пароля и production

Backend создаёт одноразовую ссылку с криптографически случайным токеном. В SQLite
сохраняется только SHA-256 токена; по умолчанию ссылка действует 30 минут.
Успешная смена пароля отзывает все ранее выданные JWT пользователя. Повторный
запрос всегда отвечает нейтрально, даже если email не зарегистрирован или
ограничен rate limit.

При старте `init_storage()` безопасно добавляет новую схему к существующей SQLite.
SQL для контролируемого ручного обновления до запуска новой версии находится в
`migrations/001_password_reset.sql`: сначала сделайте резервную копию
`$NUMISMAT_DATA_DIR/app.db`, затем примените файл ровно один раз.

Обязательная production-конфигурация VibeCode:

```bash
NUMISMAT_ENV=production
NUMISMAT_DATA_DIR=/opt/data
NUMISMAT_SECRET_KEY=<длинный случайный постоянный секрет>
NUMISMAT_PUBLIC_URL=https://numismat.example
NUMISMAT_COOKIE_SECURE=1
NUMISMAT_EMAIL_MODE=smtp
NUMISMAT_SMTP_HOST=smtp.example
NUMISMAT_SMTP_PORT=587
NUMISMAT_SMTP_FROM=Numismat <no-reply@example.com>
NUMISMAT_SMTP_USERNAME=<smtp-user>
NUMISMAT_SMTP_PASSWORD=<smtp-password>
NUMISMAT_SMTP_STARTTLS=1
```

Для SMTP через TLS с подключения задайте `NUMISMAT_SMTP_SSL=1` и обычно порт
`465`; в этом случае `STARTTLS` не используется. Секреты задаются только в
защищённых переменных окружения VibeCode. `NUMISMAT_PUBLIC_URL` обязан быть HTTPS:
из него формируется ссылка `/reset-password?token=...`.

Необязательные настройки: `NUMISMAT_PASSWORD_RESET_TTL_MINUTES` (по умолчанию
`30`), `NUMISMAT_RESET_REQUESTS_PER_EMAIL` (`3` в час) и
`NUMISMAT_RESET_REQUESTS_PER_IP` (`10` запросов или `20` подтверждений в час).
Для локальной разработки можно включить `NUMISMAT_EMAIL_MODE=console`: ссылка
появится в server log. Этот режим программно запрещён при
`NUMISMAT_ENV=production`; значение по умолчанию `disabled` не выводит токен.

Перед выкладкой проверьте сохранение `$NUMISMAT_DATA_DIR` на постоянном диске,
доступ backend к SMTP и сборку frontend с публичным API:

```bash
VITE_RECOGNITION_API_URL=https://api.example npm run build
```
