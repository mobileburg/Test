// Общий движок тренажёров раздела «Алгебра»: темы, проверка ответа, лестница подсказок,
// письмо от руки, помощник и статистика.
// Страница вызывает AlgTrainer({ tasks, storeKey, ev, name, noun }), где tasks отдаёт
// TOPICS, make(topic), check(task, value) и preview(task, value).
(function () {
  window.AlgTrainer = function (cfg) {
    const E = cfg.tasks;
    const SKEY = cfg.storeKey;
    const EV = cfg.ev;
    const NOUN = cfg.noun || { other: "Другое уравнение", next: "Следующее уравнение →" };
    const LEVELS = ["С чего начать", "Подробный план", "Объясняю с нуля"];
    const read = () => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } };
    const write = (v) => { try { localStorage.setItem(SKEY, JSON.stringify(v)); } catch (e) { /* storage full */ } };
    const track = (type, data) => { if (window.Portal) Portal.track(EV + "_" + type, data); };
    const topicsBox = document.querySelector(".topics");
    const box = document.getElementById("task");
    const AKEY = "uchportal-about";
    const about = document.createElement("details");
    about.className = "about";
    about.open = localStorage.getItem(AKEY) !== "closed";
    about.addEventListener("toggle", () => { try { localStorage.setItem(AKEY, about.open ? "" : "closed"); } catch (e) { /* storage full */ } });
    box.parentNode.insertBefore(about, box);
    const MASTER = 3;
    const groupButtons = [...document.querySelectorAll(".groups button")];
    const groupName = (g) => { const b = groupButtons.find((x) => x.dataset.group === g); return b ? b.textContent : ""; };

    const params = new URLSearchParams(location.search);
    let group = groupButtons.some((b) => b.dataset.group === params.get("g")) ? params.get("g") : groupButtons[0].dataset.group;
    let topic = E.TOPICS.find((t) => t.id === params.get("t")) ? params.get("t") : null;
    if (topic) group = E.TOPICS.find((t) => t.id === topic).group;
    if (!topic) topic = E.TOPICS.find((t) => t.group === group).id;

    let task, st, counter = 0;

    const KEYS = {
      ode: [["C", "C"], ["C₁", "C1"], ["C₂", "C2"], ["x", "x"], ["eˣ", "e^()"], ["xⁿ", "^"], ["sin", "sin()"], ["cos", "cos()"], ["ln", "ln()"], ["√", "sqrt()"], ["·", "*"], ["/", "/"], ["( )", "()"]],
      roots: [["нет корней", "!none"], [";", "; "], ["/", "/"], ["√", "sqrt()"], ["−", "-"]],
      num: [["/", "/"], ["−", "-"], ["√", "sqrt()"], ["xⁿ", "^"], ["( )", "()"]],
      interval: [["(", "("], [")", ")"], ["[", "["], ["]", "]"], [";", "; "], ["−∞", "-∞"], ["+∞", "+∞"], ["∪", " ∪ "], ["<", "<"], [">", ">"], ["≤", "≤"], ["≥", "≥"], ["/", "/"], ["нет решений", "!empty"]],
    };
    const LABEL = { ode: "y =", roots: "x =", num: "Ответ:", interval: "Ответ:" };
    const HOLDER = { ode: "например, C*e^(2x)", roots: "например, 2; -3", num: "например, 1/8", interval: "например, (-∞; 2] или x > 3" };

    function plain(html) {
      const d = document.createElement("div");
      d.innerHTML = html;
      d.querySelectorAll("sup").forEach((s) => s.replaceWith("^(" + s.textContent + ")"));
      d.querySelectorAll("sub").forEach((s) => s.replaceWith("_" + s.textContent));
      d.querySelectorAll(".fr").forEach((f) => f.replaceWith("(" + f.children[0].textContent + ")/(" + f.children[1].textContent + ")"));
      return d.textContent.replace(/\s+/g, " ").trim();
    }

    function drawTopics() {
      groupButtons.forEach((b) => b.classList.toggle("on", b.dataset.group === group));
      const stats = read();
      topicsBox.textContent = "";
      E.TOPICS.filter((t) => t.group === group).forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = (t.id === topic ? "on " : "") + ((stats[t.id] || {}).solved ? "has" : "");
        const s = stats[t.id] || {};
        b.innerHTML = "<b></b><small></small>" + (s.solved ? '<span class="badge' + ((s.self || 0) >= MASTER ? " done" : "") + '">' + ((s.self || 0) >= MASTER ? "освоено" : "✓ " + s.solved) + "</span>" : "");
        b.querySelector("b").textContent = t.title;
        b.querySelector("small").textContent = t.sample;
        b.title = s.solved ? "Решено: " + s.solved + ", из них сам: " + (s.self || 0) : "Ещё не решал";
        b.onclick = () => { if (topic !== t.id) { leaveTask(); topic = t.id; newTask(); } };
        topicsBox.appendChild(b);
      });
      const tp = E.TOPICS.find((t) => t.id === topic);
      about.hidden = !tp.about;
      about.innerHTML = '<summary>Справка: «<span></span>» — чем этот тип отличается</summary><p></p>';
      about.querySelector("summary span").textContent = tp.title;
      about.querySelector("p").innerHTML = tp.about || "";
    }

    function leaveTask() {
      if (!task || st.left) return;
      st.left = true;
      if (!st.solved && (st.tries || st.hint || st.sol)) track("skip", { topic: task.topic, group: task.group, sec: Math.round((Date.now() - st.t0) / 1000), hint: st.hint, solution: st.sol });
    }

    function newTask() {
      task = E.make(topic);
      counter++;
      st = { t0: Date.now(), hint: 0, sol: false, tries: 0, wrong: 0, solved: false, last: "", lastMsg: "" };
      history.replaceState(null, "", "?t=" + topic);
      drawTopics();
      draw();
    }

    function draw() {
      const tp = E.TOPICS.find((t) => t.id === topic);
      const kind = task.kind, choice = kind === "choice";
      const answerHtml = choice
        ? '<div class="choices">' + task.options.map((o, i) => '<button type="button" data-i="' + i + '"></button>').join("") + "</div>"
        : '<form class="answer"><label></label><input autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text"><button class="check" type="submit">Проверить</button></form>' +
          '<div class="preview"></div>' +
          '<div class="keys"></div>' +
          '<div class="hand"><button type="button" data-act="hand" aria-pressed="false">✍ Писать от руки</button><span>пером графического планшета, пальцем или мышью</span></div>' +
          '<div class="sketch" hidden></div>';
      box.innerHTML =
        '<div class="top"><span>' + groupName(tp.group) + " · <b></b></span><span>Задача " + counter + "</span></div>" +
        '<div class="ask">' + task.ask + ":</div>" +
        '<div class="big">' + task.eq + "</div>" +
        answerHtml +
        '<div class="tools">' +
          '<button type="button" class="hintbtn" data-act="hint"><span class="q">?</span><span class="t">Подсказка</span></button>' +
          '<button type="button" data-act="sol">Показать решение</button>' +
          '<button type="button" class="ai" data-act="ai" hidden>Спросить помощника</button>' +
          '<button type="button" data-act="next"></button>' +
        "</div>" +
        '<div class="msg"></div><div class="hints"></div><div class="sol"></div>';
      box.querySelector(".top b").textContent = tp.title;
      box.querySelector('[data-act="next"]').textContent = NOUN.other;
      box.querySelector('[data-act="hint"]').onclick = moreHint;
      box.querySelector('[data-act="sol"]').onclick = showSolution;
      box.querySelector('[data-act="next"]').onclick = () => { leaveTask(); newTask(); };
      box.querySelector('[data-act="ai"]').onclick = askAssistant;
      if (choice) {
        box.querySelectorAll(".choices button").forEach((b) => {
          b.innerHTML = task.options[+b.dataset.i];
          b.onclick = () => { if (!st.solved) checkAnswer(task.options[+b.dataset.i], b); };
        });
      } else drawInput(kind);
      aiButton();
      drawHints();
    }

    function drawInput(kind) {
      const input = box.querySelector("input");
      box.querySelector(".answer label").textContent = task.label || LABEL[kind];
      input.placeholder = task.placeholder || HOLDER[kind];
      const kb = box.querySelector(".keys");
      (task.keys || KEYS[kind]).forEach(([label, ins]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.onclick = () => {
          if (ins === "!none") input.value = "нет корней";
          else if (ins === "!empty") input.value = "нет решений";
          else {
            const a = input.selectionStart ?? input.value.length, z = input.selectionEnd ?? a;
            input.value = input.value.slice(0, a) + ins + input.value.slice(z);
            const pos = a + (ins.endsWith("()") ? ins.length - 1 : ins.length);
            input.setSelectionRange(pos, pos);
          }
          input.focus();
          showPreview();
        };
        kb.appendChild(b);
      });
      const pv = box.querySelector(".preview");
      function showPreview() {
        const p = E.preview(task, input.value);
        pv.className = "preview" + (p === null ? " err" : "");
        if (!input.value.trim()) pv.textContent = "";
        else if (p === null) pv.textContent = "Запись пока непонятна — проверь скобки и знаки.";
        else pv.innerHTML = "Ты вводишь: <span class=\"eq\">" + p + "</span>";
      }
      input.addEventListener("input", showPreview);
      box.querySelector("form").onsubmit = (e) => { e.preventDefault(); checkAnswer(input.value); };
      setupHand(input, showPreview);
      if (matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    }

    const HKEY = "uchportal-hand";
    let sketch = null;
    function setupHand(input, showPreview) {
      const btn = box.querySelector('[data-act="hand"]'), host = box.querySelector(".sketch");
      sketch = null;
      const canRecognize = () => !!(window.PORTAL_API && window.Portal && Portal.session() && Portal.session().token);
      function build() {
        sketch = Sketch(host, { placeholder: "Пиши здесь решение и ответ — пером планшета, пальцем или мышью." + (canRecognize() ? " Потом нажми «Распознать ответ»." : "") });
        const bar = host.querySelector(".sk-bar"), fsb = bar.querySelector('[data-act="fs"]');
        if (canRecognize()) {
          const rec = document.createElement("button");
          rec.type = "button";
          rec.className = "rec";
          rec.textContent = "Распознать ответ";
          rec.title = "Перенести написанный от руки ответ в поле ответа";
          rec.onclick = () => recognize(rec);
          bar.insertBefore(rec, fsb);
        }
        const ai = document.createElement("button");
        ai.type = "button";
        ai.className = "skai";
        ai.textContent = "Показать помощнику";
        ai.title = "Отправить рисунок помощнику: он посмотрит решение и подскажет, где ошибка";
        ai.hidden = !window.PortalAssistant;
        ai.onclick = () => {
          const img = sketch.toImage(1600);
          if (!img) { setMsg("Сначала напиши решение на листе.", "bad"); return; }
          sketch.exitFs();
          askAssistant("Вот моё решение на рисунке. Посмотри, где ошибка: ", [Object.assign({ name: "Моё решение" }, img)]);
        };
        bar.insertBefore(ai, fsb);
        document.addEventListener("portal-assistant-ready", () => { ai.hidden = !window.PortalAssistant; });
      }
      async function recognize(rec) {
        const img = sketch.toImage(1400);
        if (!img) { setMsg("Сначала напиши ответ на листе.", "bad"); return; }
        const label = rec.textContent;
        rec.disabled = true;
        rec.textContent = "Распознаю…";
        try {
          const r = await fetch(window.PORTAL_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "recognize", token: Portal.session().token, image: img.data, kind: task.kind }) }).then((x) => x.json());
          if (!r.ok) throw new Error(r.error === "auth" ? "Сессия устарела — выйди и войди снова." : r.error || "Не получилось распознать.");
          sketch.exitFs();
          if (!r.text || r.text === "?") {
            setMsg("Не получилось разобрать запись. Напиши ответ крупнее и отдельной строкой — или введи его с клавиатуры.", "bad");
            track("hand", { topic: task.topic, group: task.group, ok: false });
            return;
          }
          input.value = r.text;
          st.handText = r.text;
          showPreview();
          const pv = E.preview(task, r.text);
          setMsg("Я прочитал: <b>" + (pv || r.text.replace(/</g, "&lt;")) + "</b>. Если всё верно — нажми «Проверить». Если я ошибся — исправь в поле с клавиатуры.", "info");
          track("hand", { topic: task.topic, group: task.group, ok: true });
          input.focus({ preventScroll: true });
          box.querySelector(".answer").scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (e) {
          sketch.exitFs();
          setMsg(e.message || "Ошибка связи.", "bad");
        } finally {
          rec.disabled = false;
          rec.textContent = label;
        }
      }
      function toggle(on) {
        host.hidden = !on;
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "✍ Убрать лист" : "✍ Писать от руки";
        if (on && !sketch) build();
        if (on) sketch.resize();
        else if (sketch) sketch.exitFs();
        try { localStorage.setItem(HKEY, on ? "1" : ""); } catch (e) { /* storage full */ }
      }
      btn.onclick = () => toggle(host.hidden);
      if (localStorage.getItem(HKEY)) toggle(true);
    }

    function setMsg(text, kind) {
      const m = box.querySelector(".msg");
      m.className = "msg " + (kind || "info");
      m.innerHTML = text;
    }

    function checkAnswer(value, choiceBtn) {
      if (!String(value).trim()) { setMsg("Сначала впиши ответ.", "bad"); return; }
      const r = E.check(task, value);
      st.last = task.kind === "choice" ? plain(value) : value;
      const hand = !!st.handText && value.trim() === st.handText.trim();
      st.lastMsg = r.ok ? "" : plain(r.msg);
      if (r.parse) { setMsg(r.msg, "bad"); return; }
      st.tries++;
      if (choiceBtn) choiceBtn.classList.add(r.ok ? "ok" : "bad");
      if (!r.ok) {
        st.wrong++;
        track("check", { topic: task.topic, group: task.group, ok: false, hint: st.hint, hand });
        setMsg(r.msg + (st.hint < LEVELS.length ? " Нужна помощь — нажми «Подсказка»." : ""), "bad");
        return;
      }
      const first = !st.solved;
      st.solved = true;
      const sec = Math.round((Date.now() - st.t0) / 1000);
      const self = !st.hint && !st.sol;
      if (first) {
        track("check", { topic: task.topic, group: task.group, ok: true, hint: st.hint, hand });
        track("solved", { topic: task.topic, group: task.group, sec, hint: st.hint, solution: st.sol, wrong: st.wrong, hand });
        const stats = read(), s = stats[task.topic] || { solved: 0, self: 0 };
        s.solved++;
        if (self) s.self = (s.self || 0) + 1;
        stats[task.topic] = s;
        write(stats);
        drawTopics();
      }
      const s = read()[task.topic] || {};
      const praise = self ? (st.wrong ? "Верно! Ты нашёл ошибку и исправил её сам." : "Верно, и без подсказок!") : st.sol ? "Верно. В следующий раз попробуй сначала подсказки — так лучше запоминается." : "Верно! Подсказка помогла.";
      const left = MASTER - (s.self || 0);
      setMsg("<b>" + praise + "</b>" + (left > 0 ? " До «освоено» в этой теме: решить сам ещё " + left + "." : " Тема освоена — можно переходить к следующей."), "ok");
      const next = box.querySelector('[data-act="next"]');
      next.textContent = NOUN.next;
      next.classList.add("next");
      next.focus({ preventScroll: true });
      if (!st.sol) renderSolution(true);
    }

    function drawHints() {
      const h = box.querySelector(".hints");
      h.textContent = "";
      for (let i = 0; i < st.hint; i++) {
        const d = document.createElement("div");
        d.className = "hint l" + (i + 1);
        d.innerHTML = '<div class="qicon">' + (i + 1) + '</div><div><span class="lvl">Подсказка ' + (i + 1) + " из " + LEVELS.length + " · " + LEVELS[i] + "</span>" + task.hints[i] + "</div>";
        h.appendChild(d);
      }
      if (st.hint && !st.solved) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hintmore";
        b.textContent = st.hint < LEVELS.length ? (st.hint === 1 ? "Не понятно — объясни подробнее" : "Всё ещё сложно — объясни с самого начала") : "Покажи полное решение";
        b.onclick = st.hint < LEVELS.length ? moreHint : showSolution;
        h.appendChild(b);
      }
      const hb = box.querySelector('[data-act="hint"]');
      hb.querySelector(".t").textContent = st.hint ? "Подсказка · " + st.hint + " из " + LEVELS.length : "Подсказка";
      hb.disabled = st.hint >= LEVELS.length;
    }

    function moreHint() {
      if (st.hint >= LEVELS.length) return;
      st.hint++;
      if (!st.solved) track("hint", { topic: task.topic, group: task.group, level: st.hint });
      drawHints();
      const last = box.querySelectorAll(".hint");
      if (last.length) last[last.length - 1].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    function renderSolution(afterSolve) {
      const s = box.querySelector(".sol");
      const typed = task.kind === "ode" ? task.answer.t : task.typed;
      s.innerHTML = '<div class="solution"><h4>' + (afterSolve ? "Разбор решения" : "Решение") + "</h4>" + task.solution +
        (typed ? '<p class="typed">В поле ответа это вводится так: <code></code></p>' : "") + "</div>";
      if (typed) s.querySelector("code").textContent = typed;
      if (afterSolve) {
        const d = s.querySelector(".solution");
        const det = document.createElement("details");
        det.innerHTML = "<summary>Посмотреть разбор решения</summary>";
        d.querySelector("h4").remove();
        det.appendChild(d);
        s.appendChild(det);
      }
      box.querySelector('[data-act="sol"]').disabled = true;
    }

    function showSolution() {
      if (!st.solved && !st.sol) { st.sol = true; track("solution", { topic: task.topic, group: task.group, hint: st.hint }); }
      renderSolution(false);
      drawHints();
      box.querySelector(".sol").scrollIntoView({ block: "nearest", behavior: "smooth" });
      setMsg("Разбери решение, а потом " + (task.kind === "choice" ? "выбери ответ" : "введи ответ") + " сам — или возьми новое задание и попробуй без подсказок.", "info");
    }

    function aiButton() {
      const b = box.querySelector('[data-act="ai"]');
      if (b) b.hidden = !window.PortalAssistant;
    }
    document.addEventListener("portal-assistant-ready", aiButton);

    function askAssistant(extra, files) {
      if (!window.PortalAssistant) return;
      const tp = E.TOPICS.find((t) => t.id === topic);
      let ctx = "[" + cfg.name + ", тема «" + tp.title + "». " + task.ask + ": " + plain(task.eq) + ".";
      if (task.kind === "choice") ctx += " Варианты ответа: " + task.options.map(plain).join(" / ") + ".";
      if (st.hint) ctx += " Открыто подсказок: " + st.hint + " из " + LEVELS.length + ".";
      if (st.sol) ctx += " Решение уже показано.";
      if (st.last) ctx += " Мой последний ответ: " + st.last + (st.lastMsg ? " — тренажёр ответил: «" + (st.lastMsg.length > 160 ? st.lastMsg.slice(0, 157) + "…" : st.lastMsg) + "»" : " — верно") + ".";
      ctx += "]\n" + (typeof extra === "string" ? extra : "Мне непонятно: ");
      track("ai", { topic: task.topic, group: task.group, hint: st.hint, drawing: !!files });
      PortalAssistant.ask(ctx, { files });
    }

    groupButtons.forEach((b) => {
      b.onclick = () => {
        if (b.dataset.group === group) return;
        leaveTask();
        group = b.dataset.group;
        topic = E.TOPICS.find((t) => t.group === group).id;
        newTask();
      };
    });
    window.addEventListener("pagehide", leaveTask);
    newTask();
  };
})();
