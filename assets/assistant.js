(function () {
  if (!window.Portal || !Portal.session()) return;
  const CKEY = "uchportal-chat";
  const POLL_MS = 2000, WAIT_MS = 4 * 60 * 1000;
  const api = () => window.PORTAL_API || "";
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full */ } };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const chat = () => {
    let c = read(CKEY, null);
    if (!c || !c.chatId) { c = { chatId: newId(), messages: [], speak: false }; write(CKEY, c); }
    return c;
  };
  const save = (c) => { c.messages = c.messages.slice(-60); write(CKEY, c); };

  const css = `
  .ai-fab { position: fixed; right: 16px; bottom: 16px; z-index: 9000; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 0; border-radius: 28px; background: #0b57d0; color: #fff; font: 600 15px/1 system-ui, sans-serif; box-shadow: 0 6px 20px rgba(11,87,208,.35); cursor: pointer; }
  .ai-fab svg { width: 20px; height: 20px; }
  .ai-fab[hidden] { display: none; }
  .ai-panel { position: fixed; right: 16px; bottom: 16px; z-index: 9001; width: min(400px, calc(100vw - 24px)); height: min(600px, calc(100vh - 32px)); display: flex; flex-direction: column; background: #fff; border: 1px solid #d5dbe8; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.18); font: 15px/1.45 system-ui, sans-serif; color: #1f2430; overflow: hidden; }
  .ai-panel[hidden] { display: none; }
  .ai-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #0b57d0; color: #fff; }
  .ai-head b { flex: 1; font-size: 16px; }
  .ai-head button { border: 0; background: rgba(255,255,255,.16); color: #fff; border-radius: 8px; padding: 6px 9px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .ai-head button[aria-pressed="true"] { background: #fff; color: #0b57d0; }
  .ai-log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: #f6f8fc; scroll-behavior: smooth; }
  .ai-msg { max-width: 88%; padding: 9px 12px; border-radius: 14px; white-space: pre-wrap; word-wrap: break-word; }
  .ai-msg.q { align-self: flex-end; background: #0b57d0; color: #fff; border-bottom-right-radius: 4px; }
  .ai-msg.a { align-self: flex-start; background: #fff; border: 1px solid #e1e6f0; border-bottom-left-radius: 4px; }
  .ai-msg.err { align-self: flex-start; background: #fdecea; color: #8a1c13; }
  .ai-msg .say { display: inline-block; margin-top: 6px; border: 0; background: none; color: #0b57d0; font: 600 12px system-ui, sans-serif; cursor: pointer; padding: 0; }
  .ai-msg ul { margin: 4px 0; padding-left: 20px; white-space: normal; }
  .ai-hello { color: #5f6b7a; font-size: 14px; }
  .ai-hello button { display: block; margin: 6px 0 0; border: 1px solid #c9d6f0; background: #fff; color: #0b57d0; border-radius: 10px; padding: 6px 10px; font: 14px system-ui, sans-serif; cursor: pointer; text-align: left; }
  .ai-typing span { display: inline-block; width: 7px; height: 7px; margin: 0 2px; border-radius: 50%; background: #9aa6b8; animation: ai-b 1s infinite; }
  .ai-typing span:nth-child(2) { animation-delay: .15s; } .ai-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes ai-b { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
  .ai-form { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #e1e6f0; background: #fff; }
  .ai-form textarea { flex: 1; resize: none; height: 44px; max-height: 120px; padding: 10px; border: 1px solid #c9cfdb; border-radius: 10px; font: 15px/1.35 system-ui, sans-serif; }
  .ai-form button { flex: none; width: 44px; height: 44px; border: 0; border-radius: 10px; background: #0b57d0; color: #fff; cursor: pointer; display: grid; place-items: center; }
  .ai-form button.mic { background: #eef3fd; color: #0b57d0; }
  .ai-form button.mic.on { background: #d93025; color: #fff; animation: ai-p 1.2s infinite; }
  .ai-form button:disabled { opacity: .5; cursor: default; }
  .ai-form svg { width: 20px; height: 20px; }
  @keyframes ai-p { 50% { box-shadow: 0 0 0 6px rgba(217,48,37,.2); } }
  @media (max-width: 600px) { .ai-panel { inset: 0; width: auto; height: auto; border-radius: 0; border: 0; } .ai-fab span { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z"/></svg>';
  const ICON_MIC = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5 21 12 3 3.5V10l12 2-12 2z"/></svg>';

  const fab = document.createElement("button");
  fab.className = "ai-fab";
  fab.type = "button";
  fab.innerHTML = ICON_CHAT + "<span>Помощник</span>";
  fab.title = "Задать вопрос помощнику";
  const panel = document.createElement("section");
  panel.className = "ai-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Помощник");
  panel.innerHTML =
    '<div class="ai-head"><b>Помощник</b>' +
    '<button type="button" data-speak title="Читать ответы вслух">Голос</button>' +
    '<button type="button" data-new title="Начать новый разговор">Новый</button>' +
    '<button type="button" data-close title="Закрыть">✕</button></div>' +
    '<div class="ai-log" aria-live="polite"></div>' +
    '<form class="ai-form"><button type="button" class="mic" title="Спросить голосом">' + ICON_MIC + "</button>" +
    '<textarea placeholder="Спроси что-нибудь по учёбе…" rows="1"></textarea>' +
    '<button type="submit" title="Отправить">' + ICON_SEND + "</button></form>";
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const log = panel.querySelector(".ai-log");
  const form = panel.querySelector("form");
  const input = form.querySelector("textarea");
  const sendBtn = form.querySelector('button[type="submit"]');
  const micBtn = form.querySelector(".mic");
  const speakBtn = panel.querySelector("[data-speak]");
  let busy = false;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function rich(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "$1").split("\n");
    let out = "", inList = false;
    lines.forEach((l) => {
      const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + m[1] + "</li>"; return; }
      if (inList) { out += "</ul>"; inList = false; }
      out += l + "\n";
    });
    if (inList) out += "</ul>";
    return out.replace(/\n+$/, "");
  }
  const plain = (text) => String(text).replace(/\*\*|`|#+\s/g, "").replace(/^\s*[-*•]\s+/gm, "");

  function bubble(m) {
    const d = document.createElement("div");
    d.className = "ai-msg " + m.role;
    d.innerHTML = m.role === "q" ? esc(m.text) : rich(m.text);
    if (m.role === "a" && "speechSynthesis" in window) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "say";
      b.textContent = "Прочитать вслух";
      b.onclick = () => say(m.text);
      d.appendChild(document.createElement("br"));
      d.appendChild(b);
    }
    log.appendChild(d);
    return d;
  }
  function render() {
    const c = chat();
    log.textContent = "";
    if (!c.messages.length) {
      const h = document.createElement("div");
      h.className = "ai-hello";
      h.innerHTML = "Привет, Дима! Я помощник учебного центра. Спроси меня про химию, геометрию, русский или алгебру — текстом или голосом.";
      ["Что такое алкены?", "Как строить сечение куба методом следов?", "Когда ставятся запятые при причастном обороте?"].forEach((q) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = q;
        b.onclick = () => ask(q, false);
        h.appendChild(b);
      });
      log.appendChild(h);
    }
    c.messages.forEach(bubble);
    speakBtn.setAttribute("aria-pressed", c.speak ? "true" : "false");
    log.scrollTop = log.scrollHeight;
  }

  function say(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain(text));
    u.lang = "ru-RU";
    const v = speechSynthesis.getVoices().find((x) => /^ru/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ask(text, byVoice) {
    text = String(text || "").trim();
    if (!text || busy) return;
    const s = Portal.session();
    const c = chat();
    c.messages.push({ role: "q", text, ts: Date.now() });
    save(c);
    render();
    input.value = "";
    busy = true;
    sendBtn.disabled = true;
    const typing = document.createElement("div");
    typing.className = "ai-msg a ai-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    const t0 = Date.now();
    Portal.track("ai_ask", { voice: !!byVoice, len: text.length });
    let reply;
    try {
      if (!api() || !s.token) throw new Error("Помощник работает только при входе через сервер. Выйди и войди снова.");
      const r = await fetch(api(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "ask", token: s.token, chatId: c.chatId, message: text, page: location.pathname, title: document.title }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error === "auth" ? "Сессия устарела. Выйди и войди снова." : r.error || "Помощник не ответил.");
      while (Date.now() - t0 < WAIT_MS) {
        await sleep(POLL_MS);
        const a = await fetch(api() + "?action=answer&token=" + encodeURIComponent(s.token) + "&reqId=" + encodeURIComponent(r.reqId)).then((x) => x.json()).catch(() => null);
        if (a && a.ok && a.done) { reply = a.error ? { role: "err", text: a.error } : { role: "a", text: a.text }; break; }
      }
      if (!reply) throw new Error("Помощник думает слишком долго. Попробуй спросить ещё раз.");
    } catch (e) {
      reply = { role: "err", text: e.message || "Ошибка связи." };
    }
    typing.remove();
    reply.ts = Date.now();
    const c2 = chat();
    c2.messages.push(reply);
    save(c2);
    render();
    busy = false;
    sendBtn.disabled = false;
    Portal.track("ai_answer", { ok: reply.role === "a", sec: Math.round((Date.now() - t0) / 1000) });
    if (reply.role === "a" && (c2.speak || byVoice)) say(reply.text);
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value, false); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value, false); } });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (!SR) micBtn.hidden = true;
  micBtn.onclick = () => {
    if (rec) { rec.stop(); return; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    rec = new SR();
    rec.lang = "ru-RU";
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    rec.onerror = (e) => { if (e.error === "not-allowed") input.placeholder = "Разреши доступ к микрофону в браузере."; };
    rec.onend = () => {
      micBtn.classList.remove("on");
      rec = null;
      if (finalText.trim()) ask(finalText, true);
    };
    micBtn.classList.add("on");
    rec.start();
  };

  speakBtn.onclick = () => {
    const c = chat();
    c.speak = !c.speak;
    save(c);
    speakBtn.setAttribute("aria-pressed", c.speak ? "true" : "false");
    if (!c.speak && "speechSynthesis" in window) speechSynthesis.cancel();
  };
  panel.querySelector("[data-new]").onclick = () => {
    if (busy) return;
    const c = chat();
    write(CKEY, { chatId: newId(), messages: [], speak: c.speak });
    render();
  };
  const open = (on) => {
    panel.hidden = !on;
    fab.hidden = on;
    if (on) { render(); input.focus(); }
    else if ("speechSynthesis" in window) speechSynthesis.cancel();
  };
  fab.onclick = () => open(true);
  panel.querySelector("[data-close]").onclick = () => open(false);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) open(false); });
})();
