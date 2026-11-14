#!/usr/bin/env node
/**
 * Проверка вебхука без MCP: BITRIX24_WEBHOOK_URL=… npm run smoke -- [taskId]
 */
const base = process.env.BITRIX24_WEBHOOK_URL?.trim();
if (!base) {
  console.error("Задайте BITRIX24_WEBHOOK_URL");
  process.exit(1);
}
const root = base.endsWith("/") ? base : `${base}/`;
const taskId = process.argv[2];

const res = await fetch(new URL("user.current", root), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
const data = await res.json();
if (data.error) {
  console.error("Ошибка user.current:", data);
  process.exit(1);
}
console.log("OK user.current:", data.result?.ID, data.result?.NAME, data.result?.LAST_NAME);

if (taskId) {
  const t = await fetch(new URL("tasks.task.get", root), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: Number(taskId), select: ["ID", "TITLE", "STATUS"] }),
  }).then((r) => r.json());
  if (t.error) {
    console.error("Ошибка tasks.task.get:", t);
    process.exit(1);
  }
  console.log("OK task:", t.result?.task?.id ?? t.result?.task?.ID, t.result?.task?.title ?? t.result?.task?.TITLE);
}
