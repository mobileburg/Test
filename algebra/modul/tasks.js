// Задания по теме «Уравнения с модулем». Разбор и проверка корней — из тренажёра уравнений (EqTasks).
(function (root) {
  const EQ = root.EqTasks;
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const M = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
  const fr = (a, b) => '<span class="fr"><span>' + a + "</span><span>" + b + "</span></span>";
  const ol = (items) => "<ol>" + items.map((s) => "<li>" + s + "</li>").join("") + "</ol>";
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const near = (a, b) => Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a) + Math.abs(b));

  function ratio(v) {
    for (let q = 1; q <= 64; q++) { const p = Math.round(v * q); if (Math.abs(p / q - v) < 1e-9) { const g = gcd(p, q) || 1; return [p / g, q / g]; } }
    return null;
  }
  function rh(v) {
    const r = ratio(v);
    if (!r) return String(Math.round(v * 1000) / 1000).replace(".", ",");
    return r[1] === 1 ? M(r[0]) : (r[0] < 0 ? "−" : "") + fr(Math.abs(r[0]), r[1]);
  }
  const rt = (v) => { const r = ratio(v); return r[1] === 1 ? String(r[0]) : r[0] + "/" + r[1]; };
  function lin(p, q) {
    let s = p === 0 ? "" : p === 1 ? "x" : p === -1 ? "−x" : M(p) + "x";
    if (q) s += s ? (q > 0 ? " + " + q : " − " + Math.abs(q)) : M(q);
    return s || "0";
  }
  const ab = (s) => "|" + s + "|";
  const neg = (p, q) => "−(" + lin(p, q) + ")";
  const uniq = (arr) => arr.filter((v, i) => !arr.slice(0, i).some((u) => near(u, v))).sort((a, b) => a - b);
  const nice = (v) => { const r = ratio(v); return r && r[1] <= 6 && Math.abs(v) <= 20; };
  const ans = (roots) => (roots.length ? "x = " + roots.map(rh).join("; ") : "корней нет");
  const typed = (roots) => (roots.length ? roots.map(rt).join("; ") : "нет корней");
  const DEF = "Модуль числа — это расстояние от него до нуля на числовой прямой, поэтому модуль никогда не бывает отрицательным: |5| = 5, |−5| = 5, |0| = 0. По определению |a| = a, если a ≥ 0, и |a| = −a, если a < 0.";

  const G = {};

  G.abs1 = () => {
    const p = pick([1, 1, 2, 3]), q = pick([-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 6]);
    const v = Math.random();
    const c = v < 0.12 ? -ri(1, 5) : v < 0.22 ? 0 : ri(1, 9);
    const A = lin(p, q), E = ab(A) + " = " + M(c);
    const roots = c < 0 ? [] : uniq([(c - q) / p, (-c - q) / p]);
    const lines = c < 0 ? ["Слева модуль — он не бывает отрицательным, а справа " + M(c) + ". Равенство невозможно."] :
      c === 0 ? ["Модуль равен нулю только тогда, когда само выражение равно нулю: " + A + " = 0", "x = " + rh(roots[0])] :
      [A + " = " + c + " → x = " + rh((c - q) / p), A + " = −" + c + " → x = " + rh((-c - q) / p)];
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => Math.abs(p * x + q), R: () => c,
      hints: [
        c < 0 ? "Посмотри на правую часть. Может ли модуль быть равен отрицательному числу?" : "Модуль равен " + c + ", значит, само выражение под модулем равно " + c + " или " + (c ? "−" + c : "0") + ".",
        c < 0 ? "|…| ≥ 0 всегда, а справа " + M(c) + " < 0. Такое уравнение корней не имеет — так и ответь." : c === 0 ? "Реши " + A + " = 0." : "Реши два уравнения: " + A + " = " + c + " и " + A + " = −" + c + ".",
        DEF + " Поэтому |A| = c при c > 0 даёт два случая: A = c или A = −c; при c = 0 — один: A = 0; при c < 0 решений нет." +
          "<p><b>Пример.</b> |x − 3| = 5: x − 3 = 5 → x = 8 или x − 3 = −5 → x = −2. А |2x + 1| = −4 корней не имеет.</p>",
      ],
      solution: ol([E].concat(lines)) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
    };
  };

  G.abs2 = () => {
    for (;;) {
      const p = pick([1, 2, 3]), r = pick([1, 2, -1, 3, -2]), q = ri(-6, 6), s = ri(-6, 6);
      if (Math.abs(r) === p || !q) continue;
      const x1 = (s - q) / (p - r), x2 = -(s + q) / (p + r);
      const ok = (x) => r * x + s >= -1e-12;
      if (!nice(x1) || !nice(x2) || near(x1, x2)) continue;
      const roots = uniq([x1, x2].filter(ok));
      const extra = [x1, x2].filter((x) => !ok(x));
      if (!roots.length && Math.random() < 0.8) continue;
      if (!extra.length && Math.random() < 0.6) continue;
      const A = lin(p, q), B = lin(r, s), E = ab(A) + " = " + B;
      const chk = (x) => "при x = " + rh(x) + ": " + B + " = " + rh(r * x + s) + (ok(x) ? " ≥ 0 — подходит" : " < 0 — <b>не подходит</b>");
      return {
        kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => Math.abs(p * x + q), R: (x) => r * x + s,
        extra: extra.map((x) => [x, "x = " + rh(x) + " — посторонний корень: при нём правая часть " + B + " = " + rh(r * x + s) + " < 0, а модуль отрицательным не бывает. Такой корень появляется при раскрытии модуля, его нужно отбросить."]),
        hints: [
          "Справа стоит выражение с x. Модуль не бывает отрицательным, поэтому сразу запиши условие: " + B + " ≥ 0. Потом раскрой модуль двумя способами.",
          "Случай 1: " + A + " = " + B + " → x = " + rh(x1) + ". Случай 2: " + A + " = −(" + B + ") → x = " + rh(x2) + ". Теперь проверь у каждого корня условие " + B + " ≥ 0.",
          DEF + " В уравнении |A| = B правая часть B сама зависит от x, и при некоторых x она отрицательна — тогда равенство невозможно. Поэтому решаем A = B и A = −B, а потом оставляем только те корни, где B ≥ 0. Это главное отличие от |A| = число." +
            "<p><b>Пример.</b> |x − 1| = 2x + 1. Условие 2x + 1 ≥ 0. x − 1 = 2x + 1 → x = −2, но 2·(−2) + 1 = −3 < 0 — не подходит. x − 1 = −(2x + 1) → x = 0, 2·0 + 1 = 1 ≥ 0 — подходит. Ответ: x = 0.</p>",
        ],
        solution: ol([E + ", условие: " + B + " ≥ 0", A + " = " + B + " → x = " + rh(x1) + " (" + chk(x1) + ")", A + " = −(" + B + ") → x = " + rh(x2) + " (" + chk(x2) + ")"]) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
      };
    }
  };

  G.abs3 = () => {
    for (;;) {
      const p = pick([1, 2, 3]), r = pick([1, 2, 3, -1, -2]), q = ri(-6, 6), s = ri(-6, 6);
      if (Math.abs(r) === p || (!q && !s)) continue;
      const x1 = (s - q) / (p - r), x2 = -(s + q) / (p + r);
      if (!nice(x1) || !nice(x2) || near(x1, x2)) continue;
      const roots = uniq([x1, x2]);
      const A = lin(p, q), B = lin(r, s), E = ab(A) + " = " + ab(B);
      return {
        kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => Math.abs(p * x + q), R: (x) => Math.abs(r * x + s),
        hints: [
          "Модули двух чисел равны, когда сами числа равны или противоположны.",
          "Реши два уравнения: " + A + " = " + B + " и " + A + " = −(" + B + "). Здесь проверять знаки не нужно — обе части неотрицательны.",
          DEF + " Если |A| = |B|, то A и B находятся на одинаковом расстоянии от нуля: либо это одно и то же число (A = B), либо противоположные (A = −B). Можно и иначе: возвести обе части в квадрат, A² = B²." +
            "<p><b>Пример.</b> |x − 2| = |x + 4|: x − 2 = x + 4 — решений нет; x − 2 = −(x + 4) → 2x = −2 → x = −1.</p>",
        ],
        solution: ol([E, A + " = " + B + " → x = " + rh(x1), A + " = −(" + B + ") → x = " + rh(x2)]) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
      };
    }
  };

  G.abs4 = () => {
    const a = ri(-5, 3), d = ri(2, 6), b = a + d;
    const c = Math.random() < 0.15 ? ri(1, d - 1) : d + pick([1, 2, 3, 4, 6]);
    const roots = c < d ? [] : [(a + b - c) / 2, (a + b + c) / 2];
    const A = lin(1, -a), B = lin(1, -b), E = ab(A) + " + " + ab(B) + " = " + c;
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => Math.abs(x - a) + Math.abs(x - b), R: () => c,
      hints: [
        "Найди, где каждое выражение под модулем равно нулю: x = " + M(a) + " и x = " + M(b) + ". Эти точки делят прямую на три промежутка — на каждом модули раскрываются по-своему.",
        "x < " + M(a) + ": " + neg(1, -a) + " − (" + B + ") = " + c + " → x = " + rh((a + b - c) / 2) + ". " + M(a) + " ≤ x ≤ " + M(b) + ": (" + A + ") − (" + B + ") = " + d + (c === d ? "" : " ≠ " + c) + " — решений нет. x > " + M(b) + ": (" + A + ") + (" + B + ") = " + c + " → x = " + rh((a + b + c) / 2) + ". Проверь, попал ли каждый корень в свой промежуток.",
        "Метод интервалов: нули подмодульных выражений делят прямую на части, и внутри каждой части знак выражения постоянен — значит, модуль раскрывается без вариантов. Решаем уравнение на каждой части и оставляем корни, которые в неё попали. Есть и наглядный смысл: |x − a| + |x − b| — сумма расстояний от x до точек a и b. Она не меньше расстояния между a и b, то есть " + d + "." +
          "<p><b>Пример.</b> |x − 1| + |x − 3| = 4: при x < 1: (1 − x) + (3 − x) = 4 → x = 0; при 1 ≤ x ≤ 3: 2 = 4 — нет; при x > 3: 2x − 4 = 4 → x = 4. Ответ: 0; 4.</p>",
      ],
      solution: ol([E + "; нули: x = " + M(a) + " и x = " + M(b), "x < " + M(a) + ": " + M(a + b) + " − 2x = " + c + " → x = " + rh((a + b - c) / 2) + ((a + b - c) / 2 < a ? " — подходит" : " — не попадает в промежуток"), M(a) + " ≤ x ≤ " + M(b) + ": левая часть равна " + d + ", а нужно " + c + " — решений нет", "x > " + M(b) + ": 2x − " + (a + b < 0 ? "(" + M(a + b) + ")" : a + b) + " = " + c + " → x = " + rh((a + b + c) / 2) + ((a + b + c) / 2 > b ? " — подходит" : " — не попадает в промежуток")]) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
    };
  };

  G.abs5 = () => {
    const t1 = ri(1, 5);
    const kind = Math.random();
    let t2 = kind < 0.25 ? -ri(1, 4) : kind < 0.4 ? 0 : ri(1, 6);
    if (t2 === t1) t2 = t1 + 1;
    const B = -(t1 + t2), C = t1 * t2;
    if (B === 0) return G.abs5();
    const roots = uniq([t1, t2].flatMap((t) => (t > 0 ? [t, -t] : t === 0 ? [0] : [])));
    const tail = (B < 0 ? " − " : " + ") + (Math.abs(B) === 1 ? "" : Math.abs(B)) + "|x|" + (C ? (C > 0 ? " + " + C : " − " + Math.abs(C)) : "");
    const E = "x<sup>2</sup>" + tail + " = 0";
    const tq = "t<sup>2</sup>" + tail.replace("|x|", "t") + " = 0";
    const back = (t) => (t > 0 ? "|x| = " + t + " → x = ±" + t : t === 0 ? "|x| = 0 → x = 0" : "|x| = " + M(t) + " — не подходит, модуль не бывает отрицательным");
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => x * x + B * Math.abs(x) + C, R: () => 0,
      hints: [
        "Заметь: x<sup>2</sup> = |x|<sup>2</sup>. Сделай замену t = |x|, где t ≥ 0, — получится обычное квадратное уравнение.",
        tq + ": корни t = " + M(t1) + " и t = " + M(t2) + " (по Виета: сумма " + M(t1 + t2) + ", произведение " + M(C) + "). Теперь вернись к x: |x| = t. Отрицательное t не подходит, а каждое положительное даёт два корня.",
        "Квадрат числа и квадрат его модуля одинаковы: (−3)² = |−3|² = 9. Поэтому уравнение «с x² и |x|» — это квадратное уравнение относительно |x|. Главное — не забыть, что у |x| = 4 два корня (4 и −4), а |x| = −4 корней не имеет." +
          "<p><b>Пример.</b> x² − 5|x| + 6 = 0: t² − 5t + 6 = 0, t = 2 или t = 3 → x = ±2, ±3.</p>",
      ],
      solution: ol([E, "t = |x| ≥ 0: " + tq, "t₁ = " + M(t1) + ", t₂ = " + M(t2), back(t1), back(t2)]) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
    };
  };

  G.abs6 = () => {
    const a = ri(-3, 3), b = ri(1, 5), c = ri(1, 5);
    const u = b + c, w = b - c;
    const roots = uniq([a + u, a - u].concat(w > 0 ? [a + w, a - w] : w === 0 ? [a] : []));
    const A = a ? lin(1, -a) : "x";
    const E = ab(ab(A) + " − " + b) + " = " + c;
    const back = (k) => (k > 0 ? ab(A) + " = " + k + " → x = " + rh(a + k) + " или x = " + rh(a - k) : k === 0 ? ab(A) + " = 0 → x = " + M(a) : ab(A) + " = " + M(k) + " — не подходит");
    return {
      kind: "roots", ask: "Реши уравнение", eq: E, roots, typed: typed(roots), L: (x) => Math.abs(Math.abs(x - a) - b), R: () => c,
      hints: [
        "Раскрывай модули снаружи внутрь. Внешний модуль равен " + c + ", значит, выражение внутри него равно " + c + " или −" + c + ".",
        ab(A) + " − " + b + " = " + c + " → " + ab(A) + " = " + u + "; " + ab(A) + " − " + b + " = −" + c + " → " + ab(A) + " = " + M(w) + ". Реши каждое из получившихся уравнений.",
        DEF + " Вложенный модуль решают по слоям: сначала избавляемся от внешнего (|B| = c → B = ±c), получаем уравнения с одним модулем и решаем их так же. Каждый слой может удвоить число корней, поэтому корней бывает до четырёх." +
          "<p><b>Пример.</b> ||x| − 2| = 1: |x| − 2 = 1 → |x| = 3 → x = ±3; |x| − 2 = −1 → |x| = 1 → x = ±1. Ответ: −3; −1; 1; 3.</p>",
      ],
      solution: ol([E, ab(A) + " − " + b + " = " + c + " или " + ab(A) + " − " + b + " = −" + c, back(u), back(w)]) + "<p><b>Ответ:</b> " + ans(roots) + "</p>",
    };
  };

  const TOPICS = [
    { id: "abs1", group: "base", title: "Модуль равен числу", sample: "|2x − 3| = 5", gen: G.abs1 },
    { id: "abs2", group: "base", title: "Модуль равен выражению", sample: "|x − 1| = 2x + 1", gen: G.abs2 },
    { id: "abs3", group: "base", title: "Модуль равен модулю", sample: "|x − 2| = |x + 4|", gen: G.abs3 },
    { id: "abs4", group: "hard", title: "Два модуля, метод интервалов", sample: "|x − 1| + |x − 3| = 4", gen: G.abs4 },
    { id: "abs5", group: "hard", title: "Квадратное с |x|", sample: "x² − 5|x| + 6 = 0", gen: G.abs5 },
    { id: "abs6", group: "hard", title: "Модуль в модуле", sample: "||x| − 2| = 1", gen: G.abs6 },
  ];
  const ABOUT = {
    abs1: "Самый простой вид: модуль выражения равен числу. Всё решает знак числа справа: если оно положительное — два случая (выражение равно c или −c), если ноль — один, если отрицательное — корней нет совсем, ведь модуль не бывает отрицательным.",
    abs2: "Справа не число, а выражение с x. Отличие от «модуль равен числу» в том, что правая часть при одних x положительна, а при других отрицательна. Поэтому после раскрытия модуля обязательно проверяют условие «правая часть ≥ 0» — часть корней может оказаться лишней.",
    abs3: "Модули стоят с обеих сторон. Проверять знаки не нужно — обе части и так неотрицательны. Достаточно двух случаев: выражения равны или противоположны (A = B или A = −B).",
    abs4: "Несколько модулей сразу, и раскрыть их «двумя способами» уже не выйдет: вариантов становится больше. Работает метод интервалов: нули подмодульных выражений делят прямую на части, на каждой части модули раскрываются однозначно, а найденный корень должен попасть в свою часть.",
    abs5: "Квадратное уравнение, в котором вместо x стоит |x|: x² − 5|x| + 6 = 0. Так как x² = |x|², замена t = |x| (t ≥ 0) превращает его в обычное квадратное. Отличие — в обратном переходе: каждое положительное t даёт два корня ±t, а отрицательные t отбрасывают.",
    abs6: "Модуль внутри модуля. Решают по слоям — снаружи внутрь: снимают внешний модуль (два случая), получают уравнения с одним модулем и решают их. Из-за этого корней может быть до четырёх, а некоторые случаи отпадают, если модуль приравнялся к отрицательному числу.",
  };
  TOPICS.forEach((t) => { t.about = ABOUT[t.id]; });

  function check(task, src) {
    try {
      const r = EQ.checkRoots(task, src);
      if (!r.ok && task.extra && task.extra.length) {
        const vals = String(src).split(/[;\n]/).map((x) => x.trim().replace(/^x\s*\d?\s*=\s*/i, "").replace(/(\d),(\d)/g, "$1.$2")).filter(Boolean)
          .map((x) => { try { return EQ.evaluate(EQ.parse(x), {}); } catch (e) { return NaN; } });
        const hit = task.extra.find(([x]) => vals.some((v) => near(v, x)));
        if (hit) return { ok: false, msg: hit[1] };
      }
      return r;
    } catch (e) { return { ok: false, parse: true, msg: e.message }; }
  }
  const preview = (task, src) => EQ.preview({ kind: "roots" }, src);
  function make(topicId) {
    const tp = TOPICS.find((t) => t.id === topicId);
    const task = tp.gen();
    task.topic = tp.id;
    task.group = tp.group;
    return task;
  }

  root.ModTasks = { TOPICS, make, check, preview };
  if (typeof module !== "undefined") module.exports = root.ModTasks;
})(typeof window !== "undefined" ? window : globalThis);
