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
  sheet_();
  chatSheet_();
  UrlFetchApp.fetch("https://generativelanguage.googleapis.com", { muteHttpExceptions: true });
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

  return json_({ ok: false, error: "unknown action" });
}

// Помощник: вопросы Димы отвечает Gemini. Ключ хранится в свойстве скрипта GEMINI_KEY.
const CHAT_SHEET = "chat";
const ASK_PER_DAY = 150;
const HISTORY = 16;
const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
const SYSTEM = [
  "Ты — виртуальный помощник учебного сайта «Учебный центр» (https://mobileburg.github.io/Test/). С тобой говорит школьник Дима.",
  "Вопросы приходят текстом или голосом; голос уже переведён в текст, поэтому бывают ошибки распознавания — угадывай смысл.",
  "Отвечай всегда по-русски, дружелюбно, на «ты». Коротко: 3–8 предложений или короткий список; подробнее — только если Дима просит.",
  "Ответ могут прочитать вслух, поэтому не используй таблицы, код, LaTeX и знаки $. Формулы пиши простым текстом: C2H4, x^2, CH2=CH2.",
  "Объясняй как хороший репетитор: сначала суть, потом пример. Не решай домашнее задание целиком сразу — дай подсказку и предложи следующий шаг; полное решение показывай, если Дима прямо просит.",
  "Если не уверен в факте — так и скажи, не выдумывай. Если вопрос не про учёбу, ответь коротко и вежливо и предложи вернуться к занятиям. Не обсуждай опасные и взрослые темы.",
  "Разделы сайта (советуй при случае): Химия → «Алкены» (himiya/alkeny/): строение, номенклатура, реакции. " +
    "Геометрия → «Сечения тетраэдра и куба» (geometriya/sechenie-tetraedra/): метод следов, параллельные грани, тренажёр с подсказками и 3D. " +
    "Русский язык → «Миссия „Оборот“» (russkiy/oboroty/): причастный и деепричастный обороты, запятые. Алгебра (algebra/). «Прогресс обучения» (progress/) — статистика занятий.",
  "К вопросу приложена страница, с которой его задали, — используй её как контекст.",
].join("\n");

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
  const key = props.getProperty("GEMINI_KEY");
  if (!key) return { ok: false, error: "Помощник ещё не подключён." };
  const chatId = String(body.chatId || "");
  const message = String(body.message || "").trim().slice(0, 4000);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(chatId) || !message) return { ok: false, error: "Пустой вопрос." };

  const dayKey = "asks:" + Utilities.formatDate(new Date(), "Asia/Yekaterinburg", "yyyy-MM-dd");
  const used = Number(props.getProperty(dayKey) || 0);
  if (used >= ASK_PER_DAY) return { ok: false, error: "На сегодня лимит вопросов исчерпан. Продолжим завтра!" };
  props.setProperty(dayKey, String(used + 1));

  const contents = history_(chatId);
  const where = [String(body.title || "").slice(0, 200), String(body.page || "").slice(0, 200)].filter(String).join(", ");
  contents.push({ role: "user", parts: [{ text: (where ? "[Страница: " + where + "]\n" : "") + message }] });
  const reqId = Utilities.getUuid().replace(/-/g, "");
  appendChat_([[reqId, chatId, new Date(), "q", message, Date.now()]]);

  const res = gemini_(key, contents);
  appendChat_([[reqId, chatId, new Date(), res.text ? "a" : "err", res.text || res.error, Date.now()]]);
  return res.text ? { ok: true, reqId, done: true, text: res.text } : { ok: false, error: "Помощник сейчас недоступен, попробуй через минуту." };
}

function history_(chatId) {
  const sh = chatSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const from = Math.max(2, last - 400);
  const rows = sh.getRange(from, 1, last - from + 1, 5).getValues().filter((r) => r[1] === chatId && (r[3] === "q" || r[3] === "a"));
  const out = [];
  rows.slice(-HISTORY).forEach((r) => {
    const role = r[3] === "q" ? "user" : "model";
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].parts[0].text += "\n" + r[4];
    else out.push({ role, parts: [{ text: String(r[4]) }] });
  });
  while (out.length && out[0].role !== "user") out.shift();
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

function gemini_(key, contents) {
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "low" } },
  });
  let error = "";
  for (let attempt = 0; attempt < MODELS.length * 2; attempt++) {
    const model = MODELS[attempt % MODELS.length];
    const res = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": key },
      payload,
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    let j = {};
    try { j = JSON.parse(res.getContentText()); } catch (err) { j = {}; }
    const c = (j.candidates || [])[0];
    const text = c && c.content && (c.content.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
    if (code === 200 && text) return { text: text.replace(/\$+/g, "") };
    error = model + ": " + code + " " + ((j.error && j.error.message) || (c && c.finishReason) || "empty").slice(0, 200);
    if (code === 400 || code === 401 || code === 403) break;
    if (attempt >= MODELS.length - 1) Utilities.sleep(1500);
  }
  return { error };
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
