(function () {
  const BASE = document.currentScript.src.replace(/assets\/portal\.js.*$/, "");
  const BASE_PATH = new URL(BASE).pathname;
  const USER = "Dima";
  const USER_HASH = "db4e44e46e55dd69fcab49712c8cdcd635dd082f9501377d188ae4db4dd1565a";
  const SKEY = "uchportal-session", LKEY = "uchportal-log", QKEY = "uchportal-queue";
  const LOG_CAP = 5000;
  const api = () => window.PORTAL_API || "";

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full */ } };
  const session = () => read(SKEY, null);

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function post(body) {
    const r = await fetch(api(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return r.json();
  }

  async function login(user, password) {
    const h = await sha256(String(user).trim().toLowerCase() + "\n" + password);
    if (h !== USER_HASH) return { ok: false, error: "Неверный логин или пароль." };
    let token = "";
    if (api()) {
      try {
        const res = await post({ action: "login", user: USER, password });
        if (!res.ok) return { ok: false, error: res.error || "Сервер не принял пароль." };
        token = res.token;
        const q = read(QKEY, []), ids = new Set(q.map((e) => e.id));
        write(QKEY, read(LKEY, []).filter((e) => !ids.has(e.id)).concat(q).slice(-LOG_CAP));
      } catch (e) {
        token = "";
      }
    }
    write(SKEY, { user: USER, token, since: Date.now() });
    track("login");
    return { ok: true };
  }

  function logout() {
    track("logout");
    flush(true);
    localStorage.removeItem(SKEY);
  }

  const pagePath = () => {
    const p = location.pathname;
    return (p.startsWith(BASE_PATH) ? p.slice(BASE_PATH.length) : p).replace(/index\.html$/, "") || "/";
  };

  function track(type, data) {
    const s = session();
    if (!s) return;
    const ev = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ts: Date.now(), type, page: pagePath(), title: document.title, data: data || {} };
    const log = read(LKEY, []);
    log.push(ev);
    write(LKEY, log.slice(-LOG_CAP));
    if (api()) {
      const q = read(QKEY, []);
      q.push(ev);
      write(QKEY, q.slice(-LOG_CAP));
      flush(false);
    }
  }

  let flushing = false;
  function flush(beacon) {
    const s = session();
    if (!api() || !s || !s.token || flushing) return;
    const q = read(QKEY, []);
    if (!q.length) return;
    const body = JSON.stringify({ action: "events", token: s.token, events: q });
    if (beacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(api(), new Blob([body], { type: "text/plain;charset=utf-8" }))) write(QKEY, []);
      return;
    }
    flushing = true;
    fetch(api(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          const sent = new Set(q.map((e) => e.id));
          write(QKEY, read(QKEY, []).filter((e) => !sent.has(e.id)));
        }
      })
      .catch(() => {})
      .finally(() => { flushing = false; });
  }

  async function getEvents() {
    const s = session();
    if (!s) return { source: "none", events: [] };
    if (api() && s.token) {
      try {
        const r = await fetch(api() + "?action=stats&token=" + encodeURIComponent(s.token));
        const res = await r.json();
        if (res.ok) {
          const ids = new Set(res.events.map((e) => e.id));
          const pending = read(QKEY, []).filter((e) => !ids.has(e.id));
          return { source: "server", events: res.events.concat(pending).sort((a, b) => a.ts - b.ts) };
        }
      } catch (e) { /* fall back to local log */ }
    }
    return { source: api() ? "local-fallback" : "local", events: read(LKEY, []) };
  }

  function widget() {
    const s = session();
    const box = document.createElement("div");
    box.className = "portal-user";
    box.style.cssText = "position:fixed;top:10px;right:12px;z-index:100;font:14px/1.2 system-ui,sans-serif;background:#fff;border:1px solid #d5dbe8;border-radius:20px;padding:6px 12px;box-shadow:0 2px 10px rgba(0,0,0,.08);display:flex;gap:10px;align-items:center";
    const a = (href, text) => '<a href="' + BASE + href + '" style="color:#0b57d0;text-decoration:none">' + text + "</a>";
    if (s) {
      box.innerHTML = '<b style="color:#2e7d32">● ' + s.user + "</b>" + a("progress/index.html", "Прогресс") + '<a href="#" data-logout style="color:#888;text-decoration:none">Выйти</a>';
      box.querySelector("[data-logout]").onclick = (e) => { e.preventDefault(); logout(); location.reload(); };
    } else {
      box.innerHTML = a("vhod/index.html?back=" + encodeURIComponent(location.href), "Войти");
    }
    document.body.appendChild(box);
  }

  let shownAt = Date.now(), visible = !document.hidden;
  function leave() {
    if (!visible) return;
    visible = false;
    const sec = Math.round((Date.now() - shownAt) / 1000);
    if (sec >= 2) track("time", { sec });
    flush(true);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) leave();
    else { visible = true; shownAt = Date.now(); }
  });
  window.addEventListener("pagehide", leave);

  window.Portal = { track, session, login, logout, getEvents, flush, base: BASE, user: USER };
  function loadAssistant() {
    if (!session() || !window.PORTAL_ASSISTANT) return;
    const s = document.createElement("script");
    s.src = BASE + "assets/assistant.js?v=3";
    s.defer = true;
    document.body.appendChild(s);
  }
  const start = () => { widget(); track("visit"); flush(false); loadAssistant(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
