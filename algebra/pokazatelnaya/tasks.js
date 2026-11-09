// Задания по теме «Показательная функция» (10 класс): свойства функции, уравнения, неравенства.
// Разбор выражений берётся из тренажёра уравнений (EqTasks), здесь — генераторы и проверка
// ответов-чисел, выбора варианта и промежутков.
(function (root) {
  const EQ = root.EqTasks;
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const M = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
  const fr = (a, b) => '<span class="fr"><span>' + a + "</span><span>" + b + "</span></span>";
  const eq = (s) => '<span class="eq">' + s + "</span>";
  const ol = (items) => "<ol>" + items.map((s) => "<li>" + s + "</li>").join("") + "</ol>";
  const pw = (b, e) => b + "<sup>" + e + "</sup>";
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a) + Math.abs(b));
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? M(Math.round(v)) : M(Math.round(v * 1000) / 1000).replace(".", ","));
  const RH = { ">": "&gt;", "<": "&lt;", ">=": "≥", "<=": "≤" };
  const FLIP = { ">": "<", "<": ">", ">=": "<=", "<=": ">=" };
  const holds = (l, r, rel) => (rel === ">" ? l > r + 1e-12 : rel === "<" ? l < r - 1e-12 : rel === ">=" ? l >= r - 1e-12 : l <= r + 1e-12);

  function ratio(v) {
    for (let q = 1; q <= 64; q++) { const p = Math.round(v * q); if (Math.abs(p / q - v) < 1e-9) { const g = gcd(p, q) || 1; return [p / g, q / g]; } }
    return null;
  }
  // Число в HTML: целое, дробь в столбик или десятичная запись.
  function rh(v) {
    const r = ratio(v);
    if (!r) return fmt(v);
    return r[1] === 1 ? M(r[0]) : (r[0] < 0 ? "−" : "") + fr(Math.abs(r[0]), r[1]);
  }
  const rt = (v) => { const r = ratio(v); return !r ? String(Math.round(v * 1000) / 1000) : r[1] === 1 ? String(r[0]) : r[0] + "/" + r[1]; };
  // Линейный показатель px + q.
  function lin(p, q, v) {
    v = v || "x";
    let s = p === 0 ? "" : p === 1 ? v : p === -1 ? "−" + v : M(p) + v;
    if (q) s += s ? (q > 0 ? " + " + q : " − " + Math.abs(q)) : M(q);
    return s || "0";
  }
  const term = (c, body, first) => (first ? (c === 1 ? "" : c === -1 ? "−" : M(c) + "·") : (c < 0 ? " − " : " + ") + (Math.abs(c) === 1 ? "" : Math.abs(c) + "·")) + body;

  // ---------- Промежутки ----------
  const I = Infinity;
  const piece = (a, b, ia, ib) => ({ a, b, ia: !!ia && isFinite(a), ib: !!ib && isFinite(b) });
  const ALL = [piece(-I, I)], NONE = [];
  function relSet(rel, v) {
    if (rel === ">") return [piece(v, I, false)];
    if (rel === ">=") return [piece(v, I, true)];
    if (rel === "<") return [piece(-I, v, false, false)];
    return [piece(-I, v, false, true)];
  }
  const endH = (v) => (v === -I ? "−∞" : v === I ? "+∞" : rh(v));
  const endT = (v) => (v === -I ? "-∞" : v === I ? "+∞" : rt(v));
  function ivH(set, v) {
    if (!set.length) return "решений нет";
    if (set.length === 1 && set[0].a === -I && set[0].b === I) return (v || "x") + " — любое число";
    return (v || "x") + " ∈ " + set.map((p) => (p.ia ? "[" : "(") + endH(p.a) + "; " + endH(p.b) + (p.ib ? "]" : ")")).join(" ∪ ");
  }
  function ivT(set) {
    if (!set.length) return "нет решений";
    return set.map((p) => (p.ia ? "[" : "(") + endT(p.a) + "; " + endT(p.b) + (p.ib ? "]" : ")")).join(" ∪ ");
  }
  const EPS = 1e-9;
  const inSet = (set, x) => set.some((p) => (x > p.a + EPS || (p.ia && Math.abs(x - p.a) <= EPS)) && (x < p.b - EPS || (p.ib && Math.abs(x - p.b) <= EPS)));

  function num(src) {
    const s = String(src).trim();
    if (/^[+]?\s*(∞|i)$/.test(s)) return I;
    if (/^-\s*(∞|i)$/.test(s)) return -I;
    const ast = EQ.parse(s);
    if (EQ.vars ? EQ.vars(ast).size : false) throw new Error("Здесь должно быть число.");
    const v = EQ.evaluate(ast, {});
    if (!isFinite(v)) throw new Error("Не получается посчитать «" + s + "».");
    return v;
  }
  function splitTop(s) {
    const out = [];
    let depth = 0, cur = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "(" || c === "[") depth++;
      if (c === ")" || c === "]") depth--;
      const sep = depth === 0 && (c === "U" || c === ";" || (c === "," && !(/\d/.test(s[i - 1] || "") && /\d/.test(s[i + 1] || ""))));
      if (sep) { out.push(cur); cur = ""; } else cur += c;
      if (depth === 0 && (c === ")" || c === "]") && /^\s*[\(\[]/.test(s.slice(i + 1))) { out.push(cur); cur = ""; }
    }
    out.push(cur);
    return out.map((p) => p.trim()).filter(Boolean);
  }
  function parseSet(src) {
    let s = String(src).trim().toLowerCase();
    if (!s) throw new Error("Впиши ответ.");
    if (/нет|∅|пуст|не\s*имеет/.test(s)) return [];
    s = s.replace(/[хХ]/g, "x").replace(/[уУ]/g, "y").replace(/[−–—]/g, "-")
      .replace(/≤|⩽|=</g, "<=").replace(/≥|⩾|=>/g, ">=")
      .replace(/бесконечн[а-я]*|infinity|inf|∞/g, "∞")
      .replace(/\s+или\s+/g, " U ").replace(/∪|\|/g, " U ").replace(/u/g, " U ")
      .replace(/^\s*(e\s*\(\s*[yf]\s*\)\s*=|[xy]\s*(∈|принадлежит))\s*/, "").trim();
    if (/^(r|ℝ|любое.*|[xy]\s*-?\s*любое.*|все.*числа|\(\s*-\s*∞\s*[;,]\s*\+?\s*∞\s*\))$/.test(s)) return ALL.slice();
    const pieces = splitTop(s).map((p) => {
      if (/^[\(\[]/.test(p) && /[\)\]]$/.test(p)) {
        const inner = p.slice(1, -1);
        let parts = inner.includes(";") ? inner.split(";") : inner.split(",");
        if (parts.length !== 2) throw new Error("В промежутке нужны два конца через точку с запятой: (−∞; 2].");
        parts = parts.map((x) => x.trim().replace(/(\d),(\d)/g, "$1.$2").replace(/∞/g, "i"));
        const a = num(parts[0]), b = num(parts[1]);
        if (a === I || b === -I) throw new Error("Слева в промежутке пишут меньший конец: (−∞; 2), а не (2; −∞).");
        if (a > b + EPS) throw new Error("Левый конец промежутка должен быть меньше правого: " + p + ".");
        return piece(a, b, p[0] === "[", p[p.length - 1] === "]");
      }
      const tk = p.replace(/(\d),(\d)/g, "$1.$2").split(/(<=|>=|<|>|=)/).map((x) => x.trim());
      const isVar = (x) => x === "x" || x === "y";
      if (tk.length === 3) {
        let [A, op, B] = tk;
        if (isVar(B) && !isVar(A)) { [A, B] = [B, A]; op = op === "=" ? "=" : FLIP[op]; }
        if (!isVar(A)) throw new Error("Запиши ответ промежутком, например (−∞; 2], или неравенством: x > 3.");
        const v = num(B);
        return op === "=" ? piece(v, v, true, true) : relSet(op, v)[0];
      }
      if (tk.length === 5 && isVar(tk[2])) {
        let [A, o1, , o2, B] = tk;
        if (o1[0] === ">" && o2[0] === ">") { [A, B] = [B, A]; [o1, o2] = [FLIP[o2], FLIP[o1]]; }
        if (o1[0] !== "<" || o2[0] !== "<") throw new Error("Двойное неравенство пишут так: 1 < x < 3.");
        const a = num(A), b = num(B);
        if (a > b + EPS) throw new Error("В двойном неравенстве слева меньшее число: 1 < x < 3.");
        return piece(a, b, o1 === "<=", o2 === "<=");
      }
      throw new Error("Не понимаю запись «" + p + "». Пиши промежутком: (−∞; 2] ∪ (3; +∞) — или неравенством: x > 3.");
    });
    return pieces;
  }
  const niceIn = (a, b) => {
    const lo = Math.floor(a) + 1, hi = Math.ceil(b) - 1;
    if (lo <= hi) { const m = (a + b) / 2; return Math.min(hi, Math.max(lo, Math.round(m))); }
    return (a + b) / 2;
  };
  function diffSets(need, user) {
    const ends = [];
    [need, user].forEach((set) => set.forEach((p) => [p.a, p.b].forEach((v) => { if (isFinite(v) && !ends.some((e) => Math.abs(e - v) <= EPS)) ends.push(v); })));
    ends.sort((a, b) => a - b);
    const tests = [];
    if (!ends.length) tests.push({ x: 0 });
    else {
      tests.push({ x: Math.floor(ends[0]) - 1 });
      ends.forEach((e, i) => {
        tests.push({ x: e, end: true });
        tests.push({ x: i + 1 < ends.length ? niceIn(e, ends[i + 1]) : Math.ceil(e) + 1 });
      });
    }
    const needEnds = new Set();
    need.forEach((p) => [p.a, p.b].forEach((v) => isFinite(v) && needEnds.add(v)));
    for (const t of tests.filter((t) => !t.end).concat(tests.filter((t) => t.end))) {
      const a = inSet(need, t.x), b = inSet(user, t.x);
      if (a !== b) return { x: t.x, inNeed: a, end: t.end && [...needEnds].some((v) => Math.abs(v - t.x) <= EPS) };
    }
    return null;
  }

  // ---------- Основания ----------
  const BASES = {
    2: { v: 2, h: "2" }, 3: { v: 3, h: "3" }, 5: { v: 5, h: "5" }, 4: { v: 4, h: "4" },
    h2: { v: 1 / 2, h: "(" + fr(1, 2) + ")" }, h3: { v: 1 / 3, h: "(" + fr(1, 3) + ")" }, h5: { v: 1 / 5, h: "(" + fr(1, 5) + ")" },
  };
  const THEORY_MONO = "Показательная функция y = a<sup>x</sup> (a > 0, a ≠ 1) при <b>a > 1 возрастает</b>: чем больше x, тем больше a<sup>x</sup> (2<sup>1</sup> = 2, 2<sup>2</sup> = 4, 2<sup>3</sup> = 8). При <b>0 < a < 1 убывает</b>: (½)<sup>1</sup> = ½, (½)<sup>2</sup> = ¼, (½)<sup>3</sup> = ⅛ — числа становятся меньше.";

  const G = {};

  G.val = () => {
    const v = ri(0, 2);
    if (v === 0) {
      const b = pick([BASES[2], BASES[3], BASES.h2, BASES.h3, BASES[5]]);
      const x0 = b.v === 5 ? pick([-2, -1, 2]) : b.v === 2 || b.v === 0.5 ? pick([-3, -2, -1, 3, 4]) : pick([-2, -1, 2, 3]);
      const val = Math.pow(b.v, x0), inv = b.v < 1 ? Math.round(1 / b.v) : null;
      return {
        kind: "num", ask: "Найди значение функции", eq: "f(x) = " + pw(b.h, "x") + ", &nbsp; f(" + M(x0) + ") = ?", label: "f(" + M(x0) + ") =",
        value: val, typed: rt(val),
        traps: [[b.v * x0, "Ты умножил основание на показатель. Но " + pw("a", "n") + " — это не a·n, а a, умноженное само на себя n раз."], [-Math.pow(b.v, -x0), "Знак у степени не появляется: положительное основание в любой степени даёт положительное число."], [Math.pow(b.v, -x0), "Похоже, перепутан знак показателя: " + pw("a", "−n") + " = 1 / " + pw("a", "n") + "."]],
        hints: [
          "Подставь x = " + M(x0) + " в формулу: f(" + M(x0) + ") = " + pw(b.h, M(x0)) + ".",
          (x0 < 0 ? "Отрицательный показатель «переворачивает» основание: " + pw("a", "−n") + " = " + fr(1, pw("a", "n")) + ". " + (inv ? pw(b.h, M(x0)) + " = " + pw(inv, -x0) + "." : pw(b.h, M(x0)) + " = " + fr(1, pw(b.h, -x0)) + ".") : inv ? pw(b.h, x0) + " = " + fr(1, pw(inv, x0)) + " — возведи в степень и числитель, и знаменатель." : pw(b.h, x0) + " — это " + b.h + ", умноженное само на себя " + x0 + " раза.") + " Осталось посчитать.",
          "Степень с натуральным показателем: " + pw("a", "n") + " = a·a·…·a (n множителей). Нулевая степень: " + pw("a", "0") + " = 1. Отрицательная: " + pw("a", "−n") + " = " + fr(1, pw("a", "n")) + ". А дробь возводят в степень так: " + pw("(" + fr("p", "q") + ")", "n") + " = " + fr(pw("p", "n"), pw("q", "n")) + "." +
            "<p><b>Пример.</b> f(x) = " + pw("(" + fr(1, 2) + ")", "x") + ", f(−3) = " + pw("2", "3") + " = 8; f(2) = " + fr(1, 4) + ".</p>",
        ],
        solution: ol(["f(" + M(x0) + ") = " + pw(b.h, M(x0)), x0 < 0 ? (inv ? "= " + pw(inv, -x0) : "= " + fr(1, pw(b.h, -x0))) : "= " + (inv ? fr(1, pw(inv, x0)) : Array(x0).fill(b.h).join("·")), "= " + rh(val)]) + "<p><b>Ответ:</b> " + rh(val) + "</p>",
      };
    }
    if (v === 1) {
      const [A, x0, g, k] = pick([[4, 1 / 2, 2, 1], [9, 1 / 2, 3, 1], [8, 1 / 3, 2, 1], [27, 1 / 3, 3, 1], [8, 2 / 3, 2, 2], [27, 2 / 3, 3, 2], [4, 3 / 2, 2, 3], [9, 3 / 2, 3, 3], [16, 3 / 4, 2, 3], [4, -1 / 2, 2, -1], [8, -1 / 3, 2, -1], [9, -1 / 2, 3, -1], [27, -2 / 3, 3, -2]]);
      const val = Math.pow(g, k), r = ratio(x0), n = r[1];
      return {
        kind: "num", ask: "Найди значение функции", eq: "f(x) = " + pw(A, "x") + ", &nbsp; f(" + rh(x0) + ") = ?", label: "f(" + rt(x0) + ") =",
        value: val, typed: rt(val),
        traps: [[A * x0, "Степень — это не умножение основания на показатель. Здесь показатель дробный: это корень."]],
        hints: [
          "Дробный показатель — это корень: " + pw("a", fr("1", "n")) + " = " + (n === 2 ? "√a" : "<sup>" + n + "</sup>√a") + ". Представь " + A + " как степень числа " + g + ".",
          A + " = " + pw(g, n) + ", поэтому " + pw(A, rh(x0)) + " = " + pw("(" + pw(g, n) + ")", rh(x0)) + " = " + pw(g, M(n) + "·" + rh(x0)) + " = " + pw(g, M(k)) + ".",
          "Главное правило: " + pw("(" + pw("a", "m") + ")", "k") + " = " + pw("a", "m·k") + " — показатели перемножаются. Корень n-й степени — это показатель " + fr(1, "n") + ": " + pw(8, fr(1, 3)) + " = <sup>3</sup>√8 = 2, потому что 2·2·2 = 8." +
            "<p><b>Пример.</b> " + pw(4, fr(3, 2)) + " = " + pw("(" + pw(2, 2) + ")", fr(3, 2)) + " = " + pw(2, 3) + " = 8.</p>",
        ],
        solution: ol([pw(A, rh(x0)) + " = " + pw("(" + pw(g, n) + ")", rh(x0)), "= " + pw(g, M(k)), "= " + rh(val)]) + "<p><b>Ответ:</b> " + rh(val) + "</p>",
      };
    }
    const b = pick([BASES[2], BASES[3], BASES.h2, BASES.h3]), c = pick([2, 3, -1]), d = pick([-4, -1, 1, 3, 5]), x0 = pick([-2, -1, 0, 1, 2]);
    const val = c * Math.pow(b.v, x0) + d;
    const F = term(c, pw(b.h, "x"), true) + (d > 0 ? " + " + d : " − " + Math.abs(d));
    return {
      kind: "num", ask: "Найди значение функции", eq: "f(x) = " + F + ", &nbsp; f(" + M(x0) + ") = ?", label: "f(" + M(x0) + ") =",
      value: val, typed: rt(val), traps: [],
      hints: [
        "Сначала посчитай степень " + pw(b.h, M(x0)) + ", потом умножь на " + M(c) + " и " + (d > 0 ? "прибавь " + d : "вычти " + Math.abs(d)) + ".",
        pw(b.h, M(x0)) + " = " + rh(Math.pow(b.v, x0)) + ". Значит, f(" + M(x0) + ") = " + M(c) + "·" + rh(Math.pow(b.v, x0)) + (d > 0 ? " + " + d : " − " + Math.abs(d)) + ".",
        "Порядок действий как всегда: сначала степень, потом умножение, потом сложение. Напомню: " + pw("a", "0") + " = 1, " + pw("a", "−n") + " = " + fr(1, pw("a", "n")) + "." +
          "<p><b>Пример.</b> f(x) = 3·" + pw(2, "x") + " − 1, f(−1) = 3·" + fr(1, 2) + " − 1 = " + fr(1, 2) + ".</p>",
      ],
      solution: ol(["f(" + M(x0) + ") = " + M(c) + "·" + pw(b.h, M(x0)) + (d > 0 ? " + " + d : " − " + Math.abs(d)), "= " + M(c) + "·" + rh(Math.pow(b.v, x0)) + (d > 0 ? " + " + d : " − " + Math.abs(d)), "= " + rh(val)]) + "<p><b>Ответ:</b> " + rh(val) + "</p>",
    };
  };

  const MONO_BASES = [
    { h: "0,3", v: 0.3, why: "0 < 0,3 < 1" }, { h: "1,7", v: 1.7, why: "1,7 > 1" }, { h: "0,95", v: 0.95, why: "0,95 < 1" }, { h: "1,05", v: 1.05, why: "1,05 > 1" },
    { h: "(" + fr(2, 5) + ")", v: 0.4, why: fr(2, 5) + " < 1" }, { h: "(" + fr(7, 4) + ")", v: 1.75, why: fr(7, 4) + " > 1" }, { h: "(" + fr(5, 6) + ")", v: 5 / 6, why: fr(5, 6) + " < 1" },
    { h: "(" + fr("√5", 2) + ")", v: Math.sqrt(5) / 2, why: "√5 ≈ 2,24, значит " + fr("√5", 2) + " ≈ 1,12 > 1" },
    { h: "(" + fr("π", 4) + ")", v: Math.PI / 4, why: "π ≈ 3,14, значит " + fr("π", 4) + " ≈ 0,79 < 1" },
    { h: "(" + fr("π", 3) + ")", v: Math.PI / 3, why: "π ≈ 3,14, значит " + fr("π", 3) + " ≈ 1,05 > 1" },
    { h: "(√3 − 1)", v: Math.sqrt(3) - 1, why: "√3 ≈ 1,73, значит √3 − 1 ≈ 0,73 < 1" },
    { h: "(√2)", v: Math.SQRT2, why: "√2 ≈ 1,41 > 1" },
    { f: pw(3, "−x"), v: 1 / 3, why: pw(3, "−x") + " = " + pw("(" + pw(3, "−1") + ")", "x") + " = " + pw("(" + fr(1, 3) + ")", "x") + ", основание " + fr(1, 3) + " < 1" },
    { f: pw("(" + fr(1, 2) + ")", "−x"), v: 2, why: pw("(" + fr(1, 2) + ")", "−x") + " = " + pw(2, "x") + ", основание 2 > 1" },
    { f: pw(5, "x") + "·" + pw(2, "−x"), v: 2.5, why: pw(5, "x") + "·" + pw(2, "−x") + " = " + pw("(" + fr(5, 2) + ")", "x") + ", основание " + fr(5, 2) + " > 1" },
  ];
  G.mono = () => {
    const b = pick(MONO_BASES), up = b.v > 1, F = b.f || pw(b.h, "x");
    const opts = ["возрастает", "убывает"];
    return {
      kind: "choice", ask: "Возрастает или убывает функция", eq: "y = " + F, options: opts, correct: up ? 0 : 1,
      why: [up ? "" : "Нет: основание меньше 1 (" + b.why + "), а при таком основании функция убывает.", up ? "Нет: основание больше 1 (" + b.why + "), а при таком основании функция возрастает." : ""],
      hints: [
        "Всё решает основание степени: оно больше 1 или меньше 1?",
        (b.f ? "Сначала запиши функцию в виде y = a<sup>x</sup>: " + b.why + "." : "Основание здесь " + b.h.replace(/^\(|\)$/g, "") + ". Сравни его с единицей.") + " Если a > 1 — функция возрастает, если 0 < a < 1 — убывает.",
        THEORY_MONO + "<p><b>Пример.</b> y = " + pw("0,5", "x") + ": 0,5 < 1 → убывает. y = " + pw(2, "−x") + " = " + pw("(" + fr(1, 2) + ")", "x") + " → тоже убывает.</p>",
      ],
      solution: "<p>" + b.why.charAt(0).toUpperCase() + b.why.slice(1) + ". Значит, функция " + (up ? "возрастает" : "убывает") + ".</p><p><b>Ответ:</b> " + opts[up ? 0 : 1] + "</p>",
    };
  };

  const EXPS = [-2, -1.5, -0.7, -1 / 3, 0.3, 0.5, 1.2, 2.5, 2 / 3, -2 / 3, 1.5, 3];
  const expH = (e) => { const r = ratio(e); return r && r[1] <= 3 && r[1] > 1 ? rh(e) : fmt(e); };
  G.cmp = () => {
    const v = ri(0, 3);
    let L, R, lv, rv, hints, sol;
    if (v <= 1) {
      const b = pick([{ h: "3", v: 3 }, { h: "1,5", v: 1.5 }, { h: "0,4", v: 0.4 }, { h: "(" + fr(2, 3) + ")", v: 2 / 3 }, { h: "0,9", v: 0.9 }, { h: "(√2)", v: Math.SQRT2 }, { h: "(" + fr(5, 4) + ")", v: 1.25 }]);
      let p = pick(EXPS), q = pick(EXPS);
      while (near(p, q)) q = pick(EXPS);
      L = pw(b.h, expH(p)); R = pw(b.h, expH(q)); lv = Math.pow(b.v, p); rv = Math.pow(b.v, q);
      const up = b.v > 1, bh = b.h.replace(/^\(|\)$/g, "");
      hints = [
        "Основания одинаковые — значит, сравнивать нужно показатели. Но сначала посмотри на основание: больше оно 1 или меньше?",
        "Основание " + bh + (up ? " > 1 — функция возрастает: у какого показателя больше, та степень и больше." : " < 1 — функция убывает: у какого показателя больше, та степень <b>меньше</b>.") + " Сравни " + expH(p) + " и " + expH(q) + ".",
        THEORY_MONO + " Поэтому при a > 1 знак между степенями такой же, как между показателями, а при 0 < a < 1 — противоположный." +
          "<p><b>Пример.</b> " + pw("0,5", 2) + " и " + pw("0,5", 3) + ": 2 < 3, но основание 0,5 < 1, поэтому " + pw("0,5", 2) + " > " + pw("0,5", 3) + " (¼ > ⅛).</p>",
      ];
      sol = ol(["Основание " + bh + (up ? " > 1, функция y = a<sup>x</sup> возрастает." : " < 1, функция y = a<sup>x</sup> убывает."), "Показатели: " + expH(p) + (p < q ? " &lt; " : " &gt; ") + expH(q) + ".", up ? "Знак сохраняется." : "Знак меняется на противоположный."]);
    } else if (v === 2) {
      const [g, A, B] = pick([[2, 4, 8], [3, 9, 27], [2, 8, 4], [3, 27, 9], [2, 4, 16]]);
      const a = Math.round(Math.log(A) / Math.log(g)), c = Math.round(Math.log(B) / Math.log(g));
      const ps = [0.6, 0.4, 0.5, 0.3, 0.8, 1.5, 1 / 3, 2 / 3, 1.2, 0.9];
      let p = pick(ps), q = pick(ps);
      if (Math.random() < 0.35) { const pair = ps.map((x) => [x, (a * x) / c]).filter(([, y]) => ps.some((z) => near(z, y))); if (pair.length) [p, q] = pick(pair); }
      L = pw(A, expH(p)); R = pw(B, expH(q)); lv = Math.pow(A, p); rv = Math.pow(B, q);
      const e1 = a * p, e2 = c * q;
      hints = [
        "Основания разные, но оба — степени числа " + g + ". Приведи обе степени к основанию " + g + ".",
        A + " = " + pw(g, a) + ", " + B + " = " + pw(g, c) + ". Тогда " + L + " = " + pw(g, a + "·" + expH(p)) + " = " + pw(g, expH(e1)) + ", а " + R + " = " + pw(g, expH(e2)) + ". Сравни показатели (основание " + g + " > 1).",
        "Степень степени: " + pw("(" + pw("a", "m") + ")", "k") + " = " + pw("a", "mk") + ". После этого у чисел одинаковое основание, и работает правило: при a > 1 больше та степень, у которой больше показатель." +
          "<p><b>Пример.</b> " + pw(4, "0,5") + " и " + pw(8, "0,5") + ": " + pw(2, 1) + " и " + pw(2, "1,5") + ", 1 < 1,5, значит " + pw(4, "0,5") + " < " + pw(8, "0,5") + ".</p>",
      ];
      sol = ol([L + " = " + pw(g, expH(e1)) + ", " + R + " = " + pw(g, expH(e2)), "Основание " + g + " > 1 — функция возрастает.", "Показатели: " + expH(e1) + (near(e1, e2) ? " = " : e1 < e2 ? " &lt; " : " &gt; ") + expH(e2) + "."]);
    } else {
      const b = pick([{ h: "0,8", v: 0.8 }, { h: "1,3", v: 1.3 }, { h: "(" + fr(3, 7) + ")", v: 3 / 7 }, { h: "(" + fr(9, 8) + ")", v: 9 / 8 }, { h: "0,2", v: 0.2 }]);
      const p = pick([-2, -0.5, 0.7, 3, -1 / 3, 1.4]);
      L = pw(b.h, expH(p)); R = "1"; lv = Math.pow(b.v, p); rv = 1;
      const up = b.v > 1, bh = b.h.replace(/^\(|\)$/g, "");
      hints = [
        "Запиши единицу как степень с тем же основанием: 1 = " + pw(b.h, 0) + ".",
        "Теперь сравни " + pw(b.h, expH(p)) + " и " + pw(b.h, 0) + ": показатели " + expH(p) + " и 0. Основание " + bh + (up ? " > 1 — знак как у показателей." : " < 1 — знак противоположный."),
        "Любое положительное число в нулевой степени равно 1: " + pw("a", 0) + " = 1. " + THEORY_MONO +
          "<p><b>Пример.</b> " + pw("0,5", "−2") + " и 1 = " + pw("0,5", 0) + ": −2 < 0, основание < 1, значит " + pw("0,5", "−2") + " > 1 (это 4).</p>",
      ];
      sol = ol(["1 = " + pw(b.h, 0), "Показатели: " + expH(p) + (p < 0 ? " &lt; " : " &gt; ") + "0.", "Основание " + bh + (up ? " > 1 — знак сохраняется." : " < 1 — знак меняется.")]);
    }
    const sign = near(lv, rv) ? 2 : lv < rv ? 0 : 1;
    const opts = ["&lt;", "&gt;", "="];
    return {
      kind: "choice", ask: "Сравни числа — выбери знак", eq: L + '<span class="q">?</span>' + R, options: opts, correct: sign,
      why: ["Нет, левое число не меньше правого.", "Нет, левое число не больше правого.", "Нет, числа не равны."],
      hints, solution: sol + "<p><b>Ответ:</b> " + L + " " + opts[sign] + " " + R + "</p>",
    };
  };

  G.range = () => {
    const v = ri(0, 3);
    if (v === 3) {
      const b = pick([BASES[2], BASES[3], BASES.h2, BASES.h3]), up = b.v > 1;
      const set = up ? [piece(1, I, true)] : [piece(0, 1, false, true)];
      const F = pw(b.h, "|x|");
      return {
        kind: "interval", v: "y", ask: "Найди множество значений функции", eq: "y = " + F, set, typed: ivT(set),
        explain: (y, inNeed, end) => end ? (Math.abs(y - 1) < EPS ? "Значение y = 1 функция принимает (при x = 0), поэтому 1 входит — нужна квадратная скобка." : "y = 0 не входит: степень положительного числа никогда не равна нулю.") : inNeed ? "Функция принимает значение y = " + fmt(y) + " (например, при x = " + fmt(Math.log(y) / Math.log(b.v)) + "), а в твоём ответе его нет." : "Значение y = " + fmt(y) + " функция не принимает: |x| ≥ 0, поэтому " + F + (up ? " ≥ 1" : " ≤ 1 и > 0") + ".",
        hints: [
          "Сначала оцени показатель: |x| ≥ 0. А потом подумай, какие значения принимает " + pw(b.h, "t") + " при t ≥ 0.",
          "Основание " + (up ? "больше 1 — функция y = a<sup>t</sup> возрастает" : "меньше 1 — функция y = a<sup>t</sup> убывает") + ". При t = 0 значение " + pw(b.h, 0) + " = 1, а при t → +∞ " + (up ? "значения неограниченно растут." : "значения уменьшаются к 0, но не достигают его."),
          "Модуль |x| принимает все значения от 0 и больше, наименьшее — 0 (при x = 0). Значит, нужно понять, что делает a<sup>t</sup> на промежутке t ≥ 0. " + THEORY_MONO +
            "<p><b>Пример.</b> y = " + pw(2, "|x|") + ": t = |x| ≥ 0, " + pw(2, "t") + " ≥ " + pw(2, 0) + " = 1 → E(y) = [1; +∞).</p>",
        ],
        solution: ol(["|x| ≥ 0, наименьшее значение 0 — при x = 0.", up ? "a > 1: " + pw(b.h, "|x|") + " ≥ " + pw(b.h, 0) + " = 1, и значения растут без ограничений." : "0 < a < 1: " + pw(b.h, "|x|") + " ≤ " + pw(b.h, 0) + " = 1, значения положительны и приближаются к 0."]) + "<p><b>Ответ:</b> " + ivH(set, "E(y)").replace("E(y) ∈", "E(y) =") + "</p>",
      };
    }
    const b = pick([BASES[2], BASES[3], BASES.h2, BASES[5], BASES.h3]);
    const k = v === 0 ? 1 : v === 1 ? -1 : pick([2, 3, -2]), d = pick([-4, -3, -1, 1, 2, 5]);
    const pos = k > 0;
    const set = pos ? [piece(d, I, false)] : [piece(-I, d, false, false)];
    const F = term(k, pw(b.h, "x"), true) + (d > 0 ? " + " + d : " − " + Math.abs(d));
    return {
      kind: "interval", v: "y", ask: "Найди множество значений функции", eq: "y = " + F, set, typed: ivT(set),
      explain: (y, inNeed, end) => end ? "y = " + M(d) + " не входит: " + pw(b.h, "x") + " никогда не равно 0, поэтому функция значения " + M(d) + " не достигает — нужна круглая скобка." :
        inNeed ? "Функция принимает значение y = " + fmt(y) + " (например, при x = " + fmt(Math.log((y - d) / k) / Math.log(b.v)) + "), а в твоём ответе его нет." :
        "Значение y = " + fmt(y) + " функция не принимает: " + pw(b.h, "x") + " > 0, поэтому y " + (pos ? "> " : "< ") + M(d) + ".",
      hints: [
        "Начни с главного свойства: " + pw(b.h, "x") + " принимает все положительные значения и только их: " + pw(b.h, "x") + " > 0.",
        "Из " + pw(b.h, "x") + " > 0 получи оценку для y: " + (k === 1 ? "" : "умножь на " + M(k) + (k < 0 ? " (знак неравенства меняется!)" : "") + ", потом ") + (d > 0 ? "прибавь " + d : "вычти " + Math.abs(d)) + ".",
        "Множество значений E(y) — это все числа, которые может принять y. У y = a<sup>x</sup> это (0; +∞): степень положительного числа всегда положительна, а подобрав x, можно получить любое положительное число. Дальше действуем как с неравенством: умножение на отрицательное число меняет знак, прибавление сдвигает границу." +
          "<p><b>Пример.</b> y = −" + pw(2, "x") + " + 3: " + pw(2, "x") + " > 0 → −" + pw(2, "x") + " < 0 → y < 3. E(y) = (−∞; 3).</p>",
      ],
      solution: ol([pw(b.h, "x") + " > 0 при всех x, и принимает все положительные значения.", k === 1 ? "" : M(k) + "·" + pw(b.h, "x") + (pos ? " > 0" : " < 0") + (k < 0 ? " (умножили на отрицательное — знак сменился)" : ""), "y = " + F + (pos ? " > " : " < ") + M(d)].filter(Boolean)) + "<p><b>Ответ:</b> E(y) = " + ivT(set).replace("-∞", "−∞") + "</p>",
    };
  };

  G.point = () => {
    const v = ri(0, 2);
    if (v < 2) {
      const [a, m] = pick([[2, 3], [3, 2], [5, 2], [2, 5], [4, 3], [3, 3], [2, -2], [3, -1], [5, -1], [1 / 2, 3], [1 / 3, 2], [1 / 2, -3], [1 / 3, -2], [10, 3]]);
      const N = Math.pow(a, m);
      return {
        kind: "num", ask: "График функции y = a<sup>x</sup> проходит через точку A(" + M(m) + "; " + rh(N) + "). Найди a", eq: "y = " + pw("a", "x") + ", &nbsp; A(" + M(m) + "; " + rh(N) + ")", label: "a =",
        value: a, typed: rt(a),
        traps: [[-a, "Основание показательной функции всегда положительно (a > 0), поэтому отрицательное число не подходит."], [1 / a, "Проверь: при этом a получается " + pw("a", M(m)) + " = " + rh(Math.pow(1 / a, m)) + ", а нужно " + rh(N) + ". Похоже, перепутан знак показателя."], [N / m, "Степень — не умножение: a<sup>" + M(m) + "</sup> ≠ " + M(m) + "·a."]],
        hints: [
          "Точка лежит на графике, если её координаты подходят в формулу. Подставь x = " + M(m) + ", y = " + rh(N) + ".",
          "Получилось уравнение " + eq(pw("a", M(m)) + " = " + rh(N)) + ". " + (m < 0 ? "Отрицательная степень: " + pw("a", M(m)) + " = " + fr(1, pw("a", -m)) + ", значит " + pw("a", -m) + " = " + rh(1 / N) + "." : "Какое положительное число в степени " + m + " даёт " + rh(N) + "?"),
          "График функции — это все точки (x; y), для которых y = f(x). Подставив координаты, получаем уравнение на a. Помни: у показательной функции a > 0 и a ≠ 1, поэтому из " + pw("a", 2) + " = 9 подходит только a = 3." +
            "<p><b>Пример.</b> A(2; 25): " + pw("a", 2) + " = 25 → a = 5.</p>",
        ],
        solution: ol(["Подставляем координаты: " + pw("a", M(m)) + " = " + rh(N) + ".", m < 0 ? pw("a", -m) + " = " + rh(1 / N) : rh(N) + " = " + pw("(" + rh(a) + ")", m), "a = " + rh(a) + " (a > 0)"]) + "<p><b>Ответ:</b> a = " + rh(a) + "</p>",
      };
    }
    const a = pick([2, 3, 4, 5]), b = pick([-3, -2, -1, 1, 2, 4]);
    const c = 1 + b, d = a + b;
    return {
      kind: "num", ask: "График функции y = a<sup>x</sup> + b проходит через точки A(0; " + M(c) + ") и B(1; " + M(d) + "). Найди a", eq: "y = " + pw("a", "x") + " + b, &nbsp; A(0; " + M(c) + "), B(1; " + M(d) + ")", label: "a =",
      value: a, typed: String(a), traps: [[b, "Это b, а найти нужно основание a."], [d, "Ты забыл вычесть b: при x = 1 получаем a + b = " + M(d) + "."]],
      hints: [
        "Подставь сначала точку A: при x = 0 степень " + pw("a", 0) + " равна 1 — так находится b.",
        "Из A: 1 + b = " + M(c) + " → b = " + M(b) + ". Из B: " + pw("a", 1) + " + b = " + M(d) + " → a = " + M(d) + " − (" + M(b) + ").",
        "Каждая точка графика даёт уравнение: подставь её координаты вместо x и y. Точка с x = 0 особенно удобна: " + pw("a", 0) + " = 1 при любом a." +
          "<p><b>Пример.</b> A(0; 3), B(1; 6): 1 + b = 3 → b = 2; a + 2 = 6 → a = 4.</p>",
      ],
      solution: ol(["A(0; " + M(c) + "): " + pw("a", 0) + " + b = 1 + b = " + M(c) + " → b = " + M(b), "B(1; " + M(d) + "): a + b = " + M(d) + " → a = " + M(d) + " − (" + M(b) + ") = " + a]) + "<p><b>Ответ:</b> a = " + a + "</p>",
    };
  };

  // ---------- Уравнения ----------
  const POW = { 2: [2, 4, 8, 16, 32], 3: [3, 9, 27, 81], 5: [5, 25, 125] };
  const powOf = (g, n) => (n === 1 ? String(g) : String(Math.pow(g, n)));
  G.eqbase = () => {
    for (;;) {
      const g = pick([2, 3, 5]), mx = POW[g].length;
      const al = ri(1, Math.min(3, mx)), be = ri(1, mx);
      const v = ri(0, 2);
      let E, x0, lhs, step, L, R;
      if (v === 0) {
        if (al === be) continue;
        const c = pick([1, 2, -1, 3]);
        x0 = (al * c) / (be - al);
        const A = powOf(g, al), B = powOf(g, be);
        E = pw(A, lin(1, c)) + " = " + pw(B, "x");
        L = (x) => Math.pow(+A, x + c); R = (x) => Math.pow(+B, x);
        step = [pw(g, (al === 1 ? "" : al) + (al === 1 ? lin(1, c) : "(" + lin(1, c) + ")")) + " = " + pw(g, (be === 1 ? "" : be) + "x"), (al === 1 ? lin(1, c) : al + "(" + lin(1, c) + ")") + " = " + (be === 1 ? "" : be) + "x"];
        lhs = [A + " = " + pw(g, al), B + " = " + pw(g, be)];
      } else if (v === 1) {
        const A = powOf(g, al), B = powOf(g, be);
        x0 = -be / al;
        E = pw("(" + fr(1, A) + ")", "x") + " = " + B;
        L = (x) => Math.pow(1 / +A, x); R = () => +B;
        step = [pw(g, (al === 1 ? "−x" : "−" + al + "x")) + " = " + pw(g, be), (al === 1 ? "−x" : "−" + al + "x") + " = " + be];
        lhs = [fr(1, A) + " = " + pw(g, -al === -1 ? "−1" : "−" + al), B + " = " + pw(g, be)];
      } else {
        const A = powOf(g, al), B = powOf(g, be);
        x0 = al / (al + be);
        E = pw(A, "x − 1") + " = " + pw("(" + fr(1, B) + ")", "x");
        L = (x) => Math.pow(+A, x - 1); R = (x) => Math.pow(1 / +B, x);
        step = [pw(g, (al === 1 ? "x − 1" : al + "(x − 1)")) + " = " + pw(g, "−" + (be === 1 ? "" : be) + "x"), (al === 1 ? "x − 1" : al + "(x − 1)") + " = −" + (be === 1 ? "" : be) + "x"];
        lhs = [A + " = " + pw(g, al), fr(1, B) + " = " + pw(g, "−" + be)];
      }
      const r = ratio(x0);
      if (!r || r[1] > 6 || Math.abs(x0) > 8) continue;
      return {
        kind: "roots", ask: "Реши уравнение", eq: E, roots: [x0], L, R, typed: rt(x0),
        hints: [
          "Обе части можно записать как степени одного и того же числа — " + g + ".",
          lhs.join(", ") + ". Уравнение принимает вид " + eq(step[0]) + ". Основания равны — приравняй показатели: " + eq(step[1]) + ".",
          "Два правила: (" + pw("a", "m") + ")<sup>k</sup> = " + pw("a", "mk") + " и " + fr(1, pw("a", "n")) + " = " + pw("a", "−n") + ". Когда слева и справа степени с одинаковым основанием a (a > 0, a ≠ 1), равны и показатели — потому что показательная функция монотонна и каждое значение принимает один раз." +
            "<p><b>Пример.</b> " + eq(pw(4, "x + 1") + " = " + pw(8, "x")) + " → " + pw(2, "2(x + 1)") + " = " + pw(2, "3x") + " → 2x + 2 = 3x → x = 2.</p>",
        ],
        solution: ol([eq(E), lhs.join(", "), eq(step[0]), eq(step[1]), "x = " + rh(x0)]) + "<p><b>Ответ:</b> x = " + rh(x0) + "</p>",
      };
    }
  };

  G.eqfac = () => {
    const v = ri(0, 2);
    const a = pick([2, 3, 5]);
    if (v < 2) {
      const k = pick([1, 2]), s = pick([1, 2, -1, 3]);
      const K = Math.pow(a, k) + s;
      if (K <= 0) return G.eqfac();
      const x0 = ri(0, a === 5 ? 2 : 3), N = K * Math.pow(a, x0);
      const E = pw(a, "x + " + k) + term(s, pw(a, "x")) + " = " + N;
      return {
        kind: "roots", ask: "Реши уравнение", eq: E, roots: [x0], L: (x) => Math.pow(a, x + k) + s * Math.pow(a, x), R: () => N,
        hints: [
          "Распиши " + pw(a, "x + " + k) + " как произведение: " + pw(a, "x") + "·" + pw(a, k) + ". Потом вынеси " + pw(a, "x") + " за скобки.",
          pw(a, "x + " + k) + " = " + Math.pow(a, k) + "·" + pw(a, "x") + ". Получаем " + eq(pw(a, "x") + "(" + Math.pow(a, k) + (s > 0 ? " + " + s : " − " + Math.abs(s)) + ") = " + N) + ", то есть " + eq(K + "·" + pw(a, "x") + " = " + N) + ". Раздели на " + K + ".",
          "При умножении степеней с одинаковым основанием показатели складываются: " + pw("a", "m") + "·" + pw("a", "n") + " = " + pw("a", "m+n") + ". Значит, и наоборот: " + pw(3, "x+2") + " = 9·" + pw(3, "x") + ". Так во всех слагаемых появляется общий множитель " + pw("a", "x") + "." +
            "<p><b>Пример.</b> " + eq(pw(2, "x+1") + " + " + pw(2, "x") + " = 12") + " → 2·" + pw(2, "x") + " + " + pw(2, "x") + " = 3·" + pw(2, "x") + " = 12 → " + pw(2, "x") + " = 4 → x = 2.</p>",
        ],
        solution: ol([eq(E), eq(pw(a, "x") + "(" + Math.pow(a, k) + (s > 0 ? " + " + s : " − " + Math.abs(s)) + ") = " + N), eq(pw(a, "x") + " = " + N / K + " = " + pw(a, x0)), "x = " + x0]) + "<p><b>Ответ:</b> x = " + x0 + "</p>",
      };
    }
    const x0 = ri(1, a === 5 ? 2 : 3), K = a * a - 1, N = K * Math.pow(a, x0 - 1);
    const E = pw(a, "x + 1") + " − " + pw(a, "x − 1") + " = " + N;
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots: [x0], L: (x) => Math.pow(a, x + 1) - Math.pow(a, x - 1), R: () => N,
      hints: [
        "Вынеси за скобки степень с наименьшим показателем — " + pw(a, "x − 1") + ".",
        pw(a, "x + 1") + " = " + pw(a, "x − 1") + "·" + pw(a, 2) + ". Получаем " + eq(pw(a, "x − 1") + "(" + a * a + " − 1) = " + N) + " → " + eq(pw(a, "x − 1") + " = " + N / K) + ".",
        "Выносить удобно наименьшую степень — тогда в скобках остаются целые числа: " + pw("a", "x+1") + " = " + pw("a", "x−1") + "·" + pw("a", 2) + ", потому что (x − 1) + 2 = x + 1." +
          "<p><b>Пример.</b> " + eq(pw(3, "x+1") + " − " + pw(3, "x−1") + " = 24") + " → " + pw(3, "x−1") + "(9 − 1) = 24 → " + pw(3, "x−1") + " = 3 → x − 1 = 1 → x = 2.</p>",
      ],
      solution: ol([eq(E), eq(pw(a, "x − 1") + "·(" + a * a + " − 1) = " + N), eq(pw(a, "x − 1") + " = " + N / K + " = " + pw(a, x0 - 1)), "x − 1 = " + (x0 - 1) + ", x = " + x0]) + "<p><b>Ответ:</b> x = " + x0 + "</p>",
    };
  };

  function quadEq(a, t1, t2) {
    const p = -(t1 + t2), q = t1 * t2;
    return { p, q, text: pw(a * a, "x") + term(p, pw(a, "x")) + (q ? (q > 0 ? " + " + q : " − " + Math.abs(q)) : ""), tq: "t<sup>2</sup>" + term(p, "t") + (q ? (q > 0 ? " + " + q : " − " + Math.abs(q)) : "") };
  }
  G.eqsub = () => {
    const a = pick([2, 3]);
    const m1 = ri(0, a === 2 ? 3 : 2);
    let m2 = ri(0, a === 2 ? 3 : 2);
    const neg = Math.random() < 0.4;
    if (!neg && m2 === m1) m2 = (m1 + 1) % (a === 2 ? 4 : 3);
    const t1 = Math.pow(a, m1), t2 = neg ? -pick([1, 2, 3, 5].filter((k) => k !== t1)) : Math.pow(a, m2);
    const Q = quadEq(a, t1, t2);
    if (Q.p === 0) return G.eqsub();
    const roots = neg ? [m1] : [m1, m2].sort((x, y) => x - y);
    const E = Q.text + " = 0";
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, L: (x) => Math.pow(a * a, x) + Q.p * Math.pow(a, x) + Q.q, R: () => 0,
      hints: [
        "Заметь: " + pw(a * a, "x") + " = " + pw("(" + pw(a, "x") + ")", 2) + ". Сделай замену t = " + pw(a, "x") + " — получится квадратное уравнение.",
        "С заменой t = " + pw(a, "x") + " (t > 0): " + eq(Q.tq + " = 0") + ". Его корни: t = " + M(t1) + " и t = " + M(t2) + " (по Виета: сумма " + M(t1 + t2) + ", произведение " + M(t1 * t2) + "). Теперь вернись к x" + (neg ? " и вспомни, что t > 0." : "."),
        pw(a * a, "x") + " = " + pw("(" + pw(a, 2) + ")", "x") + " = " + pw(a, "2x") + " = " + pw("(" + pw(a, "x") + ")", 2) + " — так в уравнении появляется квадрат. После замены решаем квадратное уравнение, а потом каждое значение t превращаем обратно: " + pw(a, "x") + " = t. Важно: " + pw(a, "x") + " всегда больше нуля, поэтому отрицательные t и t = 0 не дают корней." +
          "<p><b>Пример.</b> " + eq(pw(4, "x") + " − 3·" + pw(2, "x") + " − 4 = 0") + ": t² − 3t − 4 = 0, t = 4 или t = −1. " + pw(2, "x") + " = 4 → x = 2; " + pw(2, "x") + " = −1 — корней нет. Ответ: x = 2.</p>",
      ],
      solution: ol([eq(E), "t = " + pw(a, "x") + ", t > 0: " + eq(Q.tq + " = 0"), "t₁ = " + M(t1) + ", t₂ = " + M(t2), pw(a, "x") + " = " + t1 + " → x = " + m1, neg ? pw(a, "x") + " = " + M(t2) + " — корней нет, потому что " + pw(a, "x") + " > 0" : pw(a, "x") + " = " + t2 + " → x = " + m2]) + "<p><b>Ответ:</b> x = " + roots.join("; ") + "</p>",
    };
  };

  G.eqhom = () => {
    const [u, w] = pick([[2, 3], [3, 2], [2, 5], [3, 5], [5, 2]]);
    let m1 = ri(-1, 1), m2 = ri(-1, 1);
    while (m2 === m1) m2 = ri(-1, 1);
    const pq = (m) => (m === 1 ? [u, w] : m === 0 ? [1, 1] : [w, u]);
    const [p1, q1] = pq(m1), [p2, q2] = pq(m2);
    let A = q1 * q2, B = -(p1 * q2 + p2 * q1), C = p1 * p2;
    const g = gcd(gcd(A, Math.abs(B)), C);
    A /= g; B /= g; C /= g;
    const E = term(A, pw(u * u, "x"), true) + term(B, pw(u * w, "x")) + term(C, pw(w * w, "x")) + " = 0";
    const roots = [m1, m2].sort((x, y) => x - y);
    const T = "(" + fr(u, w) + ")";
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, L: (x) => A * Math.pow(u * u, x) + B * Math.pow(u * w, x) + C * Math.pow(w * w, x), R: () => 0,
      hints: [
        "Здесь три степени: " + pw(u * u, "x") + " = " + pw("(" + pw(u, "x") + ")", 2) + ", " + pw(u * w, "x") + " = " + pw(u, "x") + "·" + pw(w, "x") + ", " + pw(w * w, "x") + " = " + pw("(" + pw(w, "x") + ")", 2) + ". Раздели всё уравнение на " + pw(w * w, "x") + ".",
        "После деления на " + pw(w * w, "x") + " (оно не равно 0): " + eq(term(A, pw(T, "2x"), true) + term(B, pw(T, "x")) + (C > 0 ? " + " + C : " − " + Math.abs(C)) + " = 0") + ". Замена t = " + pw(T, "x") + ", t > 0: " + eq(term(A, "t<sup>2</sup>", true) + term(B, "t") + (C > 0 ? " + " + C : " − " + Math.abs(C)) + " = 0") + ".",
        "Такое уравнение называют однородным: в каждом слагаемом «степень» одинаковая — " + pw(u, "2x") + ", " + pw(u, "x") + pw(w, "x") + ", " + pw(w, "2x") + ". Деление на " + pw(w, "2x") + " превращает его в квадратное относительно t = " + pw(T, "x") + ". Не забудь: " + pw(T, "x") + " = 1 при x = 0, = " + fr(u, w) + " при x = 1 и = " + fr(w, u) + " при x = −1." +
          "<p><b>Пример.</b> " + eq("2·" + pw(4, "x") + " − 5·" + pw(6, "x") + " + 3·" + pw(9, "x") + " = 0") + ": делим на " + pw(9, "x") + ", t = " + pw("(" + fr(2, 3) + ")", "x") + ": 2t² − 5t + 3 = 0, t = 1 или t = " + fr(3, 2) + " → x = 0 или x = −1.</p>",
      ],
      solution: ol([eq(E), "Делим на " + pw(w * w, "x") + " > 0, t = " + pw(T, "x") + ": " + eq(term(A, "t<sup>2</sup>", true) + term(B, "t") + (C > 0 ? " + " + C : " − " + Math.abs(C)) + " = 0"), "t₁ = " + rh(p1 / q1) + ", t₂ = " + rh(p2 / q2), pw(T, "x") + " = " + rh(p1 / q1) + " → x = " + m1 + "; " + pw(T, "x") + " = " + rh(p2 / q2) + " → x = " + m2]) + "<p><b>Ответ:</b> x = " + roots.join("; ") + "</p>",
    };
  };

  // ---------- Неравенства ----------
  const ineqExplain = (L, R, rel, relH) => (x, inNeed, end) => {
    const l = L(x), r = R(x);
    if (end) return "Почти: проверь границу x = " + fmt(x) + ". " + (inNeed ? "При x = " + fmt(x) + " слева " + fmt(l) + ", справа " + fmt(r) + " — неравенство нестрогое (" + relH + "), поэтому граница входит: нужна квадратная скобка или знак ≤ / ≥." : "При x = " + fmt(x) + " обе части равны " + fmt(l) + ", а неравенство строгое (" + relH + ") — граница не входит: нужна круглая скобка или знак < / >.");
    return "Возьмём x = " + fmt(x) + ": слева " + fmt(l) + ", справа " + fmt(r) + " — неравенство " + (inNeed ? "выполняется, а в твоём ответе этого числа нет." : "не выполняется, а в твоём ответе это число есть.");
  };
  G.in1 = () => {
    const rel = pick([">", "<", ">=", "<="]);
    if (Math.random() < 0.15) {
      const b = pick([BASES[2], BASES[3], BASES.h2]), N = pick([1, 3, 5]);
      const big = rel[0] === ">", set = big ? ALL.slice() : NONE.slice();
      const F = pw(b.h, lin(1, pick([1, -2, 3])));
      return {
        kind: "interval", v: "x", ask: "Реши неравенство", eq: F + " " + RH[rel] + " −" + N, set, typed: ivT(set),
        L: (x) => 1, R: () => -N,
        explain: (x, inNeed) => inNeed ? "Возьмём x = " + fmt(x) + ": степень положительна, а положительное число всегда больше −" + N + ". Неравенство выполняется при любом x." : "При x = " + fmt(x) + " слева положительное число, а справа −" + N + " — неравенство не выполняется.",
        hints: [
          "Какой знак у степени положительного числа? Может ли она быть отрицательной?",
          F + " > 0 при любом x. А справа стоит отрицательное число −" + N + ".",
          "Показательная функция принимает только положительные значения: a<sup>x</sup> > 0. Поэтому неравенство a<sup>…</sup> > −5 верно всегда, а a<sup>…</sup> < −5 — никогда." +
            "<p><b>Пример.</b> " + pw(2, "x") + " > −1 → x — любое число; " + pw(2, "x") + " ≤ −1 → решений нет.</p>",
        ],
        solution: "<p>" + F + " > 0 при всех x, а −" + N + " < 0. " + (big ? "Значит, неравенство верно при любом x." : "Значит, неравенство не выполняется ни при каком x.") + "</p><p><b>Ответ:</b> " + ivH(set) + "</p>",
      };
    }
    const b = pick([BASES[2], BASES[3], BASES[5], BASES.h2, BASES.h3, BASES.h5]);
    const g = b.v > 1 ? b.v : Math.round(1 / b.v);
    const p = pick([1, 1, 2, -1]), q = pick([0, 1, -1, 2, -3]);
    const m = ri(g === 5 ? -2 : -3, g === 5 ? 2 : 3);
    const N = Math.pow(b.v, m);
    const x0 = (m - q) / p;
    const up = b.v > 1;
    const rel2 = up ? rel : FLIP[rel], rel3 = p < 0 ? FLIP[rel2] : rel2;
    const set = relSet(rel3, x0);
    const ex = lin(p, q);
    const F = pw(b.h, ex) + " " + RH[rel] + " " + rh(N);
    const L = (x) => Math.pow(b.v, p * x + q), R = () => N;
    return {
      kind: "interval", v: "x", ask: "Реши неравенство", eq: F, set, typed: ivT(set), L, R,
      explain: ineqExplain(L, R, rel, RH[rel]),
      hints: [
        "Запиши " + rh(N) + " как степень с основанием " + b.h.replace(/^\(|\)$/g, "") + ", а потом посмотри на основание: больше оно 1 или меньше?",
        rh(N) + " = " + pw(b.h, M(m)) + ". Неравенство: " + eq(pw(b.h, ex) + " " + RH[rel] + " " + pw(b.h, M(m))) + ". Основание " + (up ? "> 1 — знак сохраняется" : "< 1 — знак <b>меняется</b>") + ": " + eq(ex + " " + RH[rel2] + " " + M(m)) + "." + (p < 0 ? " Дальше делишь на отрицательное число — знак меняется ещё раз." : ""),
        THEORY_MONO + " Поэтому, переходя от степеней к показателям, при a > 1 знак неравенства оставляем, а при 0 < a < 1 меняем на противоположный. Это главная ловушка в показательных неравенствах." +
          "<p><b>Пример.</b> " + eq(pw("(" + fr(1, 2) + ")", "x") + " > 4") + " → " + pw("(" + fr(1, 2) + ")", "x") + " > " + pw("(" + fr(1, 2) + ")", "−2") + ", основание < 1 → x < −2.</p>",
      ],
      solution: ol([eq(F), eq(pw(b.h, ex) + " " + RH[rel] + " " + pw(b.h, M(m))), (up ? "Основание > 1, знак сохраняем: " : "Основание < 1, знак меняем: ") + eq(ex + " " + RH[rel2] + " " + M(m)), "x " + RH[rel3] + " " + rh(x0)]) + "<p><b>Ответ:</b> " + ivH(set) + "</p>",
    };
  };

  G.in2 = () => {
    const a = pick([2, 3]), k = pick([1, 2]), s = pick([1, -1, 2]);
    const K = Math.pow(a, k) + s;
    if (K <= 0) return G.in2();
    const m = ri(-1, 3), N = K * Math.pow(a, m), rel = pick([">", "<", ">=", "<="]);
    const set = relSet(rel, m);
    const F = pw(a, "x + " + k) + term(s, pw(a, "x")) + " " + RH[rel] + " " + rh(N);
    const L = (x) => Math.pow(a, x + k) + s * Math.pow(a, x), R = () => N;
    return {
      kind: "interval", v: "x", ask: "Реши неравенство", eq: F, set, typed: ivT(set), L, R,
      explain: ineqExplain(L, R, rel, RH[rel]),
      hints: [
        "Как в уравнениях: распиши " + pw(a, "x + " + k) + " = " + Math.pow(a, k) + "·" + pw(a, "x") + " и вынеси " + pw(a, "x") + " за скобки.",
        eq(K + "·" + pw(a, "x") + " " + RH[rel] + " " + rh(N)) + " → " + eq(pw(a, "x") + " " + RH[rel] + " " + rh(N / K) + " = " + pw(a, M(m))) + ". Делили на положительное " + K + " — знак не меняется. Основание " + a + " > 1.",
        "Делить неравенство на положительное число можно, не меняя знака. А при переходе к показателям с основанием больше 1 знак тоже сохраняется." +
          "<p><b>Пример.</b> " + eq(pw(2, "x+1") + " + " + pw(2, "x") + " ≥ 12") + " → 3·" + pw(2, "x") + " ≥ 12 → " + pw(2, "x") + " ≥ 4 = " + pw(2, 2) + " → x ≥ 2.</p>",
      ],
      solution: ol([eq(F), eq(pw(a, "x") + "·" + K + " " + RH[rel] + " " + rh(N)), eq(pw(a, "x") + " " + RH[rel] + " " + pw(a, M(m))), "Основание " + a + " > 1: x " + RH[rel] + " " + m]) + "<p><b>Ответ:</b> " + ivH(set) + "</p>",
    };
  };

  G.in3 = () => {
    const a = pick([2, 3]), mx = a === 2 ? 3 : 2;
    const rel = pick([">", "<", ">=", "<="]), big = rel[0] === ">", strict = rel.length === 1;
    const neg = Math.random() < 0.35;
    let m1 = ri(0, mx), m2 = ri(0, mx);
    if (!neg) { while (m2 === m1) m2 = ri(0, mx); if (m1 > m2) [m1, m2] = [m2, m1]; }
    const t1 = Math.pow(a, m1), t2 = neg ? -pick([1, 2, 3].filter((k) => k !== t1)) : Math.pow(a, m2);
    const Q = quadEq(a, t1, t2);
    if (Q.p === 0) return G.in3();
    let set, tline, xline;
    if (neg) {
      set = relSet(rel, m1);
      tline = "(t − " + t1 + ")(t + " + Math.abs(t2) + ") " + RH[rel] + " 0, а t + " + Math.abs(t2) + " > 0, значит t " + RH[rel] + " " + t1;
      xline = pw(a, "x") + " " + RH[rel] + " " + pw(a, m1) + " → x " + RH[rel] + " " + m1;
    } else if (big) {
      set = [piece(-I, m1, false, !strict), piece(m2, I, !strict)];
      tline = "t " + (strict ? "&lt;" : "≤") + " " + t1 + " или t " + (strict ? "&gt;" : "≥") + " " + t2 + " (ветви параболы — вне корней)";
      xline = pw(a, "x") + " " + (strict ? "&lt;" : "≤") + " " + pw(a, m1) + " или " + pw(a, "x") + " " + (strict ? "&gt;" : "≥") + " " + pw(a, m2) + " → x " + (strict ? "&lt;" : "≤") + " " + m1 + " или x " + (strict ? "&gt;" : "≥") + " " + m2;
    } else {
      set = [piece(m1, m2, !strict, !strict)];
      tline = t1 + " " + (strict ? "&lt;" : "≤") + " t " + (strict ? "&lt;" : "≤") + " " + t2 + " (между корнями)";
      xline = pw(a, m1) + " " + (strict ? "&lt;" : "≤") + " " + pw(a, "x") + " " + (strict ? "&lt;" : "≤") + " " + pw(a, m2) + " → " + m1 + " " + (strict ? "&lt;" : "≤") + " x " + (strict ? "&lt;" : "≤") + " " + m2;
    }
    const F = Q.text + " " + RH[rel] + " 0";
    const L = (x) => Math.pow(a * a, x) + Q.p * Math.pow(a, x) + Q.q, R = () => 0;
    return {
      kind: "interval", v: "x", ask: "Реши неравенство", eq: F, set, typed: ivT(set), L, R,
      explain: ineqExplain(L, R, rel, RH[rel]),
      hints: [
        "Сделай замену t = " + pw(a, "x") + " (t > 0): " + pw(a * a, "x") + " = t<sup>2</sup>. Получится квадратное неравенство.",
        eq(Q.tq + " " + RH[rel] + " 0") + ", корни t = " + M(t1) + " и t = " + M(t2) + ". Отсюда " + tline + ". Теперь вернись к x.",
        "Квадратное неравенство решают через корни: парабола t<sup>2</sup> + pt + q с ветвями вверх отрицательна между корнями и положительна снаружи. После этого каждое условие на t переводим в условие на x: " + pw(a, "x") + " < " + pw(a, "m") + " ⇔ x < m (основание > 1). И помни, что t = " + pw(a, "x") + " > 0 всегда." +
          "<p><b>Пример.</b> " + eq(pw(4, "x") + " − 5·" + pw(2, "x") + " + 4 < 0") + ": t² − 5t + 4 < 0 → 1 < t < 4 → " + pw(2, 0) + " < " + pw(2, "x") + " < " + pw(2, 2) + " → 0 < x < 2.</p>",
      ],
      solution: ol([eq(F), "t = " + pw(a, "x") + " > 0: " + eq(Q.tq + " " + RH[rel] + " 0") + ", корни " + M(t1) + " и " + M(t2), tline, xline]) + "<p><b>Ответ:</b> " + ivH(set) + "</p>",
    };
  };

  const TOPICS = [
    { id: "val", group: "fn", title: "Значение функции", sample: "f(x) = 2ˣ, f(−3)", gen: G.val },
    { id: "mono", group: "fn", title: "Возрастает или убывает", sample: "y = 0,3ˣ", gen: G.mono },
    { id: "cmp", group: "fn", title: "Сравнение степеней", sample: "0,4⁻² ? 0,4⁻⁰˒⁷", gen: G.cmp },
    { id: "range", group: "fn", title: "Множество значений", sample: "y = 2ˣ − 3", gen: G.range },
    { id: "point", group: "fn", title: "График через точку", sample: "y = aˣ, A(2; 9)", gen: G.point },
    { id: "eqbase", group: "eq", title: "Одно основание", sample: "4ˣ⁺¹ = 8ˣ", gen: G.eqbase },
    { id: "eqfac", group: "eq", title: "Вынесение множителя", sample: "3ˣ⁺² − 3ˣ = 72", gen: G.eqfac },
    { id: "eqsub", group: "eq", title: "Замена t = aˣ", sample: "4ˣ − 6·2ˣ + 8 = 0", gen: G.eqsub },
    { id: "eqhom", group: "eq", title: "Однородные", sample: "2·4ˣ − 5·6ˣ + 3·9ˣ = 0", gen: G.eqhom },
    { id: "in1", group: "ineq", title: "Простейшие", sample: "(½)ˣ ≥ 8", gen: G.in1 },
    { id: "in2", group: "ineq", title: "Вынесение множителя", sample: "2ˣ⁺¹ + 2ˣ > 12", gen: G.in2 },
    { id: "in3", group: "ineq", title: "Замена t = aˣ", sample: "4ˣ − 5·2ˣ + 4 < 0", gen: G.in3 },
  ];

  const ABOUT = {
    val: "Здесь x известен — его подставляют в формулу и считают y. В этом отличие от уравнения, где наоборот, известен y, а ищут x. Пригодятся правила: a<sup>0</sup> = 1, a<sup>−n</sup> = 1/a<sup>n</sup>, a<sup>1/n</sup> — корень n-й степени.",
    mono: "Возрастает функция y = a<sup>x</sup> или убывает — зависит только от основания: при a > 1 возрастает, при 0 < a < 1 убывает. Если функция записана иначе (например, 3<sup>−x</sup>), её сначала приводят к виду a<sup>x</sup>.",
    cmp: "Применение монотонности к конкретным числам. У степеней с одинаковым основанием сравнивают показатели, а знак берут по правилу: при a > 1 знак тот же, при 0 < a < 1 — противоположный. Разные основания сначала приводят к одному, а единицу записывают как a<sup>0</sup>.",
    range: "Множество значений E(y) — все y, которые получаются из формулы. Не путай с областью определения D(y): у a<sup>x</sup> можно брать любой x, а вот значения только положительные (a<sup>x</sup> > 0). Сдвиг на число сдвигает границу, умножение на отрицательное число переворачивает промежуток.",
    point: "Обратная задача: известна точка графика, а неизвестно основание (или другой параметр). Координаты подставляют в формулу — получается уравнение на a. Помни, что основание показательной функции положительно и не равно 1.",
    eqbase: "Самый простой вид показательного уравнения: по одной степени слева и справа, причём оба основания — степени одного числа (4 и 8 — степени 2, ⅓ и 27 — степени 3). Приводим к одному основанию и приравниваем показатели — ничего не выносим и не заменяем.",
    eqfac: "Несколько степеней с одним основанием складываются или вычитаются, а их показатели отличаются на число: x + 2, x, x − 1. Сразу приравнять показатели нельзя — мешают плюсы. Сначала выносят за скобки общий множитель (меньшую степень), и уравнение становится простейшим.",
    eqsub: "В уравнении есть и a<sup>2x</sup> (например, 4<sup>x</sup> = (2<sup>x</sup>)²), и a<sup>x</sup>. Замена t = a<sup>x</sup> превращает его в квадратное. Отличие от остальных типов — после замены нужно вернуться к x и отбросить t ≤ 0, ведь a<sup>x</sup> всегда положительно.",
    eqhom: "Три степени с разными основаниями, которые не сводятся к одному: 4<sup>x</sup>, 6<sup>x</sup>, 9<sup>x</sup> (2·2, 2·3, 3·3). Такое уравнение называют однородным. Его делят на одну из степеней (например, на 9<sup>x</sup>), а затем делают замену t = (⅔)<sup>x</sup>.",
    in1: "То же, что простейшее уравнение, но вместо «=» стоит знак неравенства, а ответ — промежуток. Главная ловушка: если основание меньше 1, при переходе от степеней к показателям знак неравенства меняется на противоположный.",
    in2: "Как в уравнениях с вынесением множителя: выносим общую степень за скобки и делим на положительное число (знак при этом не меняется). Дальше решаем как простейшее неравенство.",
    in3: "После замены t = a<sup>x</sup> получается квадратное неравенство относительно t. Его решают через корни (парабола или метод интервалов), а потом каждое условие на t переводят в условие на x. Условие t > 0 часто позволяет сразу отбросить часть решений.",
  };
  TOPICS.forEach((t) => { t.about = ABOUT[t.id]; });

  // ---------- Проверка ----------
  function parseNum(src) {
    const s = String(src).trim().replace(/^\s*([a-zа-я]\w*(\s*\([^)]*\))?)\s*=\s*/i, "");
    if (!s) throw new Error("Впиши ответ.");
    if (/;/.test(s)) throw new Error("Здесь ответ — одно число.");
    return num(s.replace(/(\d),(\d)/g, "$1.$2"));
  }

  function check(task, src) {
    try {
      if (task.kind === "roots") {
        const r = EQ.checkRoots(task, src);
        const m = !r.ok && r.msg && r.msg.match(/^x = (\S+) (?:— посторонний корень|не подходит\. Подставим: слева [0-9.]+e\+)/);
        if (m) r.msg = "x = " + m[1] + " не подходит: при таком x степени получаются огромными, и равенства нет. Подставь своё число в уравнение ещё раз.";
        return r;
      }
      if (task.kind === "num") {
        const v = parseNum(src);
        if (near(v, task.value)) return { ok: true };
        const trap = (task.traps || []).find(([t]) => near(t, v));
        return { ok: false, msg: "Не так: у тебя " + rh(v) + ". " + (trap ? trap[1] : "Проверь вычисления.") };
      }
      if (task.kind === "choice") {
        const i = task.options.indexOf(src);
        if (i === task.correct) return { ok: true };
        return { ok: false, msg: (task.why && task.why[i]) || "Неверно." };
      }
      const user = parseSet(src);
      const d = diffSets(task.set, user);
      if (!d) return { ok: true };
      if (!task.set.length) return { ok: false, msg: "У этого неравенства нет решений. " + task.explain(d.x, false, false) };
      if (!user.length) return { ok: false, msg: "Решения есть. " + task.explain(d.x, true, false) };
      return { ok: false, msg: task.explain(d.x, d.inNeed, d.end) };
    } catch (e) { return { ok: false, parse: true, msg: e.message }; }
  }

  function preview(task, src) {
    if (!String(src).trim()) return "";
    try {
      if (task.kind === "roots") return EQ.preview({ kind: "roots" }, src);
      if (task.kind === "num") return (task.label ? task.label.replace(/\s*=$/, "") + " = " : "") + rh(parseNum(src));
      if (task.kind === "interval") return ivH(parseSet(src), task.v);
      return "";
    } catch (e) { return null; }
  }

  function make(topicId) {
    const tp = TOPICS.find((t) => t.id === topicId);
    const task = tp.gen();
    task.topic = tp.id;
    task.group = tp.group;
    return task;
  }

  root.PfTasks = { TOPICS, make, check, preview, parseSet, diffSets, inSet, ivH };
  if (typeof module !== "undefined") module.exports = root.PfTasks;
})(typeof window !== "undefined" ? window : globalThis);
