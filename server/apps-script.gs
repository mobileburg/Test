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

  return json_({ ok: false, error: "unknown action" });
}

function doGet(e) {
  const p = e.parameter || {};
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
