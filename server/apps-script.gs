/** @OnlyCurrentDoc */

// Серверная часть учебного портала: принимает события обучения и отдаёт статистику.
// Хранилище — лист «events» Google-таблицы, к которой привязан этот скрипт.
// Логин и пароль хранятся в свойствах скрипта (USER, PASSWORD), а не в коде сайта.

const SHEET = "events";
const TOKEN_DAYS = 365;

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("USER")) props.setProperty("USER", "Dima");
  if (!props.getProperty("PASSWORD")) props.setProperty("PASSWORD", "Dimas");
  if (!props.getProperty("SECRET")) props.setProperty("SECRET", Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty("RELAY_SECRET")) props.setProperty("RELAY_SECRET", Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  sheet_();
  chatSheet_();
  UrlFetchApp.fetch("https://script.google.com", { muteHttpExceptions: true });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(["id", "время", "событие", "страница", "заголовок", "данные", "ts"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sign_(text) {
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret)).replace(/=+$/, "");
}

function makeToken_(user) {
  const payload = user + "." + (Date.now() + TOKEN_DAYS * 86400000);
  return payload + "." + sign_(payload);
}

function checkToken_(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const payload = parts[0] + "." + parts[1];
  const user = PropertiesService.getScriptProperties().getProperty("USER");
  return parts[0] === user && Number(parts[1]) > Date.now() && sign_(payload) === parts[2];
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad json" }); }
  const props = PropertiesService.getScriptProperties();

  if (body.action === "login") {
    const ok = String(body.user).toLowerCase() === String(props.getProperty("USER")).toLowerCase() && body.password === props.getProperty("PASSWORD");
    return json_(ok ? { ok: true, token: makeToken_(props.getProperty("USER")) } : { ok: false, error: "Неверный логин или пароль." });
  }

  if (body.action === "events") {
    if (!checkToken_(body.token)) return json_({ ok: false, error: "auth" });
    const events = (body.events || []).slice(0, 500);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = sheet_();
      const last = sh.getLastRow();
      const known = new Set(last > 1 ? sh.getRange(Math.max(2, last - 2000), 1, Math.min(last - 1, 2001), 1).getValues().map((r) => r[0]) : []);
      const rows = events.filter((ev) => ev && ev.id && !known.has(ev.id)).map((ev) => [
        String(ev.id), new Date(Number(ev.ts)), String(ev.type).slice(0, 40), String(ev.page || "").slice(0, 200),
        String(ev.title || "").slice(0, 200), JSON.stringify(ev.data || {}).slice(0, 2000), Number(ev.ts),
      ]);
      if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      return json_({ ok: true, saved: rows.length });
    } finally {
      lock.releaseLock();
    }
  }

  if (body.action === "ask") {
    if (!checkToken_(body.token)) return json_({ ok: false, error: "auth" });
    return json_(ask_(body));
  }

  if (body.action === "reply") {
    const secret = props.getProperty("RELAY_SECRET");
    if (!secret || body.secret !== secret) return json_({ ok: false, error: "auth" });
    const ids = (body.reqIds || []).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)).slice(0, 20);
    const rows = ids.map((id) => [id, String(body.chatId || "").slice(0, 64), new Date(), body.error ? "err" : "a", String(body.error || body.text || "").slice(0, 20000), Date.now()]);
    if (rows.length) appendChat_(rows);
    return json_({ ok: true, saved: rows.length });
  }

  return json_({ ok: false, error: "unknown action" });
}

// Помощник: вопрос уходит агенту на Cursor-хостинге, ответ агент присылает действием reply.
const CHAT_SHEET = "chat";
const ASK_PER_DAY = 150;
// Адрес агента на Cursor-хостинге; свойство скрипта AGENT_URL его переопределяет.
const AGENT_URL = "";

// Секрет для агента: запустите эту функцию и скопируйте значение из журнала выполнения.
function showRelaySecret() {
  Logger.log(PropertiesService.getScriptProperties().getProperty("RELAY_SECRET"));
}

function chatSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CHAT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CHAT_SHEET);
    sh.appendRow(["reqId", "chatId", "время", "роль", "текст", "ts"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendChat_(rows) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = chatSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
}

function ask_(body) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("AGENT_URL") || AGENT_URL, alias = props.getProperty("AGENT_TOKEN"), secret = props.getProperty("RELAY_SECRET");
  if (!url || !secret) return { ok: false, error: "Помощник ещё не подключён." };
  const chatId = String(body.chatId || "");
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(chatId) || !message) return { ok: false, error: "Пустой вопрос." };

  const dayKey = "asks:" + Utilities.formatDate(new Date(), "Asia/Yekaterinburg", "yyyy-MM-dd");
  const used = Number(props.getProperty(dayKey) || 0);
  if (used >= ASK_PER_DAY) return { ok: false, error: "На сегодня лимит вопросов исчерпан. Продолжим завтра!" };
  props.setProperty(dayKey, String(used + 1));

  const reqId = Utilities.getUuid().replace(/-/g, "");
  appendChat_([[reqId, chatId, new Date(), "q", message, Date.now()]]);
  const headers = { "x-relay-secret": secret, "X-BDK-Session-Key": "chat-" + chatId };
  if (alias) headers["X-Agent-Alias-Token"] = alias;
  const res = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/v1/channels/web/ask", {
    method: "post",
    contentType: "application/json",
    headers,
    payload: JSON.stringify({ reqId, chatId, message, page: String(body.page || "").slice(0, 300), title: String(body.title || "").slice(0, 300) }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    appendChat_([[reqId, chatId, new Date(), "err", "agent http " + res.getResponseCode(), Date.now()]]);
    return { ok: false, error: "Помощник сейчас недоступен (" + res.getResponseCode() + ")." };
  }
  return { ok: true, reqId };
}

function answer_(reqId) {
  const sh = chatSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, done: false };
  const from = Math.max(2, last - 400);
  const rows = sh.getRange(from, 1, last - from + 1, 5).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r[0] === reqId && (r[3] === "a" || r[3] === "err")) return { ok: true, done: true, text: r[3] === "a" ? r[4] : "", error: r[3] === "err" ? r[4] : "" };
  }
  return { ok: true, done: false };
}

function doGet(e) {
  const p = e.parameter || {};
  if (p.action === "answer") {
    if (!checkToken_(p.token)) return json_({ ok: false, error: "auth" });
    return json_(answer_(String(p.reqId || "")));
  }
  if (p.action !== "stats") return json_({ ok: true, service: "uchportal" });
  if (!checkToken_(p.token)) return json_({ ok: false, error: "auth" });
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, events: [] });
  const from = Math.max(2, last - 20000 + 1);
  const rows = sh.getRange(from, 1, last - from + 1, 7).getValues();
  const events = rows.map((r) => {
    let data = {};
    try { data = JSON.parse(r[5]); } catch (err) { data = {}; }
    return { id: r[0], ts: Number(r[6]), type: r[2], page: r[3], title: r[4], data };
  });
  return json_({ ok: true, events });
}
