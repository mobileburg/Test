(function (root) {
  "use strict";

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const M = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
  const P = (n) => (n < 0 ? "(" + M(n) + ")" : String(n));
  const T = (n) => (n < 0 ? "(" + n + ")" : String(n));

  // Terms: [coef, var] where var is "" (number), a string, or { h, t } for html/typed forms.
  function poly(terms, typed) {
    let s = "";
    terms.forEach(([c, v]) => {
      if (!c) return;
      const name = typeof v === "string" ? v : typed ? v.t : v.h;
      const abs = Math.abs(c);
      const body = name ? (abs === 1 ? "" : abs + (typed && /^[a-zA-Z(]/.test(name) && name[0] !== "x" ? "*" : "")) + name : String(abs);
      if (typed) s += s ? (c < 0 ? " - " : " + ") + body : (c < 0 ? "-" : "") + body;
      else s += s ? (c < 0 ? " − " : " + ") + body : (c < 0 ? "−" : "") + body;
    });
    return s || "0";
  }
  const both = (terms) => ({ h: poly(terms), t: poly(terms, true) });
  const X2 = { h: "x<sup>2</sup>", t: "x^2" }, X3 = { h: "x<sup>3</sup>", t: "x^3" };
  const kx = (k, v) => (k === 1 ? "" : k === -1 ? "−" : M(k)) + (v || "x");
  const kxT = (k, v) => (k === 1 ? "" : k === -1 ? "-" : String(k)) + (v || "x");
  const ex = (k) => ({ h: "e<sup>" + kx(k) + "</sup>", t: "e^(" + kxT(k) + ")" });
  const exq = (a, b) => ({ h: "e<sup>" + poly([[a, X2], [b, "x"]]) + "</sup>", t: "e^(" + poly([[a, X2], [b, "x"]], true) + ")" });
  const fr = (a, b) => '<span class="fr"><span>' + a + "</span><span>" + b + "</span></span>";
  const eq = (s) => '<span class="eq">' + s + "</span>";
  const yy = (n) => "y" + ["", "′", "″"][n];
  const lhsTerm = (c, name) => (c ? (c < 0 ? " − " : " + ") + (Math.abs(c) === 1 ? "" : Math.abs(c)) + name : "");
  const ol = (items) => "<ol>" + items.map((s) => "<li>" + s + "</li>").join("") + "</ol>";
  const near = (a, b) => Math.abs(a - b) <= 1e-6 * (1 + Math.abs(a) + Math.abs(b));
  const logb = (a, v) => Math.log(v) / Math.log(a);

  const EXPL = {
    rootsCheck: "Найденный корень всегда можно проверить: подставь его в уравнение и посчитай левую и правую части — они должны совпасть.",
  };

  // ---------- Обычные уравнения ----------
  const EQ = {};

  EQ.lin = () => {
    const r = ri(-9, 9), a = pick([2, 3, 4, 5, 6, 7, -2, -3, -4]);
    let c;
    do c = ri(-5, 5); while (c === a);
    const b = ri(-12, 12) || 5, d = (a - c) * r + b, k = a - c, rhs = d - b;
    const L = poly([[a, "x"], [b, ""]]), R = c ? poly([[c, "x"], [d, ""]]) : M(d);
    const moved = c ? poly([[a, "x"], [-c, "x"]]) + " = " + poly([[d, ""], [-b, ""]]) : poly([[a, "x"]]) + " = " + poly([[d, ""], [-b, ""]]);
    return {
      eq: L + " = " + R, ask: "Реши уравнение", kind: "roots", roots: [r],
      L: (x) => a * x + b, R: (x) => c * x + d,
      hints: [
        "Это линейное уравнение. Собери все слагаемые с <i>x</i> в левой части, а числа — в правой. Когда слагаемое переходит через знак «=», его знак меняется на противоположный.",
        (c ? "Переносим " + poly([[c, "x"]]) + " влево (со сменой знака), а " + M(b) + " — вправо:" : "Переносим " + M(b) + " вправо со сменой знака:") +
          "<br>" + eq(moved) + "<br>Приведи подобные: " + eq(kx(k) + " = " + M(rhs)) + "<br>Осталось разделить обе части на " + M(k) + ".",
        "Представь уравнение как весы в равновесии: левая часть весит столько же, сколько правая. Весы останутся в равновесии, если с обеими чашами сделать одно и то же: добавить или убрать одинаковое число, умножить или разделить на одно и то же число (не ноль). Наша цель — оставить <i>x</i> одного на одной чаше." +
          "<p><b>Пример.</b> " + eq("2x + 3 = 11") + ": убираем 3 с обеих сторон → " + eq("2x = 8") + ", делим обе части на 2 → " + eq("x = 4") + ". Проверка: 2·4 + 3 = 11 ✓</p>",
      ],
      solution: ol([eq(L + " = " + R), "Переносим: " + eq(moved), "Приводим подобные: " + eq(kx(k) + " = " + M(rhs)), "Делим на " + M(k) + ": " + eq("x = " + M(rhs) + " : " + P(k) + " = " + M(r)),
        "Проверка: слева " + a + "·" + P(r) + " + " + P(b) + " = " + M(a * r + b) + ", справа " + (c ? c + "·" + P(r) + " + " + P(d) + " = " : "") + M(c * r + d) + " ✓"]) + "<p><b>Ответ:</b> x = " + M(r) + "</p>",
    };
  };

  function quadParts(a, b, c) {
    const D = b * b - 4 * a * c;
    const dLine = "D = b<sup>2</sup> − 4ac = " + P(b) + "<sup>2</sup> − 4·" + P(a) + "·" + P(c) + " = " + M(b * b) + " " + (4 * a * c < 0 ? "+ " + Math.abs(4 * a * c) : "− " + 4 * a * c) + " = " + M(D);
    return { D, dLine };
  }

  EQ.quad = () => {
    const v = Math.random();
    let a, b, c, roots;
    if (v < 0.15) {
      a = 1; b = 2 * ri(-3, 3); c = (b * b) / 4 + ri(1, 6); roots = [];
    } else if (v < 0.3) {
      const r = ri(-6, 6) || 3; a = 1; b = -2 * r; c = r * r; roots = [r];
    } else {
      a = v < 0.7 ? 1 : pick([2, -1, 3, -2]);
      let r1, r2;
      do { r1 = ri(-7, 7); r2 = ri(-7, 7); } while (r1 === r2 || (a !== 1 && Math.abs(r1 * r2) > 20));
      b = -a * (r1 + r2); c = a * r1 * r2; roots = [r1, r2].sort((x, y) => x - y);
    }
    const { D, dLine } = quadParts(a, b, c);
    const s = Math.sqrt(Math.max(D, 0));
    const E = poly([[a, X2], [b, "x"], [c, ""]]) + " = 0";
    const rootsLine = D > 0 ? "√D = " + s + ";  x = " + fr("−b ± √D", "2a") + " = " + fr(M(-b) + " ± " + s, M(2 * a)) + " → x₁ = " + M(roots[0]) + ", x₂ = " + M(roots[1])
      : D === 0 ? "D = 0 — корень один: x = " + fr("−b", "2a") + " = " + fr(M(-b), M(2 * a)) + " = " + M(roots[0])
      : "D < 0 — действительных корней нет.";
    return {
      eq: E, ask: "Реши уравнение", kind: "roots", roots,
      L: (x) => a * x * x + b * x + c, R: () => 0,
      hints: [
        "Это квадратное уравнение вида ax<sup>2</sup> + bx + c = 0. Выпиши, чему равны a, b и c, и посчитай дискриминант D = b<sup>2</sup> − 4ac." + (a === 1 ? " Если любишь подбирать — можно по теореме Виета: x₁ + x₂ = −b, x₁·x₂ = c." : ""),
        "Здесь a = " + M(a) + ", b = " + M(b) + ", c = " + M(c) + ".<br>" + eq(dLine) + "<br>" +
          (D > 0 ? "D > 0, значит корней два: x = " + fr("−b ± √D", "2a") + ". Подставь числа." : D === 0 ? "D = 0, значит корень один: x = " + fr("−b", "2a") + "." : "D < 0. Подумай: можно ли извлечь квадратный корень из отрицательного числа? Что это значит для корней?"),
        "Дискриминант — это «разведчик»: он заранее говорит, сколько корней у уравнения." +
          "<ul><li>D > 0 — два корня: x = " + fr("−b + √D", "2a") + " и x = " + fr("−b − √D", "2a") + ";</li><li>D = 0 — один корень x = " + fr("−b", "2a") + ";</li><li>D < 0 — корней нет (из отрицательного числа корень не извлекается).</li></ul>" +
          "<p><b>Пример.</b> " + eq("x<sup>2</sup> − 5x + 6 = 0") + ": a = 1, b = −5, c = 6. D = 25 − 24 = 1, √D = 1. x = " + fr("5 ± 1", "2") + ", то есть 3 и 2. Проверка по Виета: 3 + 2 = 5, 3·2 = 6 ✓</p>",
      ],
      solution: ol([eq(E), "a = " + M(a) + ", b = " + M(b) + ", c = " + M(c), eq(dLine), eq(rootsLine)]) + "<p><b>Ответ:</b> " + (roots.length ? roots.map((r, i) => (roots.length > 1 ? "x" + "₁₂"[i] : "x") + " = " + M(r)).join(", ") : "корней нет") + "</p>",
    };
  };

  EQ.inc = () => {
    const v = ri(0, 2), a = pick([1, 2, 3, -1, -2]);
    if (v === 0) {
      const r = (ri(1, 7)) * pick([1, -1]), b = -a * r;
      const E = poly([[a, X2], [b, "x"]]) + " = 0";
      return {
        eq: E, ask: "Реши уравнение", kind: "roots", roots: [0, r].sort((x, y) => x - y),
        L: (x) => a * x * x + b * x, R: () => 0,
        hints: [
          "Свободного числа нет — значит, <i>x</i> можно вынести за скобки.",
          eq("x(" + poly([[a, "x"], [b, ""]]) + ") = 0") + "<br>Произведение равно нулю, когда хотя бы один множитель равен нулю: x = 0 или " + eq(poly([[a, "x"], [b, ""]]) + " = 0") + ".",
          "Главное правило: <b>если произведение равно нулю, то хотя бы один из множителей равен нулю</b>. Поэтому уравнение распадается на два простых." +
            "<p><b>Пример.</b> " + eq("x<sup>2</sup> − 4x = 0") + " → " + eq("x(x − 4) = 0") + " → x = 0 или x − 4 = 0, то есть x = 4. Ответ: 0 и 4. Частая ошибка — поделить обе части на x и потерять корень 0!</p>",
        ],
        solution: ol([eq(E), "Выносим x: " + eq("x(" + poly([[a, "x"], [b, ""]]) + ") = 0"), "x = 0 или " + eq(poly([[a, "x"], [b, ""]]) + " = 0") + " → x = " + M(r)]) + "<p><b>Ответ:</b> x₁ = " + M(Math.min(0, r)) + ", x₂ = " + M(Math.max(0, r)) + "</p>",
      };
    }
    const k = ri(1, 7), none = v === 2;
    const c = none ? a * k * k : -a * k * k;
    const E = poly([[a, X2], [c, ""]]) + " = 0";
    const q = -c / a;
    return {
      eq: E, ask: "Реши уравнение", kind: "roots", roots: none ? [] : [-k, k],
      L: (x) => a * x * x + c, R: () => 0,
      hints: [
        "Здесь нет слагаемого с <i>x</i> в первой степени. Перенеси число вправо и раздели на коэффициент при x<sup>2</sup>.",
        eq(kx(a, "x<sup>2</sup>") + " = " + M(-c)) + " → " + eq("x<sup>2</sup> = " + M(q)) + "<br>" + (none ? "Может ли квадрат числа быть отрицательным?" : "Какие числа в квадрате дают " + q + "? Их два!"),
        "Квадрат любого числа — неотрицательный: 3<sup>2</sup> = 9 и (−3)<sup>2</sup> = 9. Поэтому у уравнения x<sup>2</sup> = m: если m > 0 — два корня ±√m, если m = 0 — один корень 0, если m < 0 — корней нет." +
          "<p><b>Пример.</b> " + eq("2x<sup>2</sup> − 18 = 0") + " → " + eq("2x<sup>2</sup> = 18") + " → " + eq("x<sup>2</sup> = 9") + " → x = 3 или x = −3.</p>",
      ],
      solution: ol([eq(E), eq(kx(a, "x<sup>2</sup>") + " = " + M(-c)), eq("x<sup>2</sup> = " + M(q)), none ? "Квадрат не бывает отрицательным — корней нет." : "x = ±√" + q + " = ±" + k]) +
        "<p><b>Ответ:</b> " + (none ? "корней нет" : "x₁ = −" + k + ", x₂ = " + k) + "</p>",
    };
  };

  EQ.rat = () => {
    if (Math.random() < 0.5) {
      let r, b, c, a;
      do { r = ri(-6, 6); b = ri(-6, 6); c = pick([2, 3, -1, -2, 4]); a = c * (r + b) - r; } while (r === -b || a === b);
      const N = poly([[1, "x"], [a, ""]]), Dn = poly([[1, "x"], [b, ""]]);
      return {
        eq: fr(N, Dn) + " = " + M(c), ask: "Реши уравнение", kind: "roots", roots: [r],
        L: (x) => (x + a) / (x + b), R: () => c,
        hints: [
          "Сначала ОДЗ: знаменатель не может быть равен нулю. Потом избавься от дроби — умножь обе части на знаменатель.",
          "ОДЗ: " + eq(Dn + " ≠ 0") + ", то есть x ≠ " + M(-b) + ".<br>Умножаем обе части на (" + Dn + "):<br>" + eq(N + " = " + c + "(" + Dn + ")") + "<br>Раскрой скобки и реши линейное уравнение. Не забудь сверить ответ с ОДЗ.",
          "На ноль делить нельзя — поэтому при некоторых <i>x</i> дробь просто не существует. Такие <i>x</i> заранее выкидывают: это и есть ОДЗ (область допустимых значений). Дальше дробь «снимают»: умножают обе части на знаменатель, и получается обычное уравнение." +
            "<p><b>Пример.</b> " + eq(fr("x + 1", "x − 2") + " = 4") + ". ОДЗ: x ≠ 2. Умножаем: x + 1 = 4(x − 2) → x + 1 = 4x − 8 → −3x = −9 → x = 3. 3 ≠ 2, корень подходит.</p>",
        ],
        solution: ol(["ОДЗ: x ≠ " + M(-b), eq(N + " = " + c + "(" + Dn + ")"), eq(poly([[1, "x"], [a, ""]]) + " = " + poly([[c, "x"], [c * b, ""]])), eq(poly([[1 - c, "x"]]) + " = " + M(c * b - a)), "x = " + M(r) + " — входит в ОДЗ"]) + "<p><b>Ответ:</b> x = " + M(r) + "</p>",
      };
    }
    let r1, r2;
    do { r1 = ri(-6, 6); r2 = ri(-6, 6); } while (r1 === r2);
    const N = poly([[1, X2], [-(r1 + r2), "x"], [r1 * r2, ""]]), Dn = poly([[1, "x"], [-r2, ""]]);
    return {
      eq: fr(N, Dn) + " = 0", ask: "Реши уравнение", kind: "roots", roots: [r1],
      L: (x) => (x * x - (r1 + r2) * x + r1 * r2) / (x - r2), R: () => 0,
      hints: [
        "Дробь равна нулю, когда числитель равен нулю, а знаменатель — нет. Начни с ОДЗ.",
        "ОДЗ: " + eq(Dn + " ≠ 0") + ", то есть x ≠ " + M(r2) + ".<br>Реши уравнение " + eq(N + " = 0") + " и выбрось корни, которые не входят в ОДЗ.",
        "Дробь — это деление. Результат деления равен нулю, только если делимое (числитель) равно нулю. Но если при этом и знаменатель ноль — дробь вообще не существует! Такой «корень» называют посторонним." +
          "<p><b>Пример.</b> " + eq(fr("x<sup>2</sup> − 9", "x − 3") + " = 0") + ". ОДЗ: x ≠ 3. Числитель: x<sup>2</sup> = 9, x = ±3. Корень 3 выбрасываем — остаётся x = −3.</p>",
      ],
      solution: ol(["ОДЗ: x ≠ " + M(r2), "Числитель равен нулю: " + eq(N + " = 0") + " → x = " + M(r1) + " или x = " + M(r2) + " (по Виета: сумма " + M(r1 + r2) + ", произведение " + M(r1 * r2) + ")", "x = " + M(r2) + " не входит в ОДЗ — это посторонний корень"]) + "<p><b>Ответ:</b> x = " + M(r1) + "</p>",
    };
  };

  EQ.exp = () => {
    const v = ri(0, 2);
    if (v === 0) {
      const a = pick([2, 3, 5]), m = a === 2 ? ri(2, 6) : a === 3 ? ri(1, 4) : ri(1, 3), p = pick([1, 2, 3]), x0 = ri(-3, 4), q = m - p * x0, N = a ** m;
      const E = a + "<sup>" + poly([[p, "x"], [q, ""]]) + "</sup> = " + N;
      return {
        eq: E, ask: "Реши уравнение", kind: "roots", roots: [x0],
        L: (x) => a ** (p * x + q), R: () => N,
        hints: [
          "Представь " + N + " как степень числа " + a + ".",
          N + " = " + a + "<sup>" + m + "</sup>, значит " + eq(a + "<sup>" + poly([[p, "x"], [q, ""]]) + "</sup> = " + a + "<sup>" + m + "</sup>") + ".<br>Основания одинаковые — значит, равны и показатели: " + eq(poly([[p, "x"], [q, ""]]) + " = " + m) + ".",
          "Степень a<sup>n</sup> — это a, умноженное само на себя n раз: 2<sup>3</sup> = 2·2·2 = 8. Если две степени с одинаковым основанием равны, то равны и их показатели: из 2<sup>u</sup> = 2<sup>v</sup> следует u = v. Поэтому показательное уравнение сводится к обычному." +
            "<p><b>Пример.</b> " + eq("3<sup>x − 1</sup> = 9") + ": 9 = 3<sup>2</sup>, значит x − 1 = 2, x = 3.</p>",
        ],
        solution: ol([eq(E), N + " = " + a + "<sup>" + m + "</sup>", eq(poly([[p, "x"], [q, ""]]) + " = " + m), eq(kx(p) + " = " + M(m - q)), "x = " + M(x0)]) + "<p><b>Ответ:</b> x = " + M(x0) + "</p>",
      };
    }
    if (v === 1) {
      const a = pick([2, 3]), k = pick([1, 2]), x0 = ri(1, 3), K = a ** k + 1, N = K * a ** x0;
      const E = a + "<sup>x + " + k + "</sup> + " + a + "<sup>x</sup> = " + N;
      return {
        eq: E, ask: "Реши уравнение", kind: "roots", roots: [x0],
        L: (x) => a ** (x + k) + a ** x, R: () => N,
        hints: [
          "Распиши " + a + "<sup>x + " + k + "</sup> как произведение степеней и вынеси " + a + "<sup>x</sup> за скобки.",
          a + "<sup>x + " + k + "</sup> = " + a + "<sup>" + k + "</sup>·" + a + "<sup>x</sup> = " + a ** k + "·" + a + "<sup>x</sup>.<br>" + eq(a + "<sup>x</sup>(" + a ** k + " + 1) = " + N) + " → " + eq(a + "<sup>x</sup> = " + N + " : " + K + " = " + N / K) + ". Теперь представь " + N / K + " как степень " + a + ".",
          "При умножении степеней с одинаковым основанием показатели складываются: a<sup>m</sup>·a<sup>n</sup> = a<sup>m+n</sup>. И наоборот: 2<sup>x+3</sup> = 2<sup>3</sup>·2<sup>x</sup> = 8·2<sup>x</sup>. Так в уравнении появляется общий множитель, его выносят за скобки." +
            "<p><b>Пример.</b> " + eq("2<sup>x+1</sup> + 2<sup>x</sup> = 12") + " → 2·2<sup>x</sup> + 2<sup>x</sup> = 3·2<sup>x</sup> = 12 → 2<sup>x</sup> = 4 = 2<sup>2</sup> → x = 2.</p>",
        ],
        solution: ol([eq(E), eq(a ** k + "·" + a + "<sup>x</sup> + " + a + "<sup>x</sup> = " + N), eq(K + "·" + a + "<sup>x</sup> = " + N), eq(a + "<sup>x</sup> = " + N / K + " = " + a + "<sup>" + x0 + "</sup>"), "x = " + x0]) + "<p><b>Ответ:</b> x = " + x0 + "</p>",
      };
    }
    const a = pick([2, 3, 5]), m = a === 2 ? ri(1, 5) : ri(1, 3), N = a ** m;
    const E = "(" + fr(1, a) + ")<sup>x</sup> = " + N;
    return {
      eq: E, ask: "Реши уравнение", kind: "roots", roots: [-m],
      L: (x) => (1 / a) ** x, R: () => N,
      hints: [
        "Запиши дробь " + fr(1, a) + " как степень числа " + a + " с отрицательным показателем.",
        fr(1, a) + " = " + a + "<sup>−1</sup>, поэтому (" + fr(1, a) + ")<sup>x</sup> = " + a + "<sup>−x</sup>. А " + N + " = " + a + "<sup>" + m + "</sup>. Приравняй показатели.",
        "Отрицательный показатель означает «единица, делённая на степень»: 2<sup>−1</sup> = ½, 2<sup>−3</sup> = ⅛. А возведение степени в степень перемножает показатели: (a<sup>−1</sup>)<sup>x</sup> = a<sup>−x</sup>." +
          "<p><b>Пример.</b> " + eq("(" + fr(1, 2) + ")<sup>x</sup> = 8") + " → 2<sup>−x</sup> = 2<sup>3</sup> → −x = 3 → x = −3.</p>",
      ],
      solution: ol([eq(E), eq(a + "<sup>−x</sup> = " + a + "<sup>" + m + "</sup>"), "−x = " + m, "x = −" + m]) + "<p><b>Ответ:</b> x = −" + m + "</p>",
    };
  };

  let LOG2 = null;
  function logPairs() {
    if (LOG2) return LOG2;
    LOG2 = [];
    for (const a of [2, 3]) for (let s = 1; s <= 6; s++) for (let q = -3; q <= 3; q++) for (let x0 = 1; x0 <= 9; x0++) {
      if (q === s || x0 + q <= 0) continue;
      const N = (x0 + q) * (x0 + s), m = Math.round(logb(a, N));
      if (m < 1 || a ** m !== N) continue;
      const r2 = -(q + s) - x0;
      if (r2 === x0 || (r2 + q > 0 && r2 + s > 0)) continue;
      LOG2.push({ a, q, s, x0, m, N, r2 });
    }
    return LOG2;
  }
  const logArg = (c, d) => (c === 1 && !d ? " x" : "(" + poly([[c, "x"], [d, ""]]) + ")");

  EQ.log = () => {
    if (Math.random() < 0.5) {
      const a = pick([2, 3, 5]), m = a === 2 ? ri(1, 5) : a === 3 ? ri(1, 3) : ri(1, 2), p = pick([1, 2, 3]), x0 = ri(-2, 6), N = a ** m, q = N - p * x0;
      const E = "log<sub>" + a + "</sub>" + logArg(p, q) + " = " + m;
      return {
        eq: E, ask: "Реши уравнение", kind: "roots", roots: [x0],
        L: (x) => logb(a, p * x + q), R: () => m,
        hints: [
          "Вспомни определение логарифма: log<sub>a</sub> b = m означает, что b = a<sup>m</sup>.",
          "Значит, " + eq(poly([[p, "x"], [q, ""]]) + " = " + a + "<sup>" + m + "</sup> = " + N) + ". Реши это линейное уравнение и проверь, что выражение под логарифмом положительно.",
          "Логарифм отвечает на вопрос «в какую степень нужно возвести основание, чтобы получить число?». log<sub>2</sub> 8 = 3, потому что 2<sup>3</sup> = 8. Под логарифмом может стоять только положительное число." +
            "<p><b>Пример.</b> " + eq("log<sub>3</sub>(x + 2) = 2") + " → x + 2 = 3<sup>2</sup> = 9 → x = 7. Проверка: 7 + 2 = 9 > 0 ✓</p>",
        ],
        solution: ol([eq(E), eq(poly([[p, "x"], [q, ""]]) + " = " + a + "<sup>" + m + "</sup> = " + N), eq(kx(p) + " = " + M(N - q)), "x = " + M(x0) + "; под логарифмом " + N + " > 0 ✓"]) + "<p><b>Ответ:</b> x = " + M(x0) + "</p>",
      };
    }
    const { a, q, s, x0, m, N, r2 } = pick(logPairs());
    const A = poly([[1, "x"], [q, ""]]), B = poly([[1, "x"], [s, ""]]);
    const E = "log<sub>" + a + "</sub>" + logArg(1, q) + " + log<sub>" + a + "</sub>" + logArg(1, s) + " = " + m;
    const lo = Math.max(-q, -s);
    return {
      eq: E, ask: "Реши уравнение", kind: "roots", roots: [x0],
      L: (x) => logb(a, x + q) + logb(a, x + s), R: () => m,
      hints: [
        "Сначала ОДЗ: под каждым логарифмом должно быть положительное число. Потом используй правило: сумма логарифмов с одинаковым основанием равна логарифму произведения.",
        "ОДЗ: " + eq(A + " > 0") + " и " + eq(B + " > 0") + ", то есть x > " + M(lo) + ".<br>" + eq("log<sub>" + a + "</sub>((" + A + ")(" + B + ")) = " + m) + " → " + eq("(" + A + ")(" + B + ") = " + N) + ".<br>Раскрой скобки, реши квадратное уравнение и проверь корни по ОДЗ.",
        "Два правила: log<sub>a</sub> u + log<sub>a</sub> v = log<sub>a</sub>(u·v) и log<sub>a</sub> b = m ⇔ b = a<sup>m</sup>. Но после «склейки» логарифмов могут появиться лишние корни, при которых исходные логарифмы не существуют. Поэтому ОДЗ находят заранее и каждый корень проверяют." +
          "<p><b>Пример.</b> " + eq("log<sub>2</sub> x + log<sub>2</sub>(x + 2) = 3") + ". ОДЗ: x > 0. x(x + 2) = 8 → x<sup>2</sup> + 2x − 8 = 0 → x = 2 или x = −4. −4 не входит в ОДЗ. Ответ: 2.</p>",
      ],
      solution: ol(["ОДЗ: x > " + M(lo), eq("(" + A + ")(" + B + ") = " + N), eq(poly([[1, X2], [q + s, "x"], [q * s - N, ""]]) + " = 0"), "x = " + M(x0) + " или x = " + M(r2), "x = " + M(r2) + " не входит в ОДЗ — посторонний корень"]) + "<p><b>Ответ:</b> x = " + M(x0) + "</p>",
    };
  };

  // ---------- Дифференциальные уравнения ----------
  const DE = {};
  const odeAsk = "Найди общее решение y(x)";

  DE.prim = () => {
    const v = ri(0, 2);
    let fh, ans, f, parts;
    if (v === 0) {
      let A, B, C;
      do { A = 3 * ri(-2, 2); B = 2 * ri(-3, 3); C = ri(-5, 5); } while ([A, B, C].filter(Boolean).length < 2);
      fh = poly([[A, X2], [B, "x"], [C, ""]]);
      f = (x) => A * x * x + B * x + C;
      ans = both([[A / 3, X3], [B / 2, X2], [C, "x"]]);
      parts = [[A, "x<sup>2</sup>", poly([[A / 3, X3]])], [B, "x", poly([[B / 2, X2]])], [C, "", poly([[C, "x"]])]].filter((p) => p[0]).map((p) => "∫" + (p[1] ? kx(p[0], p[1]) : M(p[0])) + " dx = " + p[2]);
    } else if (v === 1) {
      const b = pick([1, 2, 3, -1, -2]), m = pick([1, 2, 3, -1]), n = ri(-4, 4);
      fh = poly([[b * m, ex(b)], [n, ""]]);
      f = (x) => b * m * Math.exp(b * x) + n;
      ans = both([[m, ex(b)], [n, "x"]]);
      parts = ["∫" + kx(b * m, ex(b).h) + " dx = " + kx(m, ex(b).h) + " (потому что (e<sup>" + kx(b) + "</sup>)′ = " + kx(b, ex(b).h) + ")"].concat(n ? ["∫" + M(n) + " dx = " + kx(n)] : []);
    } else {
      const b = pick([1, 2, 3]), m = pick([1, 2, -1, 3]), cosF = Math.random() < 0.5;
      const arg = kx(b), argT = kxT(b);
      fh = kx(b * m, (cosF ? "cos " : "sin ") + arg);
      f = (x) => b * m * (cosF ? Math.cos(b * x) : Math.sin(b * x));
      ans = cosF ? both([[m, { h: "sin " + arg, t: "sin(" + argT + ")" }]]) : both([[-m, { h: "cos " + arg, t: "cos(" + argT + ")" }]]);
      parts = ["∫" + fh + " dx = " + ans.h + " (проверь: производная " + ans.h + " равна " + fh + ")"];
    }
    const E = "y′ = " + fh;
    return {
      eq: E, ask: odeAsk, kind: "ode",
      ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1, f(x)], lhs: "y′", rhs: fh },
      answer: { h: "y = " + ans.h + " + C", t: ans.t + " + C" },
      hints: [
        "Если y′ = f(x), то y — это первообразная функции f(x). Проинтегрируй правую часть и не забудь прибавить константу C.",
        "Интегрируем по частям:<br>" + parts.map(eq).join("<br>") + "<br>Сложи результаты и добавь + C.",
        "Производная показывает, как быстро меняется функция. Здесь нам известна производная, а саму функцию нужно восстановить — это обратное действие, интегрирование. Полезные правила: ∫x<sup>n</sup> dx = " + fr("x<sup>n+1</sup>", "n+1") + ", ∫e<sup>kx</sup> dx = " + fr("1", "k") + "e<sup>kx</sup>, ∫cos kx dx = " + fr("1", "k") + "sin kx, ∫sin kx dx = −" + fr("1", "k") + "cos kx." +
          "<p>Почему + C? У константы производная ноль, поэтому x<sup>2</sup>, x<sup>2</sup> + 5 и x<sup>2</sup> − 3 имеют одну и ту же производную 2x. Общее решение — это целое семейство функций.</p><p><b>Пример.</b> y′ = 2x → y = x<sup>2</sup> + C. Проверка: (x<sup>2</sup> + C)′ = 2x ✓</p>",
      ],
      solution: ol([eq(E), "y = ∫(" + fh + ") dx", ...parts.map(eq), eq("y = " + ans.h + " + C")]) + "<p><b>Ответ:</b> y = " + ans.h + " + C</p>",
    };
  };

  DE.sep = () => {
    const v = ri(0, 2);
    if (v === 0) {
      const k = pick([1, 2, 3, 4, -1, -2, -3]);
      const E = "y′ = " + kx(k, "y");
      return {
        eq: E, ask: odeAsk, kind: "ode",
        ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1, k * y], lhs: "y′", rhs: kx(k, "y") },
        answer: { h: "y = C" + ex(k).h, t: "C*" + ex(k).t },
        hints: [
          "Это уравнение с разделяющимися переменными. Запиши y′ как " + fr("dy", "dx") + " и собери всё с y слева, а всё с x — справа. Потом проинтегрируй обе части.",
          eq(fr("dy", "dx") + " = " + kx(k, "y")) + " → " + eq(fr("dy", "y") + " = " + M(k) + " dx") + " → " + eq("ln|y| = " + kx(k) + " + C₀") + "<br>Осталось выразить y: вспомни, что e<sup>ln|y|</sup> = |y|.",
          "y′ = " + fr("dy", "dx") + " — это отношение маленького изменения y к маленькому изменению x, и с ним можно работать почти как с дробью. «Разделить переменные» — значит переписать уравнение так, чтобы слева были только y и dy, а справа только x и dx. Тогда каждую часть можно проинтегрировать отдельно. Помни: ∫" + fr("dy", "y") + " = ln|y|." +
            "<p><b>Пример.</b> y′ = 2y → " + fr("dy", "y") + " = 2dx → ln|y| = 2x + C₀ → |y| = e<sup>C₀</sup>e<sup>2x</sup> → y = Ce<sup>2x</sup> (знак ± и e<sup>C₀</sup> прячем в одну константу C).</p>",
        ],
        solution: ol([eq(fr("dy", "dx") + " = " + kx(k, "y")), eq(fr("dy", "y") + " = " + M(k) + " dx"), eq("ln|y| = " + kx(k) + " + C₀"), eq("y = ±e<sup>C₀</sup>·" + ex(k).h + " = C" + ex(k).h)]) + "<p><b>Ответ:</b> y = C" + ex(k).h + "</p>",
      };
    }
    if (v === 1) {
      const a = pick([1, 2, -1, 3]), b = pick([0, 0, 1, -2, 3, 2]);
      const fac = b ? "(" + poly([[2 * a, "x"], [b, ""]]) + ")y" : kx(2 * a, "xy");
      const E = "y′ = " + fac;
      return {
        eq: E, ask: odeAsk, kind: "ode",
        ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1, (2 * a * x + b) * y], lhs: "y′", rhs: fac },
        answer: { h: "y = C" + exq(a, b).h, t: "C*" + exq(a, b).t },
        hints: [
          "Раздели переменные: всё с y — в левую часть, всё с x — в правую, затем проинтегрируй обе части.",
          eq(fr("dy", "y") + " = (" + poly([[2 * a, "x"], [b, ""]]) + ") dx") + " → " + eq("ln|y| = " + poly([[a, X2], [b, "x"]]) + " + C₀") + "<br>Выразите y через экспоненту.",
          "Разделить переменные — значит добиться, чтобы слева было только y (вместе с dy), а справа только x (вместе с dx). Дальше обе части интегрируют: ∫" + fr("dy", "y") + " = ln|y|, а ∫(2ax + b)dx = ax<sup>2</sup> + bx." +
            "<p><b>Пример.</b> y′ = 2xy → " + fr("dy", "y") + " = 2x dx → ln|y| = x<sup>2</sup> + C₀ → y = Ce<sup>x<sup>2</sup></sup>.</p>",
        ],
        solution: ol([eq(fr("dy", "dx") + " = " + fac), eq(fr("dy", "y") + " = (" + poly([[2 * a, "x"], [b, ""]]) + ") dx"), eq("ln|y| = " + poly([[a, X2], [b, "x"]]) + " + C₀"), eq("y = C" + exq(a, b).h)]) + "<p><b>Ответ:</b> y = C" + exq(a, b).h + "</p>",
      };
    }
    const k = pick([2, 3, -1, -2]);
    const E = "y′ = " + fr(kx(k, "y"), "x") + ",  x > 0";
    const xk = k === 1 ? "x" : "x<sup>" + M(k) + "</sup>";
    return {
      eq: E, ask: odeAsk, kind: "ode",
      ode: { order: 1, dom: [0.5, 2], F: (x, y, y1) => [y1, (k * y) / x], lhs: "y′", rhs: fr(kx(k, "y"), "x") },
      answer: { h: "y = C" + xk, t: "C*x^(" + k + ")" },
      hints: [
        "Раздели переменные: " + fr("dy", "y") + " в одну сторону, " + fr("dx", "x") + " — в другую.",
        eq(fr("dy", "y") + " = " + M(k) + fr("dx", "x")) + " → " + eq("ln|y| = " + M(k) + " ln x + C₀") + "<br>Воспользуйся свойством k·ln x = ln x<sup>k</sup>.",
        "∫" + fr("dy", "y") + " = ln|y|, ∫" + fr("dx", "x") + " = ln x (при x > 0). А число перед логарифмом можно «занести» в показатель: 3 ln x = ln x<sup>3</sup>. Тогда ln|y| = ln(x<sup>3</sup>) + C₀, и y = Cx<sup>3</sup>." +
          "<p><b>Пример.</b> y′ = " + fr("2y", "x") + " → " + fr("dy", "y") + " = 2" + fr("dx", "x") + " → ln|y| = 2 ln x + C₀ → y = Cx<sup>2</sup>.</p>",
      ],
      solution: ol([eq(fr("dy", "y") + " = " + M(k) + fr("dx", "x")), eq("ln|y| = " + M(k) + " ln x + C₀ = ln " + xk + " + C₀"), eq("y = C" + xk)]) + "<p><b>Ответ:</b> y = C" + xk + "</p>",
    };
  };

  DE.lin1 = () => {
    const a = pick([1, 2, 3, -1, -2]), v = ri(0, 2);
    const L = "y′" + lhsTerm(a, "y");
    const hom = "C" + ex(-a).h, homT = "C*" + ex(-a).t;
    let fh, f, yp, ypT, guess, find;
    if (v === 0) {
      const m = ri(-4, 4) || 2, b = a * m;
      fh = M(b); f = () => b; yp = M(m); ypT = String(m); guess = "y = A (просто число)";
      find = "Подставляем y = A, y′ = 0: " + eq("0 + " + P(a) + "A = " + b) + " → A = " + M(m);
    } else if (v === 1) {
      let k; do k = pick([1, 2, 3, -1, -3]); while (k === -a);
      const m = pick([1, 2, -1, 3]), b = (k + a) * m;
      fh = kx(b, ex(k).h); f = (x) => b * Math.exp(k * x); yp = kx(m, ex(k).h); ypT = poly([[m, ex(k)]], true);
      guess = "y = A" + ex(k).h;
      find = "Подставляем y = A" + ex(k).h + ", y′ = " + M(k) + "A" + ex(k).h + ": " + eq("(" + M(k) + " + " + P(a) + ")A = " + M(b)) + " → A = " + M(m);
    } else {
      const A = pick([1, 2, -1, 3]), B = ri(-3, 3), b = a * A, d = A + a * B;
      fh = poly([[b, "x"], [d, ""]]); f = (x) => b * x + d; yp = poly([[A, "x"], [B, ""]]); ypT = poly([[A, "x"], [B, ""]], true);
      guess = "y = Ax + B";
      find = "Подставляем y = Ax + B, y′ = A: " + eq("A + " + P(a) + "(Ax + B) = " + fh) + ". Сравни коэффициенты при x и свободные члены: " + P(a) + "A = " + M(b) + ", A + " + P(a) + "B = " + M(d) + " → A = " + M(A) + ", B = " + M(B);
    }
    const E = L + " = " + fh;
    return {
      eq: E, ask: odeAsk, kind: "ode",
      ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1 + a * y, f(x)], lhs: L, rhs: fh },
      answer: { h: "y = " + hom + " + " + yp, t: homT + " + " + ypT },
      hints: [
        "Это линейное уравнение первого порядка. Общее решение = общее решение однородного уравнения (" + L + " = 0) + любое одно частное решение исходного.",
        ol(["Однородное: " + eq(L + " = 0") + " → разделяем переменные → " + eq("y = " + hom), "Частное решение ищем в виде " + eq(guess) + " — подставь его в уравнение и найди коэффициенты."]),
        "Почему «однородное + частное»? Если y₁ — какое-то решение уравнения, а y₀ решает уравнение с нулём справа, то y₁ + y₀ тоже решение: при подстановке нуль ничего не портит. А все решения однородного — это Ce<sup>−ax</sup>. Частное решение подбирают «по виду правой части»: справа число — ищем число, справа e<sup>kx</sup> — ищем Ae<sup>kx</sup>, справа многочлен — ищем многочлен той же степени." +
          "<p><b>Пример.</b> y′ + y = 2. Однородное: y = Ce<sup>−x</sup>. Частное: y = A, 0 + A = 2, A = 2. Ответ: y = Ce<sup>−x</sup> + 2.</p>",
      ],
      solution: ol(["Однородное " + eq(L + " = 0") + ": " + eq(fr("dy", "y") + " = " + M(-a) + " dx") + " → " + eq("y₀ = " + hom), "Ищем частное решение в виде " + eq(guess), find, "Складываем: " + eq("y = " + hom + " + " + yp)]) + "<p><b>Ответ:</b> y = " + hom + " + " + yp + "</p>",
    };
  };

  function charRoots() {
    const v = Math.random();
    if (v < 0.45) { let l1, l2; do { l1 = ri(-4, 4); l2 = ri(-4, 4); } while (l1 === l2); return { kind: "real", l1: Math.min(l1, l2), l2: Math.max(l1, l2), p: -(l1 + l2), q: l1 * l2 }; }
    if (v < 0.7) { const l = ri(-3, 3) || 1; return { kind: "double", l, p: -2 * l, q: l * l }; }
    const al = pick([0, 0, 1, -1]), be = pick([1, 2, 3]);
    return { kind: "complex", al, be, p: -2 * al, q: al * al + be * be };
  }
  const expTerm = (l, c) => (l === 0 ? c : c + ex(l).h);
  const expTermT = (l, c) => (l === 0 ? c : c + "*" + ex(l).t);
  function homSolution(r) {
    if (r.kind === "real") return { h: expTerm(r.l1, "C₁") + " + " + expTerm(r.l2, "C₂"), t: expTermT(r.l1, "C1") + " + " + expTermT(r.l2, "C2") };
    if (r.kind === "double") return { h: "(C₁ + C₂x)" + (r.l ? ex(r.l).h : ""), t: "(C1 + C2*x)" + (r.l ? "*" + ex(r.l).t : "") };
    const bx = kx(r.be), bxT = kxT(r.be);
    const trig = "(C₁cos " + bx + " + C₂sin " + bx + ")", trigT = "(C1*cos(" + bxT + ") + C2*sin(" + bxT + "))";
    return r.al ? { h: ex(r.al).h + trig, t: ex(r.al).t + "*" + trigT } : { h: trig.slice(1, -1), t: trigT.slice(1, -1) };
  }
  function charLine(r) {
    const ch = poly([[1, { h: "λ<sup>2</sup>", t: "" }], [r.p, "λ"], [r.q, ""]]) + " = 0";
    const D = r.p * r.p - 4 * r.q;
    const roots = r.kind === "real" ? "λ₁ = " + M(r.l1) + ", λ₂ = " + M(r.l2) : r.kind === "double" ? "λ₁ = λ₂ = " + M(r.l) + " (D = 0)" : "λ = " + (r.al ? M(r.al) + " ± " : "±") + (r.be === 1 ? "" : r.be) + "i (D = " + M(D) + " < 0)";
    return { ch, D, roots };
  }
  const RULES = "<ul><li>два разных действительных корня λ₁, λ₂ → y = C₁e<sup>λ₁x</sup> + C₂e<sup>λ₂x</sup>;</li><li>один двойной корень λ → y = (C₁ + C₂x)e<sup>λx</sup>;</li><li>комплексные корни α ± βi → y = e<sup>αx</sup>(C₁cos βx + C₂sin βx).</li></ul>";
  const homLhs = (r) => "y″" + lhsTerm(r.p, "y′") + lhsTerm(r.q, "y");

  DE.hom2 = () => {
    const r = charRoots(), L = homLhs(r), E = L + " = 0", sol = homSolution(r), c = charLine(r);
    return {
      eq: E, ask: odeAsk, kind: "ode",
      ode: { order: 2, dom: [-1, 1], F: (x, y, y1, y2) => [y2 + r.p * y1 + r.q * y, 0], lhs: L, rhs: "0" },
      answer: { h: "y = " + sol.h, t: sol.t },
      hints: [
        "Ищи решение в виде y = e<sup>λx</sup>. После подстановки получится обычное квадратное уравнение на λ — характеристическое.",
        "Характеристическое уравнение: " + eq(c.ch) + ".<br>Его корни: " + eq(c.roots) + ".<br>Теперь запиши ответ по правилу:" + RULES,
        "Почему e<sup>λx</sup>? Её производные похожи на неё саму: (e<sup>λx</sup>)′ = λe<sup>λx</sup>, (e<sup>λx</sup>)″ = λ<sup>2</sup>e<sup>λx</sup>. Подставляем в y″ + py′ + qy = 0 и сокращаем на e<sup>λx</sup> (она никогда не ноль): λ<sup>2</sup> + pλ + q = 0. Дальше ответ зависит от корней:" + RULES +
          "<p>У уравнения второго порядка в общем решении всегда две независимые константы C₁ и C₂.</p><p><b>Пример.</b> y″ − 3y′ + 2y = 0 → λ<sup>2</sup> − 3λ + 2 = 0 → λ = 1, 2 → y = C₁e<sup>x</sup> + C₂e<sup>2x</sup>.</p>",
      ],
      solution: ol([eq(E), "Характеристическое уравнение: " + eq(c.ch), "D = " + M(c.D) + "; " + eq(c.roots), eq("y = " + sol.h)]) + "<p><b>Ответ:</b> y = " + sol.h + "</p>",
    };
  };

  DE.inh2 = () => {
    let r;
    do r = charRoots(); while (r.kind !== "complex" && (r.kind === "real" ? r.l1 * r.l2 === 0 : r.l === 0));
    const L = homLhs(r), sol = homSolution(r), c = charLine(r);
    let fh, f, yp, ypT, guess, find;
    const roots = r.kind === "real" ? [r.l1, r.l2] : r.kind === "double" ? [r.l] : [];
    if (Math.random() < 0.5) {
      const m = ri(-3, 3) || 1, d = r.q * m;
      fh = M(d); f = () => d; yp = M(m); ypT = String(m); guess = "y = A";
      find = "y = A, y′ = y″ = 0: " + eq(P(r.q) + "A = " + d) + " → A = " + M(m);
    } else {
      let k; do k = pick([1, 2, -1, 3, -2]); while (roots.includes(k));
      const Pk = k * k + r.p * k + r.q, n = pick([1, 2, -1]), K = Pk * n;
      fh = kx(K, ex(k).h); f = (x) => K * Math.exp(k * x); yp = kx(n, ex(k).h); ypT = poly([[n, ex(k)]], true); guess = "y = A" + ex(k).h;
      find = "y = A" + ex(k).h + ": " + eq("A(" + P(k) + "<sup>2</sup> + " + P(r.p) + "·" + P(k) + " + " + P(r.q) + ")" + ex(k).h + " = " + fh) + " → " + Pk + "A = " + M(K) + " → A = " + M(n);
    }
    const E = L + " = " + fh;
    return {
      eq: E, ask: odeAsk, kind: "ode",
      ode: { order: 2, dom: [-1, 1], F: (x, y, y1, y2) => [y2 + r.p * y1 + r.q * y, f(x)], lhs: L, rhs: fh },
      answer: { h: "y = " + sol.h + " + " + yp, t: sol.t + " + " + ypT },
      hints: [
        "Ответ = общее решение однородного уравнения (с нулём справа) + одно частное решение этого уравнения.",
        ol(["Однородное " + eq(L + " = 0") + ": характеристическое " + eq(c.ch) + ", корни " + eq(c.roots), "Частное решение ищи в виде " + eq(guess) + " — подставь и найди A."]),
        "Сначала решаем «облегчённое» уравнение, где справа ноль: через характеристическое уравнение λ<sup>2</sup> + pλ + q = 0." + RULES +
          "Потом подбираем одно решение исходного уравнения по виду правой части: справа число — ищем число A, справа e<sup>kx</sup> — ищем Ae<sup>kx</sup>. Сумма двух решений и есть ответ." +
          "<p><b>Пример.</b> y″ − 3y′ + 2y = 4: однородное y₀ = C₁e<sup>x</sup> + C₂e<sup>2x</sup>; частное y = A: 2A = 4, A = 2. Ответ: y = C₁e<sup>x</sup> + C₂e<sup>2x</sup> + 2.</p>",
      ],
      solution: ol(["Характеристическое уравнение: " + eq(c.ch) + "; " + eq(c.roots), "Однородное: " + eq("y₀ = " + sol.h), "Частное: " + find, eq("y = " + sol.h + " + " + yp)]) + "<p><b>Ответ:</b> y = " + sol.h + " + " + yp + "</p>",
    };
  };

  DE.cauchy = () => {
    const v = ri(0, 3);
    if (v === 0) {
      const k = pick([1, 2, -1, 3, -2]), y0 = pick([1, 2, 3, -1, 5]);
      const E = "y′ = " + kx(k, "y") + ",  y(0) = " + M(y0);
      return {
        eq: E, ask: "Реши задачу Коши", kind: "ode",
        ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1, k * y], ic: [[0, y0]], lhs: "y′", rhs: kx(k, "y") },
        answer: { h: "y = " + kx(y0, ex(k).h), t: poly([[y0, ex(k)]], true) },
        hints: [
          "Сначала найди общее решение (с константой C), а потом подставь x = 0 и найди C из условия y(0) = " + M(y0) + ".",
          "Общее решение: " + eq("y = C" + ex(k).h) + ".<br>Подставь x = 0: e<sup>0</sup> = 1, значит y(0) = C. Чему равно C?",
          "У дифференциального уравнения бесконечно много решений — целое семейство кривых (по одной на каждое C). Начальное условие y(0) = " + M(y0) + " говорит: «нужна та кривая, которая проходит через точку (0; " + M(y0) + ")». Подставляем эту точку и находим C." +
            "<p><b>Пример.</b> y′ = 2y, y(0) = 3. Общее: y = Ce<sup>2x</sup>. y(0) = C·1 = 3 → C = 3. Ответ: y = 3e<sup>2x</sup>.</p>",
        ],
        solution: ol(["Общее решение: " + eq("y = C" + ex(k).h), "y(0) = C·e<sup>0</sup> = C = " + M(y0), eq("y = " + kx(y0, ex(k).h))]) + "<p><b>Ответ:</b> y = " + kx(y0, ex(k).h) + "</p>",
      };
    }
    if (v === 1) {
      const A = 3 * ri(-1, 2) || 3, B = 2 * ri(-2, 2), y0 = ri(-5, 5);
      const fh = poly([[A, X2], [B, "x"]]) === "0" ? "1" : poly([[A, X2], [B, "x"]]);
      const F = both([[A / 3, X3], [B / 2, X2], [y0, ""]]);
      const E = "y′ = " + fh + ",  y(0) = " + M(y0);
      return {
        eq: E, ask: "Реши задачу Коши", kind: "ode",
        ode: { order: 1, dom: [-1, 1], F: (x, y, y1) => [y1, A * x * x + B * x], ic: [[0, y0]], lhs: "y′", rhs: fh },
        answer: { h: "y = " + F.h, t: F.t },
        hints: [
          "Проинтегрируй правую часть — получишь общее решение с + C. Затем подставь x = 0 и найди C.",
          "Общее решение: " + eq("y = " + poly([[A / 3, X3], [B / 2, X2]]) + " + C") + ".<br>При x = 0 все слагаемые с x обнуляются: y(0) = C.",
          "Общее решение — семейство кривых, сдвинутых вверх-вниз (это и есть C). Условие y(0) = " + M(y0) + " выбирает одну кривую, проходящую через точку (0; " + M(y0) + ")." +
            "<p><b>Пример.</b> y′ = 2x, y(0) = 5 → y = x<sup>2</sup> + C, y(0) = C = 5 → y = x<sup>2</sup> + 5.</p>",
        ],
        solution: ol([eq("y = " + poly([[A / 3, X3], [B / 2, X2]]) + " + C"), "y(0) = C = " + M(y0), eq("y = " + F.h)]) + "<p><b>Ответ:</b> y = " + F.h + "</p>",
      };
    }
    if (v === 2) {
      const w = pick([1, 2, 3]), A = ri(-3, 3) || 1, B = ri(-3, 3), y1 = B * w;
      const E = "y″" + lhsTerm(w * w, "y") + " = 0,  y(0) = " + M(A) + ",  y′(0) = " + M(y1);
      const wx = kx(w), wxT = kxT(w);
      const ans = both([[A, { h: "cos " + wx, t: "cos(" + wxT + ")" }], [B, { h: "sin " + wx, t: "sin(" + wxT + ")" }]]);
      return {
        eq: E, ask: "Реши задачу Коши", kind: "ode",
        ode: { order: 2, dom: [-1, 1], F: (x, y, yd, y2) => [y2 + w * w * y, 0], ic: [[0, A, y1]], lhs: "y″" + lhsTerm(w * w, "y"), rhs: "0" },
        answer: { h: "y = " + ans.h, t: ans.t },
        hints: [
          "Найди общее решение (характеристическое уравнение λ<sup>2</sup> + " + w * w + " = 0), потом используй оба условия: y(0) и y′(0).",
          "λ = ±" + (w === 1 ? "" : w) + "i, общее решение: " + eq("y = C₁cos " + wx + " + C₂sin " + wx) + ".<br>y(0) = C₁ (потому что cos 0 = 1, sin 0 = 0). Найди y′ и подставь x = 0.",
          "Решения уравнения y″ + ω<sup>2</sup>y = 0 — это колебания: y = C₁cos ωx + C₂sin ωx. Две константы — значит, нужны два условия: начальное положение y(0) и начальная скорость y′(0)." +
            "<p><b>Пример.</b> y″ + 4y = 0, y(0) = 1, y′(0) = 6. y = C₁cos 2x + C₂sin 2x; y(0) = C₁ = 1; y′ = −2C₁sin 2x + 2C₂cos 2x, y′(0) = 2C₂ = 6 → C₂ = 3. Ответ: y = cos 2x + 3sin 2x.</p>",
        ],
        solution: ol(["Общее решение: " + eq("y = C₁cos " + wx + " + C₂sin " + wx), "y(0) = C₁ = " + M(A), "y′ = " + kx(-w, "C₁sin " + wx) + " + " + kx(w, "C₂cos " + wx) + ", y′(0) = " + kx(w, "C₂") + " = " + M(y1) + " → C₂ = " + M(B), eq("y = " + ans.h)]) + "<p><b>Ответ:</b> y = " + ans.h + "</p>",
      };
    }
    let l1, l2;
    do { l1 = ri(-3, 3); l2 = ri(-3, 3); } while (l1 >= l2);
    const C1 = ri(-3, 3) || 1, C2 = ri(-3, 3) || -1, y0 = C1 + C2, y1 = l1 * C1 + l2 * C2;
    const r = { kind: "real", l1, l2, p: -(l1 + l2), q: l1 * l2 }, L = homLhs(r), c = charLine(r);
    const t1 = l1 ? kx(C1, ex(l1).h) : M(C1), t2 = l2 ? kx(C2, ex(l2).h) : M(C2);
    const ansH = t1 + (C2 < 0 ? " − " + t2.replace("−", "") : " + " + t2);
    const ansT = (l1 ? poly([[C1, ex(l1)]], true) : String(C1)) + " + " + (l2 ? "(" + poly([[C2, ex(l2)]], true) + ")" : "(" + C2 + ")");
    const E = L + " = 0,  y(0) = " + M(y0) + ",  y′(0) = " + M(y1);
    return {
      eq: E, ask: "Реши задачу Коши", kind: "ode",
      ode: { order: 2, dom: [-1, 1], F: (x, y, yd, y2) => [y2 + r.p * yd + r.q * y, 0], ic: [[0, y0, y1]], lhs: L, rhs: "0" },
      answer: { h: "y = " + ansH, t: ansT },
      hints: [
        "Найди общее решение через характеристическое уравнение, затем подставь x = 0 в y и в y′ — получится система из двух уравнений на C₁ и C₂.",
        "Характеристическое: " + eq(c.ch) + ", " + eq(c.roots) + ".<br>Общее: " + eq("y = " + homSolution(r).h) + ".<br>" + eq("y(0) = C₁ + C₂ = " + M(y0)) + ", " + eq("y′(0) = " + kx(l1, "C₁").replace(/^$/, "0") + " + " + kx(l2, "C₂") + " = " + M(y1)) + ". Реши систему.",
        "Общее решение содержит две константы — это целое семейство кривых. Два начальных условия (точка и наклон в ней) выбирают ровно одну кривую. Подставляем x = 0: e<sup>0</sup> = 1, поэтому уравнения на C₁ и C₂ получаются простыми." + RULES +
          "<p><b>Пример.</b> y″ − 3y′ + 2y = 0, y(0) = 3, y′(0) = 4. y = C₁e<sup>x</sup> + C₂e<sup>2x</sup>; C₁ + C₂ = 3, C₁ + 2C₂ = 4 → C₂ = 1, C₁ = 2. Ответ: y = 2e<sup>x</sup> + e<sup>2x</sup>.</p>",
      ],
      solution: ol(["Характеристическое: " + eq(c.ch) + " → " + eq(c.roots), "Общее: " + eq("y = " + homSolution(r).h), "Система: C₁ + C₂ = " + M(y0) + ", " + M(l1) + "C₁ + " + P(l2) + "C₂ = " + M(y1) + " → C₁ = " + M(C1) + ", C₂ = " + M(C2), eq("y = " + ansH)]) + "<p><b>Ответ:</b> y = " + ansH + "</p>",
    };
  };

  const TOPICS = [
    { id: "lin", group: "eq", title: "Линейные", sample: "3x + 5 = x − 7", gen: EQ.lin },
    { id: "quad", group: "eq", title: "Квадратные", sample: "x² − 5x + 6 = 0", gen: EQ.quad },
    { id: "inc", group: "eq", title: "Неполные квадратные", sample: "2x² − 8x = 0", gen: EQ.inc },
    { id: "rat", group: "eq", title: "Дробные (ОДЗ)", sample: "(x + 1)/(x − 2) = 4", gen: EQ.rat },
    { id: "exp", group: "eq", title: "Показательные", sample: "2ˣ⁻¹ = 8", gen: EQ.exp },
    { id: "log", group: "eq", title: "Логарифмические", sample: "log₂(x + 1) = 3", gen: EQ.log },
    { id: "prim", group: "ode", title: "y′ = f(x)", sample: "y′ = 6x² − 4x", gen: DE.prim },
    { id: "sep", group: "ode", title: "Разделяющиеся переменные", sample: "y′ = 3y", gen: DE.sep },
    { id: "lin1", group: "ode", title: "Линейные 1-го порядка", sample: "y′ + 2y = 6", gen: DE.lin1 },
    { id: "hom2", group: "ode", title: "2-го порядка, однородные", sample: "y″ − 3y′ + 2y = 0", gen: DE.hom2 },
    { id: "inh2", group: "ode", title: "2-го порядка, с правой частью", sample: "y″ − y = 3", gen: DE.inh2 },
    { id: "cauchy", group: "ode", title: "Задача Коши", sample: "y′ = 2y, y(0) = 3", gen: DE.cauchy },
  ];

  // ---------- Разбор выражений ----------
  const NAMES = ["sqrt", "arctg", "exp", "sin", "cos", "tan", "tg", "ln", "lg", "abs", "pi", "c1", "c2", "c", "x", "e"];
  const FN = { sqrt: Math.sqrt, arctg: Math.atan, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan, ln: Math.log, lg: Math.log10, abs: Math.abs };

  function normalize(s, keepComma) {
    const out = String(s)
      .replace(/[хХ]/g, "x").replace(/[еЕ]/g, "e").replace(/[сС]/g, "c").replace(/[уУ]/g, "y")
      .replace(/[−–—]/g, "-").replace(/[·×∙⋅]/g, "*").replace(/[÷:]/g, "/").replace(/π/g, "pi")
      .replace(/₁/g, "1").replace(/₂/g, "2").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt")
      .replace(/[{\[]/g, "(").replace(/[}\]]/g, ")").toLowerCase();
    return keepComma ? out : out.replace(/(\d),(\d)/g, "$1.$2");
  }

  function tokenize(src) {
    const s = normalize(src), out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        const m = s.slice(i).match(/^\d*\.?\d+|^\d+\.?/);
        out.push({ k: "n", v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if ("+-*/^()".includes(ch)) { out.push({ k: ch }); i++; continue; }
      const name = NAMES.find((n) => s.startsWith(n, i));
      if (!name) throw new Error("Не понимаю символ «" + src.trim()[Math.min(i, src.trim().length - 1)] + "». Можно использовать x, C, C1, C2, e, числа, + − * / ^, скобки, sin, cos, ln, sqrt.");
      i += name.length;
      if (FN[name]) out.push({ k: "f", v: name });
      else out.push({ k: "v", v: name === "c1" ? "C1" : name === "c2" ? "C2" : name === "c" ? "C" : name });
    }
    const res = [];
    out.forEach((t, j) => {
      const prev = res[res.length - 1];
      if (prev && (prev.k === "n" || prev.k === "v" || prev.k === ")") && (t.k === "n" || t.k === "v" || t.k === "f" || t.k === "(")) res.push({ k: "*", imp: true });
      res.push(t);
    });
    return res;
  }

  function parse(src) {
    const s = String(src).trim().replace(/^\s*[yу]\s*(\(\s*[xх]\s*\))?\s*=\s*/i, "");
    if (!s) throw new Error("Пустой ответ.");
    const tk = tokenize(s);
    let i = 0;
    const peek = () => tk[i], next = () => tk[i++];
    const expect = (k) => { if (!peek() || peek().k !== k) throw new Error(k === ")" ? "Не хватает закрывающей скобки." : "Ошибка в записи."); i++; };
    function expr() {
      let a = term();
      while (peek() && (peek().k === "+" || peek().k === "-")) { const op = next().k; a = { t: "b", op, a, b: term() }; }
      return a;
    }
    function term() {
      let a = unary();
      while (peek() && (peek().k === "*" || peek().k === "/")) { const op = next().k; a = { t: "b", op, a, b: unary() }; }
      return a;
    }
    function unary() {
      if (peek() && peek().k === "-") { next(); return { t: "u", a: unary() }; }
      if (peek() && peek().k === "+") { next(); return unary(); }
      return power();
    }
    function power() {
      const base = primary();
      if (peek() && peek().k === "^") { next(); return { t: "b", op: "^", a: base, b: exponent() }; }
      return base;
    }
    function exponent() {
      if (peek() && peek().k === "(") return power();
      let neg = false;
      if (peek() && peek().k === "-") { next(); neg = true; } else if (peek() && peek().k === "+") next();
      let e = power();
      while (peek() && peek().k === "*" && peek().imp && tk[i + 1] && tk[i + 1].k === "v" && tk[i + 1].v === "x") { next(); e = { t: "b", op: "*", a: e, b: primary() }; }
      return neg ? { t: "u", a: e } : e;
    }
    function primary() {
      const t = next();
      if (!t) throw new Error("Выражение оборвалось.");
      if (t.k === "n") return { t: "n", v: t.v };
      if (t.k === "v") return { t: "v", v: t.v };
      if (t.k === "(") { const e = expr(); expect(")"); return e; }
      if (t.k === "f") {
        if (peek() && peek().k === "(") return { t: "f", f: t.v, a: primary() };
        let a = power();
        while (peek() && peek().k === "*" && peek().imp && tk[i + 1] && tk[i + 1].k !== "f") { next(); a = { t: "b", op: "*", a, b: power() }; }
        return { t: "f", f: t.v, a };
      }
      throw new Error("Ошибка в записи около «" + (t.k === "*" ? "*" : t.k) + "».");
    }
    const e = expr();
    if (i < tk.length) throw new Error(tk[i].k === ")" ? "Лишняя закрывающая скобка." : "Ошибка в записи.");
    return e;
  }

  function evaluate(n, env) {
    switch (n.t) {
      case "n": return n.v;
      case "v": return n.v === "e" ? Math.E : n.v === "pi" ? Math.PI : env[n.v];
      case "u": return -evaluate(n.a, env);
      case "f": return FN[n.f](evaluate(n.a, env));
      default: {
        const a = evaluate(n.a, env), b = evaluate(n.b, env);
        return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : Math.pow(a, b);
      }
    }
  }
  function vars(n, set) {
    set = set || new Set();
    if (n.t === "v" && n.v !== "e" && n.v !== "pi") set.add(n.v);
    ["a", "b"].forEach((k) => n[k] && typeof n[k] === "object" && vars(n[k], set));
    return set;
  }

  const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
  function show(n, parent, side) {
    const wrap = (s, p) => (parent !== undefined && p < parent ? "(" + s + ")" : s);
    switch (n.t) {
      case "n": return String(n.v).replace(".", ",");
      case "v": return n.v === "C1" ? "C₁" : n.v === "C2" ? "C₂" : n.v === "pi" ? "π" : n.v;
      case "u": return wrap("−" + show(n.a, 3), 3);
      case "f": return (n.f === "sqrt" ? "√" : n.f) + "(" + show(n.a) + ")";
      default: {
        if (n.op === "^") return wrap(show(n.a, 5) + "<sup>" + show(n.b) + "</sup>", 4);
        const p = PREC[n.op];
        const a = show(n.a, p), b = show(n.b, n.op === "-" || n.op === "/" ? p + 1 : p);
        if (n.op === "*") {
          const tight = n.b.t !== "n" && n.b.t !== "u" && !(n.b.t === "f" && n.a.t !== "n") && !/^[0-9]/.test(b.replace(/^\(/, ""));
          return wrap(a + (tight ? "" : "·") + b, p);
        }
        return wrap(a + (n.op === "+" ? " + " : n.op === "-" ? " − " : " / ") + b, p);
      }
    }
  }

  // ---------- Проверка ----------
  function parseRoots(src) {
    const raw = String(src).trim().toLowerCase();
    if (!raw) throw new Error("Впиши ответ.");
    if (/нет|∅|не\s*имеет|пуст|no/.test(raw)) return [];
    const s = normalize(raw, true).replace(/x\s*[12]?\s*=/g, " ; ");
    let parts = s.split(/;|,|\s+и\s+|\s+или\s+|\n/).map((p) => p.trim()).filter(Boolean);
    parts = parts.flatMap((p) => (/^-?\d+(\.\d+)?(\s+-?\d+(\.\d+)?)+$/.test(p) ? p.split(/\s+/) : [p]));
    if (!parts.length) throw new Error("Впиши хотя бы один корень или «нет корней».");
    return parts.map((p) => {
      const ast = parse(p);
      if (vars(ast).size) throw new Error("В ответе должны быть числа, а не «" + [...vars(ast)][0] + "».");
      const v = evaluate(ast, {});
      if (!isFinite(v)) throw new Error("Не получается посчитать «" + p + "».");
      return v;
    });
  }

  const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? M(Math.round(v)) : M(Math.round(v * 1000) / 1000).replace(".", ","));

  function checkRoots(task, src) {
    const user = [];
    parseRoots(src).forEach((v) => { if (!user.some((u) => near(u, v))) user.push(v); });
    const need = task.roots;
    const wrong = user.filter((u) => !need.some((r) => near(r, u)));
    const missing = need.filter((r) => !user.some((u) => near(r, u)));
    if (!wrong.length && !missing.length) return { ok: true };
    if (!need.length) {
      const u = wrong[0], l = task.L(u), r = task.R(u);
      return { ok: false, msg: "Подставим x = " + fmt(u) + ": " + (isFinite(l) && isFinite(r) ? "слева " + fmt(l) + ", справа " + fmt(r) + " — не равно." : "уравнение при нём не имеет смысла.") + " Проверь, есть ли у уравнения корни вообще." };
    }
    if (!user.length) return { ok: false, msg: "Корни у этого уравнения есть. Попробуй ещё раз или открой подсказку." };
    if (wrong.length) {
      const u = wrong[0], l = task.L(u), r = task.R(u);
      if (!isFinite(l) || !isFinite(r) || isNaN(l)) return { ok: false, msg: "x = " + fmt(u) + " — посторонний корень: при нём уравнение не имеет смысла (деление на ноль или логарифм неположительного числа). Его нужно выбросить по ОДЗ." };
      return { ok: false, msg: "x = " + fmt(u) + " не подходит. Подставим: слева " + fmt(l) + ", справа " + fmt(r) + " — не равно." + (missing.length ? "" : "") };
    }
    return { ok: false, msg: "Верно, но найдены не все корни: у уравнения " + (need.length === 2 ? "два корня" : need.length + " корня") + "." };
  }

  function checkOde(task, src) {
    const ast = parse(src), used = vars(ast), o = task.ode;
    const bad = [...used].filter((v) => !["x", "C", "C1", "C2"].includes(v));
    if (bad.length) throw new Error("Непонятная буква «" + bad[0] + "».");
    const consts = [...used].filter((v) => v !== "x");
    if (o.ic) {
      if (consts.length) return { ok: false, msg: "В задаче Коши в ответе не должно остаться констант: найди их из начальных условий." };
    } else if (o.order === 1) {
      if (!consts.length) return { ok: false, msg: "Это одно частное решение, а нужно общее — со произвольной константой C." };
      if (consts.length > 1) return { ok: false, msg: "У уравнения первого порядка в общем решении одна константа C." };
    } else if (!(used.has("C1") && used.has("C2"))) {
      return { ok: false, msg: "У уравнения второго порядка общее решение содержит две константы: C1 и C2." };
    }
    const cName = consts[0];
    const f = (x, env) => evaluate(ast, Object.assign({ x }, env));
    const h = 1e-3;
    const at = (x, env) => {
      const y = f(x, env), yp = f(x + h, env), ym = f(x - h, env);
      return [y, (yp - ym) / (2 * h), (yp - 2 * y + ym) / (h * h)];
    };
    const rc = () => (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.5);
    const [lo, hi] = o.dom;
    let first = null;
    for (let i = 0; i < 8; i++) {
      const x = i === 0 ? (lo <= 1 && hi >= 1 ? 1 : (lo + hi) / 2) : lo + (hi - lo) * (0.08 + 0.84 * Math.random());
      const env = i === 0 ? { C: 1, C1: 1, C2: 1 } : { C: rc(), C1: rc(), C2: rc() };
      const [y, y1, y2] = at(x, env);
      if (![y, y1, y2].every(isFinite)) return { ok: false, msg: "При x = " + fmt(x) + " твоё выражение не определено. Проверь запись." };
      const [L, R] = o.F(x, y, y1, y2);
      const ok = Math.abs(L - R) <= 1e-4 * (1 + Math.abs(L) + Math.abs(R) + Math.abs(y) * 4);
      if (!ok && !first) first = { x, env, L, R };
    }
    if (first) {
      const cs = consts.length ? " (возьмём " + consts.map((c) => c.replace("1", "₁").replace("2", "₂") + " = " + fmt(first.env[c])).join(", ") + ")" : "";
      return { ok: false, msg: "Подставим твой ответ в уравнение при x = " + fmt(first.x) + cs + ": слева " + o.lhs + " = " + fmt(first.L) + ", справа " + o.rhs + " = " + fmt(first.R) + ". Не сходится — значит, это не решение." };
    }
    if (o.ic) {
      for (const [x0, y0, y10] of o.ic) {
        const [y, y1] = at(x0, {});
        if (!near(y, y0) && Math.abs(y - y0) > 1e-5) return { ok: false, msg: "Уравнению ответ удовлетворяет, но y(" + x0 + ") = " + fmt(y) + ", а должно быть " + fmt(y0) + ". Пересчитай константу." };
        if (y10 !== undefined && Math.abs(y1 - y10) > 1e-4 * (1 + Math.abs(y10))) return { ok: false, msg: "Уравнению и условию y(0) ответ удовлетворяет, но y′(0) = " + fmt(y1) + ", а должно быть " + fmt(y10) + ". Пересчитай C₂." };
      }
      return { ok: true };
    }
    const x0 = (lo + hi) / 2 + 0.13;
    if (o.order === 1) {
      const a = f(x0, { C: 0.7 }), b = f(x0, { C: 1.9 });
      if (Math.abs(a - b) < 1e-7) return { ok: false, msg: "Константа " + cName + " в твоём ответе ни на что не влияет — это не общее решение." };
      return { ok: true };
    }
    const base = { C1: 0.6, C2: 0.8 };
    const d = (name) => { const e = Object.assign({}, base); e[name] += 1; const p = at(x0, e), q = at(x0, base); return [p[0] - q[0], p[1] - q[1]]; };
    const [a1, b1] = d("C1"), [a2, b2] = d("C2");
    const det = a1 * b2 - a2 * b1, scale = (Math.abs(a1) + Math.abs(b1)) * (Math.abs(a2) + Math.abs(b2));
    if (Math.abs(det) <= 1e-6 * (scale + 1e-12)) return { ok: false, msg: "Константы C₁ и C₂ в ответе «слипаются» в одну (слагаемые при них пропорциональны). Это не общее решение: нужны два независимых слагаемых." };
    return { ok: true };
  }

  function check(task, src) {
    try { return task.kind === "roots" ? checkRoots(task, src) : checkOde(task, src); }
    catch (e) { return { ok: false, parse: true, msg: e.message }; }
  }

  function preview(task, src) {
    if (!String(src).trim()) return "";
    try {
      if (task.kind === "roots") {
        const r = parseRoots(src);
        return r.length ? r.map((v) => "x = " + fmt(v)).join(";  ") : "корней нет";
      }
      return "y = " + show(parse(src));
    } catch (e) { return null; }
  }

  function make(topicId) {
    const tp = TOPICS.find((t) => t.id === topicId);
    const task = tp.gen();
    task.topic = tp.id;
    task.group = tp.group;
    return task;
  }

  root.EqTasks = { TOPICS, make, check, preview, parse, evaluate, show, checkOde, checkRoots };
  if (typeof module !== "undefined") module.exports = root.EqTasks;
})(typeof window !== "undefined" ? window : globalThis);
