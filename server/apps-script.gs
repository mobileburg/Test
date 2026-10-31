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

  if (body.action === "recognize") {
    if (!checkToken_(body.token)) return json_({ ok: false, error: "auth" });
    return json_(recognize_(body));
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
  "Ответ читают в небольшом окне чата, поэтому не используй таблицы и код. Чат показывает формулы LaTeX как в учебнике: любую математическую запись — дроби, степени, корни, логарифмы, производные, уравнения, даже короткую вроде x^2 — пиши в LaTeX между знаками $, например $\\left(\\frac{1}{3}\\right)^x = 27$, $\\sqrt{x+1}$, $\\log_2 8 = 3$, $y' = 2x$. Дроби — только через \\frac, никогда не словами («одна третья») и не через косую черту. Важную итоговую формулу можно вынести отдельной строкой между $$ … $$. Химические формулы пиши так: $\\mathrm{C_2H_4}$, $\\mathrm{CH_2{=}CH_2}$. Знак $ используй только для формул.",
  "Объясняй как хороший репетитор: сначала суть, потом пример. Не решай домашнее задание целиком сразу — дай подсказку и предложи следующий шаг; полное решение показывай, если Дима прямо просит.",
  "Если не уверен в факте — так и скажи, не выдумывай. Если вопрос не про учёбу, ответь коротко и вежливо и предложи вернуться к занятиям. Не обсуждай опасные и взрослые темы.",
  "Разделы сайта (советуй при случае): Химия → «Алкены» (himiya/alkeny/): строение, номенклатура, реакции. " +
    "Геометрия → «Сечения тетраэдра и куба» (geometriya/sechenie-tetraedra/): метод следов, параллельные грани, тренажёр с подсказками и 3D. " +
    "Русский язык → «Миссия „Оборот“» (russkiy/oboroty/): причастный и деепричастный обороты, запятые. Литература → Гоголь, «Вечера на хуторе близ Диканьки» (literatura/gogol-vechera/) и «Шинель» (literatura/gogol-shinel/, 1842, это не глава «Вечеров»): пересказ и тест. Алгебра → «Тренажёр: уравнения» (algebra/uravneniya/): линейные, квадратные, дробные, показательные, логарифмические и дифференциальные уравнения (y′ = f(x), разделяющиеся переменные, линейные 1-го порядка, 2-го порядка с постоянными коэффициентами, задача Коши) с тремя уровнями подсказок. «Прогресс обучения» (progress/) — статистика занятий.",
  "К вопросу приложена страница, с которой его задали, — используй её как контекст.",
  "Если сообщение начинается с пометки в квадратных скобках «[Тренажёр уравнений …]», это задача из тренажёра: там указано уравнение, сколько подсказок Дима уже открыл и его последний ответ. Не повторяй открытые подсказки и не выдавай сразу ответ: найди, где именно он застрял, объясни этот шаг подробнее и проще, чем подсказка, и предложи сделать следующий шаг самому. Если его ответ неверный — помоги найти ошибку. Полное решение давай, только если он прямо просит.",
  "Дима может прикладывать файлы, фото и снимки своего экрана. Внимательно смотри на них и отвечай по их содержанию; если на снимке задача — помоги с ней по правилам выше. Если на картинке ничего не разобрать, так и скажи.",
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
  const hasFiles = Array.isArray(body.files) && body.files.length > 0;
  const message = String(body.message || "").trim().slice(0, 4000) || (hasFiles ? (body.screen ? "Посмотри на мой экран и помоги разобраться." : "Посмотри, что я приложил, и помоги разобраться.") : "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(chatId) || !message) return { ok: false, error: "Пустой вопрос." };

  const dayKey = "asks:" + Utilities.formatDate(new Date(), "Asia/Yekaterinburg", "yyyy-MM-dd");
  const used = Number(props.getProperty(dayKey) || 0);
  if (used >= ASK_PER_DAY) return { ok: false, error: "На сегодня лимит вопросов исчерпан. Продолжим завтра!" };
  props.setProperty(dayKey, String(used + 1));

  const files = files_(body.files), keep = files_(body.keep);
  if (files.error || keep.error) return { ok: false, error: files.error || keep.error };
  if (files.size + keep.size > MAX_FILES_CHARS) return { ok: false, error: "Файлы слишком большие: вместе не больше 10 МБ." };
  const contents = history_(chatId);
  const where = [String(body.title || "").slice(0, 200), String(body.page || "").slice(0, 200)].filter(String).join(", ");
  const parts = [{ text: (where ? "[Страница: " + where + "]\n" : "") + (body.screen ? "[Приложен снимок экрана Димы]\n" : "") + message }].concat(files.parts);
  if (keep.parts.length) parts.push({ text: "Файлы, приложенные ранее в этом разговоре:" }, ...keep.parts);
  contents.push({ role: "user", parts });
  const reqId = Utilities.getUuid().replace(/-/g, "");
  appendChat_([[reqId, chatId, new Date(), "q", message + (files.names.length ? "\n[вложения: " + files.names.join(", ") + "]" : ""), Date.now()]]);

  const res = gemini_(key, contents);
  appendChat_([[reqId, chatId, new Date(), res.text ? "a" : "err", res.text || res.error, Date.now()]]);
  if (res.text) return { ok: true, reqId, done: true, text: res.text };
  return { ok: false, error: res.code === 400 && (files.parts.length || keep.parts.length) ? "Не получилось прочитать вложение. Попробуй другой файл или сделай скриншот." : "Помощник сейчас недоступен, попробуй через минуту." };
}

// Распознавание рукописного ответа из тренажёра: модель только переписывает написанное, не решая задачу.
const RECOGNIZE_PER_DAY = 300;
const RECOGNIZE = [
  "Ты распознаёшь рукописную запись школьника на картинке: это ответ к задаче по математике, иногда вместе с ходом решения.",
  "Перепиши ИТОГОВЫЙ ответ ровно так, как он написан. Не решай задачу, не проверяй и не исправляй ошибки — даже если ответ явно неверный, перепиши его как есть.",
  "Если на картинке несколько строк решения, бери последнюю строку с ответом (обычно после слова «Ответ», после «x =» или «y =», либо обведённую).",
  "Верни одну строку без пояснений, кавычек и markdown.",
].join("\n");
const RECOGNIZE_KIND = {
  roots: "Формат: только числа-корни через точку с запятой, например «2; -3», дроби через /, например «1/2», десятичные через точку. Без «x =». Если написано, что корней нет (или ∅), верни «нет корней».",
  ode: "Формат: только правая часть y(x) без «y =», в записи для калькулятора: умножение *, степень ^ со скобками, экспонента e^(...), константы C, C1, C2, функции sin(), cos(), ln(), sqrt(). Примеры: «C*e^(3x)», «C1*e^x + C2*e^(-2x)», «x^3/3 + 2x + C», «e^(-x)*(C1*cos(2x) + C2*sin(2x))».",
};

function recognize_(body) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("GEMINI_KEY");
  if (!key) return { ok: false, error: "Распознавание ещё не подключено." };
  const data = String(body.image || "");
  if (!data || data.length > 6000000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, error: "Не получилось прочитать рисунок." };
  const kind = RECOGNIZE_KIND[body.kind] ? body.kind : "roots";
  const dayKey = "rec:" + Utilities.formatDate(new Date(), "Asia/Yekaterinburg", "yyyy-MM-dd");
  const used = Number(props.getProperty(dayKey) || 0);
  if (used >= RECOGNIZE_PER_DAY) return { ok: false, error: "На сегодня лимит распознаваний исчерпан. Введи ответ с клавиатуры." };
  props.setProperty(dayKey, String(used + 1));
  const res = gemini_(key, [{ role: "user", parts: [{ text: RECOGNIZE_KIND[kind] }, { inlineData: { mimeType: "image/png", data } }] }], RECOGNIZE,
    { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingLevel: "low" } });
  if (!res.text) return { ok: false, error: "Распознавание сейчас недоступно, попробуй через минуту." };
  const text = res.text.replace(/\$+/g, "").split("\n").map((l) => l.trim()).filter(Boolean).pop().replace(/^[`"«]+|[`"»]+$/g, "").replace(/^\s*(ответ\s*:?\s*)?([xyху]\s*(\(x\))?\s*=\s*)?/i, "").slice(0, 300);
  return { ok: true, text };
}

const MAX_FILES = 6;
const MAX_FILES_CHARS = 14000000;
const FILE_TYPES = /^(image\/(png|jpeg|webp|heic|heif)|application\/pdf|text\/plain)$/;

function files_(list) {
  const out = { parts: [], names: [], size: 0 };
  if (!list) return out;
  if (!Array.isArray(list) || list.length > MAX_FILES) return { error: "Можно приложить не больше " + MAX_FILES + " файлов." };
  for (const f of list) {
    if (!f || typeof f !== "object") return { error: "Неверное вложение." };
    const name = String(f.name || "файл").slice(0, 120);
    if (typeof f.text === "string") {
      out.parts.push({ text: "Файл «" + name + "»:\n" + f.text.slice(0, 200000) });
      out.size += Math.min(f.text.length, 200000);
    } else {
      const mime = String(f.mime || ""), data = String(f.data || "");
      if (!FILE_TYPES.test(mime) || !/^[A-Za-z0-9+/=]+$/.test(data)) return { error: "Формат файла «" + name + "» не поддерживается." };
      out.parts.push({ inlineData: { mimeType: mime, data } });
      out.size += data.length;
    }
    out.names.push(name);
  }
  return out;
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

function gemini_(key, contents, system, config) {
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system || SYSTEM }] },
    contents,
    generationConfig: config || { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "low" } },
  });
  let error = "", lastCode = 0;
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
    lastCode = code;
    let j = {};
    try { j = JSON.parse(res.getContentText()); } catch (err) { j = {}; }
    const c = (j.candidates || [])[0];
    const text = c && c.content && (c.content.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
    if (code === 200 && text) return { text };
    error = model + ": " + code + " " + ((j.error && j.error.message) || (c && c.finishReason) || "empty").slice(0, 200);
    if (code === 400 || code === 401 || code === 403) break;
    if (attempt >= MODELS.length - 1) Utilities.sleep(1500);
  }
  return { error, code: lastCode };
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
