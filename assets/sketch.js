(function () {
  "use strict";
  const COLORS = [["#1a1a1a", "Чёрная"], ["#0b57d0", "Синяя"], ["#c62828", "Красная"], ["#2e7d32", "Зелёная"]];
  const SIZES = [[2, "Тонко"], [3.5, "Средне"], [6, "Толсто"]];

  const css = `
  .sk { font-family: system-ui, sans-serif; border: 1px solid #d5dbe8; border-radius: 10px; background: #fff; overflow: hidden; }
  .sk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #e1e6f0; background: #f6f8fc; }
  .sk-bar button { height: 34px; min-width: 34px; padding: 0 9px; border: 1px solid #c9cfdb; border-radius: 7px; background: #fff; font: 14px system-ui, sans-serif; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
  .sk-bar button.on { border-color: #0b57d0; box-shadow: 0 0 0 2px #0b57d0 inset; background: #eef3fd; }
  .sk-bar button:disabled { opacity: .4; cursor: default; }
  .sk-bar .dot { width: 16px; height: 16px; border-radius: 50%; }
  .sk-bar .ln { display: inline-block; width: 16px; border-radius: 3px; background: #333; }
  .sk-bar .sep { width: 1px; height: 24px; background: #d5dbe8; margin: 0 2px; }
  .sk-bar .grow { flex: 1; }
  .sk-wrap { position: relative; height: 340px; touch-action: none; cursor: crosshair;
    background-color: #fffef7; background-image: linear-gradient(rgba(90,130,200,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90,130,200,.16) 1px, transparent 1px); background-size: 22px 22px; }
  .sk-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
  .sk-wrap.eraser { cursor: cell; }
  .sk-empty { position: absolute; inset: 0; display: grid; place-items: center; color: #9aa6b8; font-size: 15px; pointer-events: none; text-align: center; padding: 12px; }
  .sk.fs { position: fixed; inset: 0; z-index: 9500; border-radius: 0; border: 0; display: flex; flex-direction: column; }
  .sk.fs .sk-wrap { flex: 1; height: auto; }
  html.sk-lock, html.sk-lock body { overflow: hidden; }
  @media (max-width: 600px) { .sk-wrap { height: 280px; } .sk-bar .lbl { display: none; } }`;

  let styled = false;
  function Sketch(host, opts) {
    opts = opts || {};
    if (!styled) { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); styled = true; }
    host.classList.add("sk");
    host.innerHTML =
      '<div class="sk-bar">' +
      COLORS.map(([c, n], i) => '<button type="button" data-color="' + c + '" title="' + n + ' ручка"' + (i ? "" : ' class="on"') + '><span class="dot" style="background:' + c + '"></span></button>').join("") +
      '<span class="sep"></span>' +
      SIZES.map(([w, n], i) => '<button type="button" data-size="' + w + '" title="' + n + '"' + (i === 1 ? ' class="on"' : "") + '><span class="ln" style="height:' + Math.round(w) + 'px"></span></button>').join("") +
      '<span class="sep"></span>' +
      '<button type="button" data-tool="eraser" title="Ластик: проведи по линии, чтобы стереть её">🧽<span class="lbl"> Ластик</span></button>' +
      '<button type="button" data-act="undo" title="Отменить (Ctrl+Z)" disabled>↶<span class="lbl"> Отменить</span></button>' +
      '<button type="button" data-act="redo" title="Вернуть" disabled>↷</button>' +
      '<button type="button" data-act="clear" title="Стереть всё" disabled>🗑<span class="lbl"> Очистить</span></button>' +
      '<span class="grow"></span>' +
      '<button type="button" data-act="fs" title="На весь экран">⛶<span class="lbl"> На весь экран</span></button>' +
      "</div>" +
      '<div class="sk-wrap"><canvas></canvas><div class="sk-empty">' + (opts.placeholder || "Пиши здесь пером планшета, пальцем или мышью") + "</div></div>";

    const wrap = host.querySelector(".sk-wrap"), cv = host.querySelector("canvas"), ctx = cv.getContext("2d");
    const emptyEl = host.querySelector(".sk-empty");
    let strokes = [], redo = [], cur = null, color = COLORS[0][0], size = SIZES[1][0], eraser = false, erasing = false, penSeen = 0, dpr = 1, activeId = null;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(wrap.clientWidth * dpr));
      cv.height = Math.max(1, Math.round(wrap.clientHeight * dpr));
      redraw();
    }
    const width = (s, p) => s.w * (s.pen ? 0.35 + 1.3 * p : 1);
    function seg(c, s, a, b, k) {
      c.strokeStyle = s.c;
      c.lineWidth = width(s, b[2]) * k;
      c.beginPath();
      c.moveTo(a[0] * k, a[1] * k);
      c.lineTo(b[0] * k, b[1] * k);
      c.stroke();
    }
    function drawStroke(c, s, k, dx, dy) {
      c.lineCap = "round";
      c.lineJoin = "round";
      const P = s.p.map((q) => [q[0] - (dx || 0), q[1] - (dy || 0), q[2]]);
      if (P.length === 1) { c.fillStyle = s.c; c.beginPath(); c.arc(P[0][0] * k, P[0][1] * k, (width(s, P[0][2]) * k) / 2, 0, 7); c.fill(); return; }
      for (let i = 1; i < P.length; i++) seg(c, s, P[i - 1], P[i], k);
    }
    function redraw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      strokes.forEach((s) => drawStroke(ctx, s, dpr));
      if (cur) drawStroke(ctx, cur, dpr);
      ui();
    }
    function ui() {
      emptyEl.hidden = strokes.length > 0 || !!cur;
      host.querySelector('[data-act="undo"]').disabled = !strokes.length;
      host.querySelector('[data-act="redo"]').disabled = !redo.length;
      host.querySelector('[data-act="clear"]').disabled = !strokes.length;
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5]; };
    function eraseAt(x, y) {
      const R = 10;
      const before = strokes.length;
      strokes = strokes.filter((s) => !s.p.some((q, i) => {
        const a = s.p[Math.max(0, i - 1)];
        const vx = q[0] - a[0], vy = q[1] - a[1], L = vx * vx + vy * vy;
        const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L)) : 0;
        const px = a[0] + t * vx - x, py = a[1] + t * vy - y;
        return px * px + py * py <= (R + s.w) * (R + s.w);
      }));
      if (strokes.length !== before) { redo = []; redraw(); changed(); }
    }
    function changed() { if (opts.onChange) opts.onChange(); }

    cv.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen") penSeen = Date.now();
      if (e.pointerType === "touch" && Date.now() - penSeen < 3000) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (activeId !== null) return;
      e.preventDefault();
      activeId = e.pointerId;
      cv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      erasing = eraser || (e.buttons & 32) === 32;
      if (erasing) { eraseAt(x, y); return; }
      cur = { c: color, w: size, pen: e.pointerType === "pen", p: [pos(e)] };
      redraw();
    });
    cv.addEventListener("pointermove", (e) => {
      if (e.pointerId !== activeId) return;
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of list.length ? list : [e]) {
        const p = pos(ev);
        if (erasing) { eraseAt(p[0], p[1]); continue; }
        const last = cur.p[cur.p.length - 1];
        if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.8) continue;
        cur.p.push(p);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineCap = "round";
        seg(ctx, cur, last, p, dpr);
      }
    });
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      if (cur) { strokes.push(cur); cur = null; redo = []; redraw(); changed(); }
      erasing = false;
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("contextmenu", (e) => e.preventDefault());

    host.querySelector(".sk-bar").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.color) {
        color = b.dataset.color;
        eraser = false;
        host.querySelectorAll("[data-color], [data-tool]").forEach((x) => x.classList.toggle("on", x === b));
      } else if (b.dataset.size) {
        size = +b.dataset.size;
        host.querySelectorAll("[data-size]").forEach((x) => x.classList.toggle("on", x === b));
      } else if (b.dataset.tool === "eraser") {
        eraser = !eraser;
        b.classList.toggle("on", eraser);
        host.querySelectorAll("[data-color]").forEach((x) => x.classList.toggle("on", !eraser && x.dataset.color === color));
      } else if (b.dataset.act === "undo") undo();
      else if (b.dataset.act === "redo") { if (redo.length) { strokes.push(redo.pop()); redraw(); changed(); } }
      else if (b.dataset.act === "clear") { if (strokes.length) { redo = strokes.slice().reverse(); strokes = []; redraw(); changed(); } }
      else if (b.dataset.act === "fs") setFs(!host.classList.contains("fs"));
      wrap.classList.toggle("eraser", eraser);
    });
    function undo() { if (strokes.length) { redo.push(strokes.pop()); redraw(); changed(); } }
    host.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); } });
    host.tabIndex = -1;

    function setFs(on) {
      host.classList.toggle("fs", on);
      document.documentElement.classList.toggle("sk-lock", on);
      const b = host.querySelector('[data-act="fs"]');
      b.innerHTML = on ? "✕<span class=\"lbl\"> Свернуть</span>" : "⛶<span class=\"lbl\"> На весь экран</span>";
      if (on && host.requestFullscreen && !document.fullscreenElement) host.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement === host) document.exitFullscreen().catch(() => {});
      requestAnimationFrame(resize);
    }
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && host.classList.contains("fs")) setFs(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && host.classList.contains("fs")) setFs(false); });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    window.addEventListener("resize", resize);
    resize();

    function toImage(maxSide) {
      if (!strokes.length) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      strokes.forEach((s) => s.p.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
      const pad = 24;
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      let w = x1 - x0, h = y1 - y0;
      if (w < 240) { x0 -= (240 - w) / 2; w = 240; }
      if (h < 120) { y0 -= (120 - h) / 2; h = 120; }
      const k = Math.min(2, (maxSide || 1600) / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * k);
      c.height = Math.round(h * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      strokes.forEach((s) => drawStroke(g, s, k, x0, y0));
      const url = c.toDataURL("image/png");
      const t = document.createElement("canvas"), tk = Math.min(1, 160 / Math.max(c.width, c.height));
      t.width = Math.round(c.width * tk);
      t.height = Math.round(c.height * tk);
      t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
      return { mime: "image/png", data: url.slice(url.indexOf(",") + 1), thumb: t.toDataURL("image/jpeg", 0.8) };
    }

    return {
      clear() { strokes = []; redo = []; cur = null; redraw(); },
      isEmpty: () => !strokes.length,
      toImage,
      resize,
      exitFs() { if (host.classList.contains("fs")) setFs(false); },
    };
  }
  window.Sketch = Sketch;
})();
