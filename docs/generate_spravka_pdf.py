#!/usr/bin/env python3
"""Генерация PDF-справки: переезд Битрикс24 облако → коробка."""

from pathlib import Path

from fpdf import FPDF

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
OUT = Path("/opt/cursor/artifacts/Bitrix24_spravka_oblako_korobka.pdf")
OUT_REPO = Path("/workspace/docs/Bitrix24_spravka_oblako_korobka.pdf")


class BriefPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 6, "Справка для клиента · Битрикс24: облако → коробка", align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-14)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, f"стр. {self.page_no()}/{{nb}}", align="C")


def h1(pdf: BriefPDF, text: str):
    pdf.set_font("DejaVu", "B", 15)
    pdf.set_text_color(25, 35, 55)
    pdf.multi_cell(0, 7, text)
    pdf.ln(2)


def h2(pdf: BriefPDF, text: str):
    pdf.ln(1)
    pdf.set_draw_color(45, 95, 160)
    pdf.set_line_width(0.5)
    x = pdf.get_x()
    y = pdf.get_y()
    pdf.line(x, y, x + 10, y)
    pdf.ln(2.5)
    pdf.set_font("DejaVu", "B", 11)
    pdf.set_text_color(30, 50, 90)
    pdf.multi_cell(0, 6, text)
    pdf.ln(1)


def body(pdf: BriefPDF, text: str):
    pdf.set_font("DejaVu", "", 9.5)
    pdf.set_text_color(40, 40, 45)
    pdf.multi_cell(0, 5, text)
    pdf.ln(1)


def bold_inline_para(pdf: BriefPDF, parts: list[tuple[str, str]]):
    """parts: list of (style, text) where style is '' or 'B'."""
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(40, 40, 45)
    line_h = 5.5
    for style, text in parts:
        pdf.set_font("DejaVu", style, 10)
        pdf.write(line_h, text)
    pdf.ln(line_h + 1)


def bullet(pdf: BriefPDF, text: str):
    pdf.set_font("DejaVu", "", 9.5)
    pdf.set_text_color(40, 40, 45)
    pdf.cell(5, 5, "•")
    pdf.multi_cell(0, 5, text)
    pdf.ln(0.4)


def callout(pdf: BriefPDF, text: str):
    pdf.set_fill_color(235, 242, 250)
    pdf.set_draw_color(45, 95, 160)
    pdf.set_line_width(0.4)
    x = pdf.l_margin
    w = pdf.epw
    pdf.set_x(x)
    y0 = pdf.get_y()
    pdf.set_font("DejaVu", "", 9.5)
    pdf.set_text_color(30, 50, 90)
    pdf.multi_cell(w - 8, 5, text)
    y1 = pdf.get_y()
    height = y1 - y0 + 3
    pdf.set_y(y0)
    pdf.rect(x, y0, w, height, style="DF")
    pdf.set_xy(x + 4, y0 + 1.5)
    pdf.multi_cell(w - 8, 5, text)
    pdf.ln(2)


def table(pdf: BriefPDF, headers: list[str], rows: list[list[str]]):
    col_w = [pdf.epw * 0.42, pdf.epw * 0.58]
    line_h = 4.8
    pdf.set_font("DejaVu", "B", 8.5)
    pdf.set_fill_color(45, 95, 160)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, f"  {h}", border=0, fill=True)
    pdf.ln()

    pdf.set_font("DejaVu", "", 8.5)
    pdf.set_text_color(40, 40, 45)
    for r_idx, row in enumerate(rows):
        fill = r_idx % 2 == 0
        if fill:
            pdf.set_fill_color(245, 247, 250)
        else:
            pdf.set_fill_color(255, 255, 255)

        heights = []
        for i, cell in enumerate(row):
            heights.append(pdf.multi_cell(col_w[i], line_h, f"  {cell}", dry_run=True, output="HEIGHT"))
        row_h = max(heights) + 1.5
        y = pdf.get_y()
        x0 = pdf.l_margin
        if y + row_h > pdf.page_break_trigger:
            pdf.add_page()
            y = pdf.get_y()

        for i, cell in enumerate(row):
            x = x0 + sum(col_w[:i])
            pdf.rect(x, y, col_w[i], row_h, style="F" if fill else "")
            pdf.set_xy(x, y + 0.8)
            pdf.multi_cell(col_w[i], line_h, f"  {cell}")
        pdf.set_y(y + row_h)
    pdf.ln(2)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPO.parent.mkdir(parents=True, exist_ok=True)

    pdf = BriefPDF(format="A4", unit="mm")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_font("DejaVu", "", FONT_REG)
    pdf.add_font("DejaVu", "B", FONT_BOLD)
    pdf.set_margins(16, 12, 16)
    pdf.add_page()

    # Title block
    pdf.set_font("DejaVu", "", 8.5)
    pdf.set_text_color(100, 110, 125)
    pdf.cell(0, 4.5, "Краткая справка для клиента", align="L")
    pdf.ln(5)

    h1(pdf, "Почему Битрикс24 перестал обеспечивать\nпереезд с облака на коробку")

    pdf.set_font("DejaVu", "", 8.5)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 4.5, "Дата подготовки: июль 2026")
    pdf.ln(6)

    callout(
        pdf,
        "С 1 сентября 2023 года «1С-Битрикс» прекратила принимать заявки на официальный "
        "перенос портала из облачного Битрикс24 в коробочную версию. Полные резервные "
        "копии облачных порталов для развёртывания на своём сервере вендор больше не выдаёт.",
    )

    h2(pdf, "1. Что изменилось")
    body(
        pdf,
        "Раньше схема была простой: покупка коробочной лицензии → заявка в поддержку → "
        "получение бэкапа облака → развёртывание на сервере. Этот штатный сценарий закрыт.",
    )
    bullet(pdf, "Приём заявок на переезд остановлен с 1 сентября 2023 года.")
    bullet(pdf, "Выдача бэкапов облачных порталов завершилась 1 октября 2023 года.")
    bullet(
        pdf,
        "Это не запрет на использование коробки и не отзыв лицензий — отменена именно "
        "штатная услуга вендора по выдаче бэкапа для переезда.",
    )

    h2(pdf, "2. Почему вендор отказался от услуги")
    body(
        pdf,
        "Официальная позиция: облачный Битрикс24 стал настолько большим и технически "
        "сложным, что при переносе нельзя гарантировать полноценную работоспособность "
        "продукта «как есть».",
    )
    body(pdf, "По сути причина техническая:")
    bullet(
        pdf,
        "Ядра облака и коробки сильно разошлись. Полный бэкап содержит не только данные "
        "клиента, но и ядро продукта; копия облака на коробке давала ошибки и нестабильность.",
    )
    bullet(
        pdf,
        "Высокая доля индивидуальных доработок у клиентов усложняла поддержку переноса.",
    )
    bullet(pdf, "Рост нагрузки на поддержку при сохранении качества услуги стал нецелесообразным.")
    bullet(pdf, "Вендор усиливает фокус на развитии облачного направления.")

    h2(pdf, "3. Что это значит на практике")
    table(
        pdf,
        ["Было", "Стало"],
        [
            [
                "Переезд «одной кнопкой» через бэкап от Битрикс",
                "Штатного переезда нет",
            ],
            [
                "Поддержка вендора в процедуре",
                "Ответственность на клиенте / интеграторе",
            ],
            [
                "Почти полный перенос среды",
                "Перенос данных по частям (экспорт/импорт, REST API)",
            ],
        ],
    )
    body(
        pdf,
        "Переезд по-прежнему возможен, но как отдельный проект: выгрузка CRM, задач, "
        "пользователей, файлов и т.д. через экспорт и REST API либо силами партнёра-интегратора. "
        "Часть настроек (бизнес-процессы, роботы, пароли, часть истории) переносится не полностью "
        "или настраивается заново.",
    )

    h2(pdf, "4. Рекомендации")
    bullet(
        pdf,
        "Если нужен контроль данных, доработки ядра или требования ИБ — коробочная версия "
        "по-прежнему актуальна.",
    )
    bullet(
        pdf,
        "Переезд планировать как проект миграции (аудит → пилот → перенос → сверка), "
        "а не как «смену тарифа».",
    )
    bullet(
        pdf,
        "Для оценки объёма и рисков — провести аудит облачного портала с интегратором.",
    )

    h2(pdf, "Источники")
    body(
        pdf,
        "Официальные сообщения поддержки «1С-Битрикс» (форум разработчиков, сентябрь 2023); "
        "разъяснения партнёров и практика интеграторов после закрытия услуги.",
    )

    pdf.output(str(OUT))
    pdf.output(str(OUT_REPO))
    print(f"OK: {OUT}")
    print(f"OK: {OUT_REPO}")


if __name__ == "__main__":
    main()
