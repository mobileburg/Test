# bitrix-cursor-bridge

Минимальный MCP для варианта **«разовый summary из Cursor → комментарий в задачу Bitrix24»** без долгой сессии агента.

## Инструменты

| Tool | Назначение |
| --- | --- |
| `bitrix_topics_list` | Темы из `topics-map.json` |
| `bitrix_task_get` | Прочитать задачу по `taskId` или `topic` |
| `bitrix_task_publish_summary` | Опубликовать summary комментарием (+ опционально result) |
| `bitrix_task_comment_add` | Короткий комментарий |

## Подключение в Cursor (Desktop)

1. В портале Bitrix24: **Разработчикам → Другое → Входящий вебхук**, права минимум `task` (лучше ещё `user`). Создавайте под **служебным** пользователем.
2. В каталоге моста:

```bash
cd bitrix-cursor-bridge
cp .env.example .env   # только для smoke; в MCP URL задаётся в mcp.json
npm install
```

3. Скопируйте примеры конфигов:

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
cp .cursor/topics-map.example.json .cursor/topics-map.json
# отредактируйте webhook URL и реальные taskId
```

4. Cursor → **Settings → Tools & MCP** — должен появиться `bitrix-summary` (зелёный).
5. В чате включите правило **bitrix-publish-summary** (или попросите «опубликуй summary в задачу …»).

Проверка вебхука без MCP:

```bash
BITRIX24_WEBHOOK_URL='https://…/rest/…/…/' npm run smoke
BITRIX24_WEBHOOK_URL='https://…/rest/…/…/' npm run smoke -- 12345
```

## Как пользоваться в чате

- «Опубликуй summary в задачу **12345**»
- «Зафиксируй итог в теме **cursor-bitrix-sync**» (ключ из `topics-map.json`)

Агент вызовет MCP и оставит в задаче структурированный комментарий (не весь транскрипт).

## Секреты

- Не коммитьте `.cursor/mcp.json`, `topics-map.json` с боевыми ID, `.env`.
- В Cloud Agent URL вебхука лучше держать в секретах окружения и прокидывать в `env` MCP.
