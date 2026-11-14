#!/usr/bin/env node
/**
 * Минимальный MCP: опубликовать summary / комментарий в задачу Bitrix24.
 * Секрет: BITRIX24_WEBHOOK_URL = https://portal/rest/USER_ID/TOKEN/
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function webhookBase() {
  const raw = process.env.BITRIX24_WEBHOOK_URL?.trim();
  if (!raw) {
    throw new Error(
      "Не задан BITRIX24_WEBHOOK_URL. Входящий вебхук Bitrix24 со scope task (формат …/rest/USER_ID/TOKEN/).",
    );
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}

async function bitrixCall(method, params = {}) {
  const url = new URL(method, webhookBase());
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} при вызове ${method}: ${JSON.stringify(data)}`);
  }
  if (data.error) {
    throw new Error(`${data.error}: ${data.error_description || JSON.stringify(data)}`);
  }
  return data.result;
}

/** Markdown → простой BBCode для комментариев задач. */
function mdToBbcode(md) {
  let t = String(md ?? "");
  t = t.replace(/^### (.+)$/gm, "[B]$1[/B]");
  t = t.replace(/^## (.+)$/gm, "[B]$1[/B]");
  t = t.replace(/^# (.+)$/gm, "[B]$1[/B]");
  t = t.replace(/\*\*(.+?)\*\*/g, "[B]$1[/B]");
  t = t.replace(/`([^`]+)`/g, "[CODE]$1[/CODE]");
  t = t.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.replace(/^```\w*\n?/, "").replace(/```$/, "");
    return `[CODE]${inner}[/CODE]`;
  });
  t = t.replace(/^\s*[-*] (.+)$/gm, "• $1");
  return t.trim();
}

function loadTopicsMap() {
  const fromEnv = process.env.BITRIX_TOPICS_MAP;
  const candidates = [
    fromEnv,
    resolve(ROOT, "topics-map.json"),
    resolve(ROOT, "../.cursor/topics-map.json"),
  ].filter(Boolean);
  for (const path of candidates) {
    if (existsSync(path)) {
      return { path, map: JSON.parse(readFileSync(path, "utf8")) };
    }
  }
  return { path: null, map: {} };
}

function resolveTaskId(taskId, topic) {
  if (taskId != null && taskId !== "") {
    const n = Number(taskId);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Некорректный taskId: ${taskId}`);
    return n;
  }
  if (!topic) throw new Error("Укажите taskId или topic из topics-map.json");
  const { map } = loadTopicsMap();
  const entry = map[topic] ?? map[String(topic).toLowerCase()];
  if (entry == null) {
    const keys = Object.keys(map).slice(0, 20).join(", ") || "(пусто)";
    throw new Error(`Тема «${topic}» не найдена в topics-map. Известные ключи: ${keys}`);
  }
  const id = typeof entry === "object" ? entry.taskId : entry;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`В маппинге для «${topic}» нет валидного taskId`);
  return n;
}

function textResult(obj) {
  return {
    content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
  };
}

const server = new McpServer({
  name: "bitrix-summary",
  version: "0.1.0",
});

server.tool(
  "bitrix_topics_list",
  "Список тем из topics-map.json (slug → taskId). Нужен, чтобы сопоставить обсуждение с задачей Bitrix24.",
  {},
  async () => {
    const { path, map } = loadTopicsMap();
    return textResult({ mapPath: path, topics: map });
  },
);

server.tool(
  "bitrix_task_get",
  "Прочитать задачу Bitrix24 по id или по ключу topic из topics-map.",
  {
    taskId: z.union([z.number(), z.string()]).optional().describe("ID задачи Bitrix24"),
    topic: z.string().optional().describe("Ключ темы из topics-map.json"),
  },
  async ({ taskId, topic }) => {
    const id = resolveTaskId(taskId, topic);
    const task = await bitrixCall("tasks.task.get", {
      taskId: id,
      select: [
        "ID",
        "TITLE",
        "DESCRIPTION",
        "STATUS",
        "RESPONSIBLE_ID",
        "CREATED_BY",
        "DEADLINE",
        "PRIORITY",
        "GROUP_ID",
        "TAGS",
      ],
    });
    return textResult({ taskId: id, task: task?.task ?? task });
  },
);

server.tool(
  "bitrix_task_publish_summary",
  "Опубликовать summary чата Cursor в задачу Bitrix24: комментарий (и опционально результат задачи). Не копировать весь транскрипт — только выводы, решения, открытые вопросы, ссылки.",
  {
    taskId: z.union([z.number(), z.string()]).optional().describe("ID задачи Bitrix24"),
    topic: z.string().optional().describe("Ключ темы из topics-map.json"),
    title: z.string().optional().describe("Короткий заголовок блока, напр. Summary Cursor"),
    summaryMarkdown: z
      .string()
      .describe("Summary в Markdown: решения, следующие шаги, открытые вопросы, ссылки на чат/PR/файлы"),
    asResult: z
      .boolean()
      .optional()
      .describe("Если true — дополнительно записать tasks.result.add (итог задачи)"),
    cursorChatUrl: z.string().optional().describe("Ссылка на чат/агента Cursor, если есть"),
  },
  async ({ taskId, topic, title, summaryMarkdown, asResult, cursorChatUrl }) => {
    const id = resolveTaskId(taskId, topic);
    const heading = title?.trim() || "Summary Cursor";
    const linkLine = cursorChatUrl?.trim()
      ? `\n\n[URL=${cursorChatUrl.trim()}]Чат Cursor[/URL]`
      : "";
    const stamp = new Date().toISOString();
    const body = `[B]${heading}[/B]\n[I]${stamp}[/I]\n\n${mdToBbcode(summaryMarkdown)}${linkLine}`;

    const commentId = await bitrixCall("task.commentitem.add", {
      TASKID: id,
      FIELDS: { POST_MESSAGE: body },
    });

    let resultId = null;
    if (asResult) {
      resultId = await bitrixCall("tasks.task.result.add", {
        taskId: id,
        commentId,
      });
    }

    return textResult({
      ok: true,
      taskId: id,
      commentId,
      resultId,
      hint: "Summary опубликован комментарием в задаче Bitrix24.",
    });
  },
);

server.tool(
  "bitrix_task_comment_add",
  "Короткий комментарий в задачу (без оформления summary). Удобно для статуса «взял в работу» / уточнения.",
  {
    taskId: z.union([z.number(), z.string()]).optional(),
    topic: z.string().optional(),
    message: z.string().describe("Текст комментария (можно Markdown — будет упрощённо в BBCode)"),
  },
  async ({ taskId, topic, message }) => {
    const id = resolveTaskId(taskId, topic);
    const commentId = await bitrixCall("task.commentitem.add", {
      TASKID: id,
      FIELDS: { POST_MESSAGE: mdToBbcode(message) },
    });
    return textResult({ ok: true, taskId: id, commentId });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
