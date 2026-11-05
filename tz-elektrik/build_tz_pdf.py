#!/usr/bin/env python3
"""Сборка PDF «Хотелки / мини-ТЗ для электрика» (этап 1 подробно)."""

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT_REPO = ROOT / "TZ-elektrik-etap1.pdf"
OUT_ARTIFACTS = Path("/opt/cursor/artifacts/TZ-elektrik-etap1.pdf")

pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

INK = HexColor("#1c2430")
MUTED = HexColor("#4a5564")
LINE = HexColor("#d5dbe3")
NAVY = HexColor("#1e3a5f")
TEAL = HexColor("#1f6b5a")
AMBER = HexColor("#8a5a12")
CREAM = HexColor("#f6f1e7")
PALE = HexColor("#eef3f7")
WARN = HexColor("#fff4e0")
WARN_LINE = HexColor("#d08a20")


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            fontName="DejaVu",
            fontSize=10,
            textColor=TEAL,
            alignment=TA_CENTER,
            spaceAfter=6,
            tracking=1,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="DejaVuBold",
            fontSize=22,
            leading=28,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName="DejaVu",
            fontSize=12,
            leading=16,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="DejaVuBold",
            fontSize=15,
            leading=20,
            textColor=NAVY,
            spaceBefore=12,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="DejaVuBold",
            fontSize=12.5,
            leading=16,
            textColor=TEAL,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="DejaVu",
            fontSize=10,
            leading=14.5,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="DejaVu",
            fontSize=10,
            leading=14,
            textColor=INK,
            leftIndent=4,
            spaceAfter=2,
        ),
        "caption": ParagraphStyle(
            "caption",
            fontName="DejaVu",
            fontSize=8.5,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=3,
            spaceAfter=10,
        ),
        "toc": ParagraphStyle(
            "toc",
            fontName="DejaVu",
            fontSize=11,
            leading=18,
            textColor=INK,
        ),
        "note": ParagraphStyle(
            "note",
            fontName="DejaVu",
            fontSize=9.5,
            leading=13,
            textColor=INK,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName="DejaVu",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "th": ParagraphStyle(
            "th",
            fontName="DejaVuBold",
            fontSize=9,
            leading=12,
            textColor=white,
        ),
        "td": ParagraphStyle(
            "td",
            fontName="DejaVu",
            fontSize=8.5,
            leading=12,
            textColor=INK,
        ),
        "td_b": ParagraphStyle(
            "td_b",
            fontName="DejaVuBold",
            fontSize=8.5,
            leading=12,
            textColor=INK,
        ),
    }
    return s


S = styles()


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("DejaVu", 8)
    canvas.drawString(16 * mm, h - 7.5 * mm, "Сад / мини-ТЗ для электрика  ·  этап 1 подробно")
    canvas.drawRightString(w - 16 * mm, h - 7.5 * mm, "220 В · 1 фаза · 7 кВт")
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("DejaVu", 8)
    canvas.drawString(16 * mm, 4 * mm, "Хотелки хозяина. Номиналы автоматов групп — на месте, не заданы заранее.")
    canvas.drawRightString(w - 16 * mm, 4 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("DejaVu", 8)
    canvas.drawCentredString(w / 2, 6 * mm, "Документ для выезда электрика  ·  без нормативных ссылок")
    canvas.restoreState()


def p(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    flow = []
    for item in items:
        flow.append(
            ListItem(Paragraph(item, S["bullet"]), leftIndent=12, bulletColor=TEAL)
        )
    return ListFlowable(flow, bulletType="bullet", start="•", leftIndent=14, bulletFontName="DejaVu")


def fig(name, caption, max_h=78 * mm, max_w=178 * mm):
    path = ASSETS / name
    img = Image(str(path))
    iw, ih = img.imageWidth, img.imageHeight
    scale = min(max_w / iw, max_h / ih)
    img.drawWidth = iw * scale
    img.drawHeight = ih * scale
    return KeepTogether([img, Paragraph(caption, S["caption"])])


def banner(text, bg=WARN, border=WARN_LINE):
    inner = Paragraph(text, S["note"])
    t = Table([[inner]], colWidths=[178 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def simple_table(headers, rows, col_widths):
    head = [Paragraph(h, S["th"]) for h in headers]
    data = [head]
    for row in rows:
        data.append([Paragraph(c, S["td"] if i else S["td_b"]) for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BACKGROUND", (0, 1), (-1, -1), PALE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PALE, white]),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def build_story():
    story = []

    story.append(Spacer(1, 8 * mm))
    story.append(p("САД  ·  ХОТЕЛКИ / МИНИ-ТЗ ДЛЯ ЭЛЕКТРИКА", "cover_kicker"))
    story.append(p("Этап 1: новый щит,<br/>чулан и баня", "cover_title"))
    story.append(p("Одна фаза 220 В. По договору 7 кВт. Язык простой. Это не проект — список желаний и фактов.", "cover_sub"))
    story.append(Spacer(1, 3 * mm))
    story.append(fig("oblozhka-etap1-shchit-chulan-banya.jpg", "Рис. 1. Обложка этапа 1: щит в прихожей → чулан → баня. Подписи на рисунке кривые — смотрите текст ниже.", 72 * mm))
    story.append(banner(
        "<b>Главное ограничение.</b> Новые нагрузки только в бане по сумме примерно <b>9,1 кВт</b>. "
        "Это больше договорных <b>7 кВт</b>. Всё сразу не включить. Нужен приоритет нагрузки "
        "(что можно греть/кипятить одновременно, что нет). Номиналы автоматов групп в этом документе "
        "<b>не заданы</b> — их выбирает электрик на месте."
    ))
    story.append(PageBreak())

    story.append(p("Оглавление", "h1"))
    toc = [
        "1. Что это за документ и что не выдумывать",
        "2. Факты по вводу: 220 В, 7 кВт, счётчик, кабель",
        "3. Сейчас: фанерный щит C40 и замена в прихожую",
        "4. Этап 1 — чулан",
        "5. Этап 1 — баня (план и новые точки)",
        "6. Приоритет нагрузки: ~9,1 кВт больше 7 кВт",
        "7. Этапы 2 и дальше — коротко",
        "8. Что сделать электрику на выезде",
    ]
    for i, line in enumerate(toc, 1):
        story.append(p(line, "toc"))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Картинки в документе", "h2"))
    story.append(bullets([
        "Рис. 1 — блок-схема этапа 1 (щит + чулан + баня)",
        "Рис. 2 — путь кабеля: столб → над дверью → чердак → щит",
        "Рис. 3 — разбор текущего фанерного щита EKF C40 2P",
        "Рис. 4 — план бани 6×2,4: комната отдыха → моечная → парная",
    ]))
    story.append(p(
        "Фото самой бани и фасада домика в папках не нашлись "
        "(искали в /workspace, /opt/cursor/artifacts, /home/ubuntu/.cursor/projects/workspace/assets, /agent/repos/Test). "
        "Есть только разбор щита. Планы и схемы нарисованы заново."
    ))

    story.append(p("1. Что это за документ", "h1"))
    story.append(p(
        "Это хотелки хозяина сада: что есть сейчас и что нужно сделать в первую очередь. "
        "Не смета, не однолинейка, не проект. Нормы и марки кабеля сверх уже сказанного — на усмотрение электрика."
    ))
    story.append(p("Что уже согласовано", "h2"))
    story.append(bullets([
        "Сеть: <b>220 В, одна фаза</b>. По договору <b>7 кВт</b>.",
        "Этап 1 подробно: <b>новый щиток + чулан + баня</b>.",
        "Дальше коротко: комната домика; прихожая / камеры / улица.",
        "Новый щит ставить в <b>прихожей</b>, не оставлять фанерный щит в комнате.",
        "PE (земля) <b>частично уже есть</b> — надо проверить и дотянуть, где дырки.",
        "Автоматы групп <b>не придумывать</b> в этом тексте. Есть только факт: сейчас стоит EKF C40 2P на вводе щита.",
    ]))

    story.append(p("2. Ввод: столб, кабель, домик", "h1"))
    story.append(p(
        "Счётчик висит <b>на столбе через дорогу</b>. Кабель идёт так: столб → "
        "<b>над входной дверью домика</b> → <b>чердак</b> → вниз к щиту. "
        "Новый щит должен оказаться в прихожей; трасса сверху (чердак → вниз) сохраняется по смыслу."
    ))
    story.append(fig(
        "shema-vvod-stolb-cherdak-shchit.jpg",
        "Рис. 2. Путь ввода. Буквы на рисунке плывут — читайте подпись: столб со счётчиком, через дорогу, "
        "вход над дверью, чердак, вниз в новый щит прихожей; старый щит в комнате убираем.",
        80 * mm,
    ))
    story.append(simple_table(
        ["Что", "Как есть / как надо"],
        [
            ["Напряжение", "220 В, одна фаза (не три фазы)"],
            ["Мощность по договору", "7 кВт"],
            ["Счётчик", "На столбе, через дорогу от участка"],
            ["Кабель до домика", "Столб → над входной дверью → чердак → вниз к щиту"],
            ["Куда ставить новый щит", "Прихожая"],
            ["Куда не оставлять старый", "Комната, фанерный щит"],
        ],
        [50 * mm, 128 * mm],
    ))

    story.append(p("3. Сейчас: фанерный щит, замена", "h1"))
    story.append(p(
        "В комнате стоит фанерный щит: автомат <b>EKF C40 двухполюсный</b> (фаза + ноль в одном корпусе — это один автомат, не «два автомата»). "
        "Рядом клеммник, шина нуля, розетка/переходник, выключатели. PE есть не везде. "
        "Этот щит <b>заменить новым</b> и повесить его в прихожей."
    ))
    story.append(fig(
        "sadovyy-shchit-c40-razbor.jpg",
        "Рис. 3. Разбор текущего щита: сверху вход 220 В от счётчика на столбе, один EKF C40 2P, снизу выход в дом. "
        "Номиналы новых групповых автоматов с этой картинки не копировать — это старый щит.",
        95 * mm,
    ))
    story.append(p("Что просим по новому щиту (без номиналов групп)", "h2"))
    story.append(bullets([
        "Нормальный щит в прихожей вместо фанеры в комнате.",
        "Ввод с учётом того, что есть: 220 В, 7 кВт, кабель сверху с чердака.",
        "Шины N и PE отдельно, земля дотянуть там, где её нет.",
        "Места под группы этапа 1: чулан, баня, и запас под этапы 2+ (комната, прихожая, камеры, улица).",
        "Сколько модулей и какие автоматы/УЗО на группы — решает электрик после осмотра сечений и нагрузки. Здесь цифры не пишем.",
    ]))

    story.append(p("4. Этап 1 — чулан", "h1"))
    story.append(p("Чулан питается от нового щита в прихожей. Точки, которые нужны:"))
    story.append(simple_table(
        ["Точка", "Комментарий"],
        [
            ["Свет LED", "Выключатель — в прихожей, не в чулане"],
            ["×3 вода / автоматика", "Три точки под автоматику воды (как решит электрик: розетки или выводы)"],
            ["Насос", "Отдельная точка под насос"],
            ["Резерв бойлера", "Точка про запас, бойлер могут поставить позже"],
            ["×2 универсал", "Две обычные универсальные розетки"],
            ["Ballu 500 Вт", "Обогреватель 0,5 кВт — точка в чулане"],
        ],
        [48 * mm, 130 * mm],
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(p(
        "Сечения и автоматы чулана не назначаем заранее. Насос и вода — влажное/ответственное, "
        "электрик смотрит место и делает как надо. Выключатель света именно в прихожей — это удобство, не забыть."
    ))

    story.append(p("5. Этап 1 — баня", "h1"))
    story.append(p(
        "Баня <b>6 × 2,4 м</b>. Три отделения подряд: <b>комната отдыха → моечная → парная</b>. "
        "Вход с <b>длинной</b> стороны (в комнату отдыха). "
        "Питание: <b>кабель в земле 10–15 м, с PE</b>, от домика/нового щита."
    ))
    story.append(fig(
        "plan-banya-3-otdeleniya.jpg",
        "Рис. 4. План бани. Слева комната отдыха (все новые точки), центр моечная, справа парная. "
        "Вход снизу с длинной стороны. Кабель в земле с PE. Надписи на рисунке кривые — таблица ниже верная.",
        82 * mm,
    ))
    story.append(p("Новые точки — только комната отдыха", "h2"))
    story.append(simple_table(
        ["Что", "Ориентир по мощности", "Заметка"],
        [
            ["Конвектор Wi-Fi", "2,5 кВт", "Новая точка"],
            ["Ballu BIH-APL-0.6-M", "0,6 кВт", "ИК, модель названа"],
            ["Чайник", "~2 кВт", "Розетка"],
            ["Самовар", "~1 кВт", "Розетка"],
            ["Проточник", "~3 кВт", "Новая точка"],
            ["Штатный свет + розетка", "как есть", "Отдельная линия 1,5 мм² — не смешивать с новыми мощными"],
            ["Моечная", "—", "Без новых точек"],
            ["Парная", "—", "Без новых точек"],
        ],
        [52 * mm, 42 * mm, 84 * mm],
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(p(
        "Сумма новых ориентиров: 2,5 + 0,6 + 2 + 1 + 3 = <b>~9,1 кВт</b>. "
        "Плюс штатный свет/розетка. Плюс дом и чулан. Договор — 7 кВт. Отсюда следующий раздел."
    ))

    story.append(p("6. Приоритет нагрузки", "h1"))
    story.append(banner(
        "<b>~9,1 кВт новых приборов бани &gt; 7 кВт по договору.</b> "
        "Если включить конвектор, проточник и чайник вместе — сети не хватит, выбьет ввод или сядет напряжение. "
        "Нужно правило «что с чем нельзя» и, если электрик предложит, простое ручное или автоматическое ограничение. "
        "Конкретную схему приоритета не навязываем — нужна рабочая и понятная."
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(p("Черновой смысл приоритета (обсудить на месте)", "h2"))
    story.append(bullets([
        "Тяжёлые: конвектор 2,5 кВт и проточник ~3 кВт — лучше не вместе, если ещё что-то греется в доме.",
        "Средние: чайник ~2 и самовар ~1 — коротко по времени, но в сумме с конвектором уже тесно.",
        "Лёгкие: Ballu 0,6 кВт и свет — почти всегда можно.",
        "Чулан: Ballu 500 Вт и насос обычно слабее бани, но насос не должен садиться в момент пика, если от него вода.",
        "Цифры — ориентиры хозяина, не паспортные замеры. Электрик может уточнить по шильдикам.",
    ]))

    story.append(p("7. Этапы 2 и дальше — коротко", "h1"))
    story.append(p(
        "Это не этап 1. В новом щите просто оставить место и понять трассы, чтобы потом не долбить дважды."
    ))
    story.append(simple_table(
        ["Позже", "Коротко"],
        [
            ["Комната домика", "Нормальный свет и розетки вместо того, что кормилось от фанерного щита и тройников"],
            ["Прихожая", "Свет, розетки у входа; здесь же новый щит — сразу продумать аккуратно"],
            ["Камеры", "Питание и, если нужно, слаботочка. Место в щите / отдельный блок"],
            ["Улица", "Фонари, розетка снаружи — по факту, когда дойдут руки"],
        ],
        [48 * mm, 130 * mm],
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(p(
        "Детальных списков точек по комнате, камерам и улице в этом документе нет — это следующие заходы."
    ))

    story.append(p("8. Что сделать электрику на выезде", "h1"))
    story.append(bullets([
        "Посмотреть столб, кабель над дверью, чердак, спуск, фанерный щит, чулан, трассу к бане.",
        "Сказать, жив ли кабель ввода и что делать с землёй (PE частично есть).",
        "Предложить щит в прихожей: размер, куда вешать, как перекинуть линии.",
        "Развести этап 1: чулан (свет с выключателем в прихожей, вода ×3, насос, резерв бойлера, ×2 универсал, Ballu 500 Вт) и баню по списку выше.",
        "Баня: кабель в земле 10–15 м с PE; моечная и парная без новых точек; штатный свет+розетка оставить на своей 1,5 мм².",
        "Честно посчитать, что влезет в 7 кВт, и предложить приоритет нагрузки. Номиналы групп — его решение после осмотра, не из этого PDF.",
        "Этапы 2+ только заложить по месту, не делать сейчас, если не попросим.",
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(banner(
        "Ещё раз: в документе нарочно нет ампер групповых автоматов, кроме факта «сейчас стоит C40 2P на старом щите». "
        "Любые амперы «на глаз» из чата — не использовать.",
        PALE,
        LINE,
    ))
    story.append(Spacer(1, 6 * mm))
    story.append(p("Конец мини-ТЗ. Картинки — подсказка глазу, текст — источник правды.", "cover_sub"))
    return story


def main():
    OUT_ARTIFACTS.parent.mkdir(parents=True, exist_ok=True)

    def write(path: Path):
        doc = SimpleDocTemplate(
            str(path),
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=18 * mm,
            bottomMargin=16 * mm,
            title="Хотелки / мини-ТЗ для электрика — этап 1",
            author="Хозяин сада",
            subject="Щит, чулан, баня. 220 В, 7 кВт.",
        )
        story = build_story()
        doc.build(story, onFirstPage=cover_header_footer, onLaterPages=header_footer)

    write(OUT_REPO)
    write(OUT_ARTIFACTS)
    for pth in (OUT_REPO, OUT_ARTIFACTS):
        print(f"{pth}  {pth.stat().st_size} bytes")


if __name__ == "__main__":
    main()
