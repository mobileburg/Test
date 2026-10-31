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
    if (!c || !c.chatId) { c = { chatId: newId(), messages: [] }; write(CKEY, c); }
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
  .ai-log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: #f6f8fc; scroll-behavior: smooth; }
  .ai-msg { max-width: 88%; padding: 9px 12px; border-radius: 14px; white-space: pre-wrap; word-wrap: break-word; }
  .ai-msg.q { align-self: flex-end; background: #0b57d0; color: #fff; border-bottom-right-radius: 4px; }
  .ai-msg.a { align-self: flex-start; background: #fff; border: 1px solid #e1e6f0; border-bottom-left-radius: 4px; }
  .ai-msg.err { align-self: flex-start; background: #fdecea; color: #8a1c13; }
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
  .ai-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px 0; border-top: 1px solid #e1e6f0; background: #fff; }
  .ai-tools > button { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #c9d6f0; background: #fff; color: #0b57d0; border-radius: 16px; padding: 5px 10px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .ai-tools > button[hidden] { display: none; }
  .ai-tools > button svg { width: 16px; height: 16px; }
  .ai-tools > button.live { background: #e6f4ea; border-color: #81c995; color: #137333; }
  .ai-tools > button.attn { animation: ai-p 1.2s infinite; border-color: #0b57d0; }
  .ai-chips { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
  .ai-chips:empty { display: none; }
  .ai-chip { position: relative; display: flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 26px 4px 4px; border: 1px solid #d5dbe8; border-radius: 10px; background: #f6f8fc; font-size: 13px; }
  .ai-chip img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; }
  .ai-chip .nm { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ai-chip .ic { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 6px; background: #e8eefb; color: #0b57d0; font: 700 11px system-ui, sans-serif; }
  .ai-chip button { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border: 0; border-radius: 50%; background: #dfe4ee; color: #333; cursor: pointer; font-size: 12px; line-height: 1; }
  .ai-msg .att { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px; margin-bottom: 6px; }
  .ai-msg .att img { width: 96px; max-height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,.5); }
  .ai-msg .att span { padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,.18); font-size: 13px; }
  .ai-msg.note { align-self: center; max-width: 95%; background: #fff7e0; color: #6b4e00; font-size: 14px; }
  .ai-panel.drop::after { content: "Отпусти файл, чтобы приложить"; position: absolute; inset: 0; display: grid; place-items: center; background: rgba(11,87,208,.12); border: 3px dashed #0b57d0; border-radius: inherit; font: 600 17px system-ui, sans-serif; color: #0b57d0; pointer-events: none; }
  .ai-form { border-top: 0; }
  .ai-msg .katex { font-size: 1.12em; }
  .ai-msg .katex-display { margin: 6px 0; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
  @media (max-width: 600px) { .ai-panel { inset: 0; width: auto; height: auto; border-radius: 0; border: 0; } .ai-fab span { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z"/></svg>';
  const ICON_MIC = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>';
  const ICON_CLIP = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6.5v10a4.5 4.5 0 0 1-9 0V5a3 3 0 0 1 6 0v10.5a1.5 1.5 0 0 1-3 0V6.5H9v9a3 3 0 0 0 6 0V5a4.5 4.5 0 0 0-9 0v11.5a6 6 0 0 0 12 0v-10z"/></svg>';
  const ICON_SCREEN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6z"/></svg>';
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
    '<button type="button" data-new title="Начать новый разговор">Новый</button>' +
    '<button type="button" data-close title="Закрыть">✕</button></div>' +
    '<div class="ai-log" aria-live="polite"></div>' +
    '<div class="ai-tools"><button type="button" data-file title="Приложить фото, PDF или текстовый файл">' + ICON_CLIP + "Файл</button>" +
    '<button type="button" data-screen title="Показать помощнику экран">' + ICON_SCREEN + "<span>Экран</span></button>" +
    '<button type="button" data-unshare hidden title="Перестать показывать экран">✕ Не показывать</button>' +
    '<div class="ai-chips"></div><input type="file" multiple hidden accept="image/*,application/pdf,.txt,.md,.csv,.json,.html,.css,.js,.py,.xml,.log"></div>' +
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
  const fileBtn = panel.querySelector("[data-file]");
  const screenBtn = panel.querySelector("[data-screen]");
  const unshareBtn = panel.querySelector("[data-unshare]");
  const chipsBox = panel.querySelector(".ai-chips");
  const fileInput = panel.querySelector('input[type="file"]');
  let busy = false;
  let pending = [];
  let kept = [];
  let waitScreen = null;
  let screen = null;

  const MAX_FILES = 6, MAX_TOTAL = 10 * 1024 * 1024, IMG_SIDE = 1600, THUMB = 160;
  const TEXT_EXT = /\.(txt|md|csv|json|html?|css|js|py|xml|log)$/i;
  const LOOK_RE = /(смотр|посмотр|глян|взгля|видишь|увидь)[а-яё]*\s+(на\s+)?(мо[йём]\s+)?экран|что\s+(у\s+меня\s+)?на\s+экране|на\s+экран[ае]?\s*(смотри|посмотри|глянь)/i;
  const b64size = (files) => files.reduce((n, f) => n + (f.data ? f.data.length * 0.75 : f.text.length), 0);

  function drawTo(src, w, h, side, q) {
    const k = Math.min(1, side / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  }
  const fromDataUrl = (u) => u.slice(u.indexOf(",") + 1);
  const readAs = (file, how) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(r.error); r[how](file); });

  async function toAttachment(file) {
    const name = file.name || "файл";
    if (/^image\//.test(file.type)) {
      try {
        const bmp = await createImageBitmap(file);
        const a = { name, mime: "image/jpeg", data: fromDataUrl(drawTo(bmp, bmp.width, bmp.height, IMG_SIDE, 0.85)), thumb: drawTo(bmp, bmp.width, bmp.height, THUMB, 0.7) };
        bmp.close && bmp.close();
        return a;
      } catch (e) {
        if (/heic|heif/.test(file.type)) return { name, mime: file.type, data: fromDataUrl(await readAs(file, "readAsDataURL")) };
        throw new Error("Не получилось открыть картинку «" + name + "».");
      }
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(name)) return { name, mime: "application/pdf", data: fromDataUrl(await readAs(file, "readAsDataURL")) };
    if (/^text\//.test(file.type) || TEXT_EXT.test(name) || file.type === "application/json") return { name, text: String(await readAs(file, "readAsText")).slice(0, 200000) };
    throw new Error("Файл «" + name + "» пока не поддерживается. Подойдут фото, скриншоты, PDF и текстовые файлы; документ Word можно сохранить как PDF.");
  }

  function note(text) {
    const d = document.createElement("div");
    d.className = "ai-msg note";
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  async function addFiles(list) {
    for (const file of list) {
      if (pending.length >= MAX_FILES) { note("Можно приложить не больше " + MAX_FILES + " файлов за раз."); break; }
      if (file.size > MAX_TOTAL) { note("Файл «" + file.name + "» больше 10 МБ."); continue; }
      try {
        const a = await toAttachment(file);
        if (b64size(pending) + b64size([a]) > MAX_TOTAL) { note("Вместе файлы больше 10 МБ — убери что-нибудь."); break; }
        pending.push(a);
      } catch (e) { note(e.message); }
    }
    chips();
  }

  function chips() {
    chipsBox.textContent = "";
    pending.forEach((a, i) => {
      const c = document.createElement("div");
      c.className = "ai-chip";
      c.title = a.name;
      c.innerHTML = (a.thumb ? '<img alt="">' : '<span class="ic"></span>') + '<span class="nm"></span><button type="button" title="Убрать">✕</button>';
      if (a.thumb) c.querySelector("img").src = a.thumb;
      else c.querySelector(".ic").textContent = a.mime === "application/pdf" ? "PDF" : "TXT";
      c.querySelector(".nm").textContent = a.name;
      c.querySelector("button").onclick = () => { pending.splice(i, 1); chips(); };
      chipsBox.appendChild(c);
    });
  }

  const canShare = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  if (!canShare) screenBtn.hidden = true;
  function screenUi() {
    screenBtn.classList.toggle("live", !!screen);
    screenBtn.classList.toggle("attn", !!waitScreen && !screen);
    screenBtn.querySelector("span").textContent = screen ? "Снимок экрана" : "Экран";
    screenBtn.title = screen ? "Приложить свежий снимок экрана" : "Показать помощнику экран";
    unshareBtn.hidden = !screen;
  }
  function stopShare() {
    if (screen) screen.stream.getTracks().forEach((t) => t.stop());
    screen = null;
    screenUi();
  }
  async function startShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => { if (screen && screen.stream === stream) { screen = null; screenUi(); } });
    screen = { stream, video, surface: (track.getSettings && track.getSettings().displaySurface) || "" };
    screenUi();
    await sleep(400);
  }
  async function snapshot() {
    const hide = screen.surface !== "window";
    if (hide) { panel.style.visibility = "hidden"; await sleep(450); }
    const v = screen.video;
    let shot;
    try {
      shot = { name: "Снимок экрана " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), mime: "image/jpeg", data: fromDataUrl(drawTo(v, v.videoWidth, v.videoHeight, 2000, 0.82)), thumb: drawTo(v, v.videoWidth, v.videoHeight, THUMB, 0.7), screen: true };
    } finally {
      if (hide) panel.style.visibility = "";
    }
    return shot;
  }
  async function screenClick() {
    try {
      if (!screen) await startShare();
      const shot = await snapshot();
      if (waitScreen) {
        const w = waitScreen;
        waitScreen = null;
        screenUi();
        ask(w.text, w.byVoice, shot);
        return;
      }
      pending = pending.filter((a) => !a.screen).concat(shot).slice(-MAX_FILES);
      chips();
    } catch (e) {
      if (e && e.name !== "NotAllowedError" && e.name !== "AbortError") note("Не получилось показать экран: " + (e.message || e.name));
      waitScreen = null;
      screenUi();
    }
  }
  screenBtn.onclick = screenClick;
  unshareBtn.onclick = stopShare;
  fileBtn.onclick = () => fileInput.click();
  fileInput.onchange = () => { addFiles([...fileInput.files]); fileInput.value = ""; };
  input.addEventListener("paste", (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  let dragDepth = 0;
  panel.addEventListener("dragenter", (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); dragDepth++; panel.classList.add("drop"); } });
  panel.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  panel.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; panel.classList.remove("drop"); } });
  panel.addEventListener("drop", (e) => { e.preventDefault(); dragDepth = 0; panel.classList.remove("drop"); addFiles([...e.dataTransfer.files]); });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
  const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  function loadKatex() {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = KATEX + "katex.min.css";
    document.head.appendChild(l);
    const sc = document.createElement("script");
    sc.src = KATEX + "katex.min.js";
    sc.onload = () => log.querySelectorAll(".ai-msg.a[data-tex]").forEach((d) => { d.innerHTML = rich(d._text); });
    document.head.appendChild(sc);
  }
  function tex(src, display) {
    if (!window.katex) return esc(display ? "$$" + src + "$$" : "$" + src + "$");
    if (!display) src = src.replace(/\\frac(?![a-z])/g, "\\dfrac");
    try { return katex.renderToString(src.trim(), { displayMode: display, throwOnError: false, strict: "ignore" }); } catch (e) { return esc(src); }
  }
  function rich(text) {
    const math = [];
    text = String(text).replace(MATH_RE, (all, dd, br, pa, d) => {
      const display = !!(dd || br);
      math.push(tex(dd || br || pa || d, display));
      const mark = display ? "\u0001" : "\u0000";
      return mark + (math.length - 1) + mark;
    });
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "$1").split("\n");
    let out = "", inList = false;
    lines.forEach((l) => {
      const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + m[1] + "</li>"; return; }
      if (inList) { out += "</ul>"; inList = false; }
      out += l + "\n";
    });
    if (inList) out += "</ul>";
    return out.replace(/\n+$/, "").replace(/\n*\u0001(\d+)\u0001\n*/g, (all, i) => math[i]).replace(/\u0000(\d+)\u0000/g, (all, i) => math[i]);
  }

  function bubble(m) {
    const d = document.createElement("div");
    d.className = "ai-msg " + m.role;
    d.innerHTML = m.role === "q" ? esc(m.text) : rich(m.text);
    if (m.role === "a" && !window.katex && MATH_RE.test(m.text)) { d.dataset.tex = "1"; d._text = m.text; }
    MATH_RE.lastIndex = 0;
    if (m.att && m.att.length) {
      const box = document.createElement("div");
      box.className = "att";
      m.att.forEach((a) => {
        const el = document.createElement(a.thumb ? "img" : "span");
        if (a.thumb) { el.src = a.thumb; el.alt = a.name; el.title = a.name; } else el.textContent = a.name;
        box.appendChild(el);
      });
      d.prepend(box);
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
      h.innerHTML = "Привет, Дима! Я помощник учебного центра. Спроси меня про химию, геометрию, русский, литературу или алгебру — текстом или голосом.";
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
    log.scrollTop = log.scrollHeight;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ask(text, byVoice, shot) {
    text = String(text || "").trim();
    if (busy || (!text && !pending.length && !shot)) return;
    if (!shot && LOOK_RE.test(text) && !pending.some((a) => a.screen)) {
      if (screen) shot = await snapshot().catch(() => null);
      else if (canShare) {
        waitScreen = { text, byVoice };
        screenUi();
        input.value = "";
        note("Нажми «Экран» и выбери, что показать, — тогда я посмотрю и отвечу.");
        return;
      } else {
        note("На этом устройстве браузер не умеет показывать экран. Сделай скриншот и приложи его кнопкой «Файл».");
        return;
      }
    }
    const files = pending.concat(shot ? [shot] : []);
    pending = [];
    chips();
    const isScreen = files.some((a) => a.screen);
    const s = Portal.session();
    const c = chat();
    c.messages.push({ role: "q", text, ts: Date.now(), att: files.map((a) => ({ name: a.name, thumb: a.thumb })) });
    save(c);
    render();
    input.value = "";
    input.style.height = "";
    busy = true;
    sendBtn.disabled = true;
    const typing = document.createElement("div");
    typing.className = "ai-msg a ai-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    const t0 = Date.now();
    Portal.track("ai_ask", { voice: !!byVoice, len: text.length, files: files.length, screen: isScreen });
    const wire = (list) => list.map((a) => (a.text !== undefined ? { name: a.name, text: a.text } : { name: a.name, mime: a.mime, data: a.data }));
    let reply;
    try {
      if (!api() || !s.token) throw new Error("Помощник работает только при входе через сервер. Выйди и войди снова.");
      const r = await fetch(api(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "ask", token: s.token, chatId: c.chatId, message: text, page: location.pathname, title: document.title, files: wire(files), keep: files.length ? [] : wire(kept), screen: isScreen }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error === "auth" ? "Сессия устарела. Выйди и войди снова." : r.error || "Помощник не ответил.");
      if (r.done) reply = { role: "a", text: r.text };
      if (files.length) kept = files.filter((a) => !a.screen || files.length === 1).slice(-3);
      while (!reply && Date.now() - t0 < WAIT_MS) {
        await sleep(POLL_MS);
        const a = await fetch(api() + "?action=answer&token=" + encodeURIComponent(s.token) + "&reqId=" + encodeURIComponent(r.reqId)).then((x) => x.json()).catch(() => null);
        if (a && a.ok && a.done) { reply = a.error ? { role: "err", text: a.error } : { role: "a", text: a.text }; break; }
      }
      if (!reply) throw new Error("Помощник думает слишком долго. Попробуй спросить ещё раз.");
    } catch (e) {
      reply = { role: "err", text: e.message || "Ошибка связи." };
    }
    typing.remove();
    if (reply.role === "err" && !pending.length) { pending = files.filter((a) => !a.screen); chips(); }
    reply.ts = Date.now();
    const c2 = chat();
    c2.messages.push(reply);
    save(c2);
    render();
    busy = false;
    sendBtn.disabled = false;
    Portal.track("ai_answer", { ok: reply.role === "a", sec: Math.round((Date.now() - t0) / 1000) });
  }

  const grow = () => { input.style.height = ""; input.style.height = Math.min(120, Math.max(44, input.scrollHeight + 2)) + "px"; };
  input.addEventListener("input", grow);
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value, false); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value, false); } });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (!SR) micBtn.hidden = true;
  micBtn.onclick = () => {
    if (rec) { rec.stop(); return; }
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

  panel.querySelector("[data-new]").onclick = () => {
    if (busy) return;
    write(CKEY, { chatId: newId(), messages: [] });
    pending = [];
    kept = [];
    chips();
    render();
  };
  const open = (on) => {
    panel.hidden = !on;
    fab.hidden = on;
    if (on) { render(); input.focus(); }
  };
  fab.onclick = () => open(true);
  panel.querySelector("[data-close]").onclick = () => open(false);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) open(false); });

  window.PortalAssistant = {
    ask(text, opts) {
      open(true);
      if (opts && opts.files && opts.files.length) { pending = pending.concat(opts.files).slice(-MAX_FILES); chips(); }
      if (opts && opts.send) { ask(text, false); return; }
      input.value = text;
      input.focus();
      input.setSelectionRange(text.length, text.length);
      grow();
      input.scrollTop = input.scrollHeight;
    },
  };
  loadKatex();
  document.dispatchEvent(new Event("portal-assistant-ready"));
})();
