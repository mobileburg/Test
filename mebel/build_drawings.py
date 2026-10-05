#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Чертежи мебели в нишу. Размеры — в константах ниже.

После правки:  python3 build_drawings.py
Печать:       chertezhi.pdf  или  drawings.html, А3 альбом, 100%, без полей.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent

# --- размеры со скрина, мм. Меняются здесь. ---
W = 1290          # длина вдоль стены
H = 900           # высота, чтобы не закрыть выключатель
D_TOP = 300       # глубина на верху
D_BOT = 220       # глубина у пола
T = 18            # принятая толщина щита
PROTRUSION = 40   # выступ за проём двери, уже входит в глубину

# Полки: низ на полу, средняя по центру, верх заподлицо.
# 18 + 423 + 18 + 423 + 18 = 900
OPENING = 423

# Тумба
DOOR_H = 800
DOOR_W = 643
DOOR_GAP = 4
PLINTH_H = 60
GAP = 2           # зазор над и под дверкой
CAP_T = T


def depth_at(y: float) -> float:
    """Глубина задней кромки габарита на высоте y от пола."""
    return D_BOT + (D_TOP - D_BOT) * y / H


def cut_depth(y_underside: float, front_inset: float = 0.0) -> int:
    """Прямоугольная деталь: глубина по нижней пласти, округление вниз."""
    return int(math.floor(depth_at(y_underside) - front_inset + 1e-9))


def shelf_layout():
    cursor = 0
    shelves = []
    segments = []
    for i in range(3):
        underside = cursor
        top = cursor + T
        shelves.append(
            {
                "top": top,
                "underside": underside,
                "depth": cut_depth(underside, 0),
                "name": ("нижняя", "средняя", "верхняя")[i],
            }
        )
        segments.append((underside, top, str(T)))
        cursor = top
        if i < 2:
            segments.append((cursor, cursor + OPENING, str(OPENING)))
            cursor += OPENING
    if cursor != H:
        raise SystemExit(f"Полки не сходятся в {H}: получилось {cursor}")
    return shelves, segments


SHELVES, SHELF_SEGMENTS = shelf_layout()
INNER_W = W - 2 * T

# Вариант 3: два разделителя на всю высоту, три отделения, шесть ячеек.
N_DIV = 2
N_BAYS = 3
CELL_W = (W - (2 + N_DIV) * T) // N_BAYS  # 406


def vertical_members():
    """Четыре вертикали слева направо: боковины и два разделителя."""
    members = []
    z = 0
    for i in range(N_BAYS + 1):
        members.append((z, z + T))
        z += T + (CELL_W if i < N_BAYS else 0)
    return members


def bay_spans():
    verts = vertical_members()
    return [(verts[i][1], verts[i + 1][0]) for i in range(N_BAYS)]


VERTICALS = vertical_members()
BAYS = bay_spans()

# Тумба: крышка накладная, дверки накладные, корпус утоплен на толщину дверки.
SIDE_H = H - CAP_T                     # 882
SIDE_D_BOT = D_BOT - T                 # 202
SIDE_D_TOP = cut_depth(SIDE_H, T)      # 280
BOTTOM_TOP = PLINTH_H + T              # 78
BOTTOM_D = cut_depth(BOTTOM_TOP - T, T)
SHELF_TOP = BOTTOM_TOP + OPENING_CABINET if False else None  # задаётся ниже

# Просвет внутри тумбы делится полкой поровну.
_clear = (SIDE_H - BOTTOM_TOP - T) // 2   # (882-78-18)//2 = 393
SHELF_UNDERSIDE = BOTTOM_TOP + _clear     # 471
SHELF_TOP = SHELF_UNDERSIDE + T           # 489
SHELF_D = cut_depth(SHELF_UNDERSIDE, T)
DOOR_Y0 = BOTTOM_TOP + GAP                # 80
DOOR_Y1 = DOOR_Y0 + DOOR_H                # 880


def _check():
    assert D_TOP - D_BOT == 80
    assert INNER_W == 1254
    assert 2 * DOOR_W + DOOR_GAP == W
    assert PLINTH_H + T + GAP + DOOR_H + GAP + CAP_T == H
    assert SIDE_H == 882 and SIDE_D_BOT == 202 and SIDE_D_TOP == 280
    assert [s["depth"] for s in SHELVES] == [220, 259, 298]
    assert [s["top"] for s in SHELVES] == [18, 459, 900]
    assert BOTTOM_D == 207 and SHELF_D == 243 and SHELF_TOP == 489
    assert DOOR_Y0 == 80 and DOOR_Y1 == 880
    assert SHELF_TOP + _clear == SIDE_H
    assert SHELF_UNDERSIDE - BOTTOM_TOP == _clear
    assert CELL_W == 406
    assert (2 + N_DIV) * T + N_BAYS * CELL_W == W
    assert VERTICALS == [(0, 18), (424, 442), (848, 866), (1272, 1290)]
    assert BAYS == [(18, 424), (442, 848), (866, 1272)]


_check()

FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
WOOD = "#f4e6cc"
WOOD2 = "#e8d3a8"
DOOR_C = "#ecdab4"
STROKE = "#241c16"
BLUE = "#1d4e89"

S = 1 / 6
FX = 40
FL = 174          # пол на листе; верх изделия на 174 - 150 = 24
SX = 276
TX = FX
TY = 208
FOOT = 266


class Sheet:
    def __init__(self, prefix: str):
        self.p = prefix
        self.els: list[str] = []

    def el(self, s: str) -> None:
        self.els.append(s)

    def line(self, x1, y1, x2, y2, sw=0.22, color=STROKE, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.el(
            f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
            f'stroke="{color}" stroke-width="{sw}" fill="none"{d}/>'
        )

    def rect(self, x, y, w, h, fill="none", sw=0.35, color=STROKE, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        stroke = color if sw else "none"
        self.el(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>'
        )

    def poly(self, pts, fill="none", sw=0.45, color=STROKE, dash=None):
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.el(
            f'<polygon points="{p}" fill="{fill}" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linejoin="miter"{d}/>'
        )

    def text(self, x, y, s, size=2.6, anchor="middle", weight="400",
             color="#1a1a1a", rotate=None, halo=False):
        t = (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        tr = f' transform="rotate({rotate:.1f} {x:.2f} {y:.2f})"' if rotate is not None else ""
        halo_a = ' stroke="#ffffff" stroke-width="0.75" paint-order="stroke fill"' if halo else ""
        base = ' dominant-baseline="middle"' if rotate is not None else ""
        self.el(
            f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" text-anchor="{anchor}" '
            f'font-weight="{weight}" fill="{color}" font-family="{FONT}"{base}{tr}{halo_a}>{t}</text>'
        )

    def _marker_line(self, x1, y1, x2, y2, blue=False):
        end = f"#{self.p}{'arrEb' if blue else 'arrE'}"
        start = f"#{self.p}{'arrSb' if blue else 'arrS'}"
        col = BLUE if blue else "#1b1b1b"
        self.el(
            f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
            f'stroke="{col}" stroke-width="0.16" marker-start="url({start})" marker-end="url({end})"/>'
        )

    def dim_h(self, x1, x2, y, text, obj_y=None, blue=False):
        if x2 < x1:
            x1, x2 = x2, x1
        col = BLUE if blue else "#3a342c"
        if obj_y is not None:
            direction = 1 if y > obj_y else -1
            for x in (x1, x2):
                self.line(x, obj_y + direction * 1.0, x, y + direction * 1.4, sw=0.12, color="#5c564e")
        gap = x2 - x1
        if gap >= 11:
            self._marker_line(x1, y, x2, y, blue)
            self.text((x1 + x2) / 2, y - 1.2, text, size=2.55, halo=True, color=col)
        else:
            end = f"#{self.p}{'arrEb' if blue else 'arrE'}"
            c = BLUE if blue else "#1b1b1b"
            self.el(
                f'<line x1="{x1 - 6:.2f}" y1="{y:.2f}" x2="{x1:.2f}" y2="{y:.2f}" '
                f'stroke="{c}" stroke-width="0.16" marker-end="url({end})"/>'
            )
            self.el(
                f'<line x1="{x2 + 6:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" '
                f'stroke="{c}" stroke-width="0.16" marker-end="url({end})"/>'
            )
            self.text((x1 + x2) / 2, y - 1.15, text, size=2.4, halo=True, color=col)

    def dim_v(self, y1, y2, x, text, obj_x=None):
        if y2 < y1:
            y1, y2 = y2, y1
        if obj_x is not None:
            direction = 1 if x > obj_x else -1
            for y in (y1, y2):
                self.line(obj_x + direction * 1.0, y, x + direction * 1.5, y, sw=0.12, color="#5c564e")
        gap = y2 - y1
        if gap >= 9:
            self._marker_line(x, y1, x, y2)
            self.text(x, (y1 + y2) / 2, text, size=2.55, halo=True, rotate=-90)
        else:
            # короткий размер: подпись сбоку, в сторону детали если размер слева
            if obj_x is None or x < obj_x:
                self.text(x + 1.3, (y1 + y2) / 2, text, size=2.3, halo=True, anchor="start")
            else:
                self.text(x - 1.3, (y1 + y2) / 2, text, size=2.3, halo=True, anchor="end")
            self.line(x - 1.1, y1, x + 1.1, y1, sw=0.12, color="#5c564e")
            self.line(x - 1.1, y2, x + 1.1, y2, sw=0.12, color="#5c564e")

    def svg(self) -> str:
        p = self.p
        arrow = (
            '<marker id="{id}" markerUnits="userSpaceOnUse" markerWidth="2.7" markerHeight="1.7" '
            'refX="{rx}" refY="0.85" orient="{orient}">'
            '<polygon points="0,0.12 2.55,0.85 0,1.58" fill="{fill}"/>'
            "</marker>"
        )
        defs = (
            arrow.format(id=f"{p}arrE", rx="2.45", orient="auto", fill="#1b1b1b")
            + arrow.format(id=f"{p}arrS", rx="2.45", orient="auto-start-reverse", fill="#1b1b1b")
            + arrow.format(id=f"{p}arrEb", rx="2.45", orient="auto", fill=BLUE)
            + arrow.format(id=f"{p}arrSb", rx="2.45", orient="auto-start-reverse", fill=BLUE)
        )
        body = "\n".join(self.els)
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" '
            f'viewBox="0 0 420 297" font-family="{FONT}">\n'
            f"<defs>{defs}</defs>\n"
            '<rect width="420" height="297" fill="#ffffff"/>\n'
            f"{body}\n</svg>\n"
        )


def fy(y: float) -> float:
    return FL - y * S


def fz(z: float) -> float:
    return FX + z * S


def sx(x: float) -> float:
    return SX + x * S


def sy(y: float) -> float:
    return FL - y * S


def tz(z: float) -> float:
    return TX + z * S


def td(depth: float) -> float:
    return TY + depth * S


def frame(sh: Sheet, title: str, sheet_no: int):
    sh.rect(8, 8, 404, 282, fill="#fff", sw=0.55, color="#222")
    sh.line(8, FOOT, 412, FOOT, sw=0.35)
    sh.line(268, FOOT, 268, 290, sw=0.2, color="#888")
    sh.line(348, FOOT, 348, 290, sw=0.2, color="#888")
    sh.text(12, FOOT + 6.2, title, size=3.5, anchor="start", weight="700")
    sh.text(12, FOOT + 11.2, "Чертёж для производства  ·  масштаб 1:6  ·  размеры в миллиметрах",
            size=2.25, anchor="start", color="#333")
    sh.text(12, FOOT + 16.0, "Первое приближение: заказчик уточняет размеры. Толщина щита 18 мм — принятая.",
            size=2.25, anchor="start", color="#333")
    sh.text(12, FOOT + 20.6, "Кромки шлифовать, без кромки ПВХ. Крепёж скрытый, шканты Ø8×30.",
            size=2.25, anchor="start", color="#333")
    sh.text(274, FOOT + 6.5, "Материал", size=2.1, anchor="start", color="#666")
    sh.text(274, FOOT + 11.4, "Щит липы", size=3.1, anchor="start", weight="700")
    sh.text(274, FOOT + 16.2, "масло, тон стены", size=2.25, anchor="start")
    sh.text(274, FOOT + 20.6, "образец до отделки", size=2.15, anchor="start", color="#555")
    sh.text(354, FOOT + 6.5, "Лист", size=2.1, anchor="start", color="#666")
    sh.text(354, FOOT + 12.0, f"{sheet_no}  /  3", size=3.3, anchor="start", weight="700")
    sh.text(354, FOOT + 17.2, "05.10.2026", size=2.4, anchor="start")
    sh.text(354, FOOT + 21.4, "рев. 0", size=2.15, anchor="start", color="#555")


def note_box(sh: Sheet, lines: list[str]) -> None:
    x, y, w = 350, 26, 56
    h = 8 + len(lines) * 3.55 + 3
    h = min(h, 168)
    sh.rect(x, y, w, h, fill="#f7f3ea", sw=0.25, color="#c2b59f")
    sh.rect(x + 3, y + 3, 7, 4.2, fill="#e0c48a", sw=0.2, color="#8d7040")
    sh.text(x + 12, y + 6.6, "липа", size=2.2, anchor="start", color="#5a4630")
    yy = y + 12
    for line in lines:
        if yy > y + h - 2:
            break
        if line.startswith("*"):
            sh.text(x + 3, yy, line[1:], size=2.35, anchor="start", weight="700")
        else:
            sh.text(x + 3, yy, line, size=2.2, anchor="start", color="#2c2822")
        yy += 3.55


def table(sh: Sheet, x, y, w, rows: list[tuple]) -> float:
    cols = [0, 11, 62, 76]
    head_h = 6.2
    row_h = 5.7
    total_h = head_h + row_h * len(rows)
    max_h = 258 - y
    if total_h > max_h:
        row_h = (max_h - head_h) / len(rows)
        total_h = head_h + row_h * len(rows)
    sh.rect(x, y, w, total_h, fill="#fff", sw=0.3, color="#333")
    sh.rect(x, y, w, head_h, fill="#f3eee3", sw=0, color="none")
    sh.line(x, y + head_h, x + w, y + head_h, sw=0.25, color="#333")
    for c in cols[1:]:
        sh.line(x + c, y, x + c, y + total_h, sw=0.15, color="#9a9186")
    for i in range(1, len(rows) + 1):
        sh.line(x, y + head_h + i * row_h, x + w, y + head_h + i * row_h, sw=0.12, color="#c8bfb2")
    headers = ("Поз.", "Наименование", "Кол.", "Размер, мм")
    for i, htxt in enumerate(headers):
        sh.text(x + cols[i] + 1.4, y + 4.3, htxt, size=2.15, anchor="start", weight="700")
    for r, row in enumerate(rows):
        yy = y + head_h + r * row_h + row_h * 0.7
        for i, cell in enumerate(row):
            sh.text(x + cols[i] + 1.4, yy, cell, size=2.15, anchor="start")
    return y + total_h


def common_notes():
    return [
        "*ГАБАРИТ",
        "1290 × 900 мм",
        "глубина верх 300",
        "глубина низ 220",
        "",
        "*ВЫСТУП 40 мм",
        "уже входит в 300",
        "и в 220. Отдельно",
        "не прибавлять.",
        "Синяя линия —",
        "проём двери.",
        "",
        "*СКОС",
        "D = 220+80·H/900",
        "H — от пола, мм.",
        "Прямая вместо",
        "полукруглой стены.",
        "Подгонка по месту.",
        "",
        "Верх не выше 900:",
        "не закрывать",
        "выключатель.",
    ]


def draw_side_profile_shelves(sh: Sheet, caption="Вид слева, боковина прозрачная"):
    pts = [(sx(x), sy(y)) for x, y in ((0, 0), (D_BOT, 0), (D_TOP, H), (0, H))]
    sh.poly(pts, fill=WOOD, sw=0.55)
    for s in SHELVES:
        poly = [
            (sx(0), sy(s["underside"])),
            (sx(s["depth"]), sy(s["underside"])),
            (sx(s["depth"]), sy(s["top"])),
            (sx(0), sy(s["top"])),
        ]
        sh.poly(poly, fill=WOOD2, sw=0.3)
    sh.poly(pts, fill="none", sw=0.55)
    # выступ проёма
    sh.line(sx(PROTRUSION), sy(0), sx(PROTRUSION), sy(H), sw=0.25, color=BLUE, dash="1.8,1.1")
    sh.dim_h(sx(0), sx(PROTRUSION), sy(120), "40", blue=True)
    sh.text(sx(PROTRUSION) + 1.5, sy(150), "проём", size=2.15, anchor="start", color=BLUE, rotate=-90)
    # габариты глубины
    sh.dim_h(sx(0), sx(D_TOP), sy(H) - 7, "300", obj_y=sy(H))
    sh.dim_h(sx(0), sx(D_BOT), FL + 8, "220", obj_y=FL)
    sh.dim_v(sy(H), sy(0), sx(D_TOP) + 12, "900", obj_x=sx(D_TOP))
    # глубина каждой полки — подпись у задней кромки
    for s in SHELVES:
        sh.text(sx(s["depth"]) + 1.4, sy((s["top"] + s["underside"]) / 2),
                str(s["depth"]), size=2.2, anchor="start", halo=True, color="#3a3128")
    sh.text(sx(8), sy(70), "перед", size=2.1, anchor="start", color="#7a7268")
    sh.text(sx(D_BOT) - 1, sy(40), "зад", size=2.1, anchor="end", color="#7a7268")
    sh.text((sx(0) + sx(D_TOP)) / 2, FL + 16, caption,
            size=2.2, anchor="middle", color="#444")


def draw_front_shelves(sh: Sheet):
    sh.text(FX, 16, "Вид спереди", size=2.8, anchor="start", weight="700")
    # боковины и полки
    for z0 in (0, W - T):
        sh.rect(fz(z0), fy(H), T * S, H * S, fill=WOOD, sw=0.4)
    for s in SHELVES:
        sh.rect(fz(T), fy(s["top"]), INNER_W * S, T * S, fill=WOOD2, sw=0.32)
    # цепочка высот и габарит
    for y0, y1, label in SHELF_SEGMENTS:
        sh.dim_v(fy(y1), fy(y0), FX - 12, label, obj_x=FX)
    sh.dim_v(fy(H), fy(0), FX - 24, "900", obj_x=FX)
    sh.dim_h(fz(0), fz(W), FL + 9, "1290", obj_y=FL)
    sh.text(fz(W / 2), fy(250), "просвет 423", size=2.3, color="#555", halo=True)
    sh.text(fz(W / 2), fy(680), "просвет 423", size=2.3, color="#555", halo=True)


def draw_top_shelves(sh: Sheet):
    sh.text(TX, TY - 3.2, "Вид сверху  ·  перед сверху", size=2.5, anchor="start", weight="700")
    # боковины на всю глубину верха, полки короче
    sh.rect(tz(0), td(0), T * S, D_TOP * S, fill=WOOD, sw=0.3)
    sh.rect(tz(W - T), td(0), T * S, D_TOP * S, fill=WOOD, sw=0.3)
    top = SHELVES[-1]
    sh.rect(tz(T), td(0), INNER_W * S, top["depth"] * S, fill=WOOD2, sw=0.3)
    for s in SHELVES[:-1]:
        sh.line(tz(T), td(s["depth"]), tz(W - T), td(s["depth"]), sw=0.2, color="#6a6258", dash="1.6,1")
        sh.text(tz(W - T) - 1.5, td(s["depth"]) - 0.8, str(s["depth"]),
                size=2.1, anchor="end", color="#4a433c", halo=True)
    sh.line(tz(0), td(PROTRUSION), tz(W), td(PROTRUSION), sw=0.25, color=BLUE, dash="1.8,1.1")
    sh.text(tz(8), td(PROTRUSION) + 3.1, "40 — проём двери", size=2.15, anchor="start", color=BLUE)
    sh.dim_v(td(0), td(D_TOP), TX - 24, "300", obj_x=TX)
    sh.text(tz(4), td(6), "перед", size=2.0, anchor="start", color="#7a7268")
    sh.text(tz(4), td(D_TOP) - 1.5, "зад", size=2.0, anchor="start", color="#7a7268")


def shelf_rows():
    rows = [("1", "Боковина, трапеция", "2", f"900 × 220…300 × {T}")]
    labels = ("Полка нижняя", "Полка средняя", "Полка верхняя")
    for i, s in enumerate(SHELVES):
        rows.append((str(i + 2), f"{labels[i]}, верх {s['top']}", "1",
                     f"{INNER_W} × {s['depth']} × {T}"))
    return rows


def sheet_shelves() -> Sheet:
    sh = Sheet("a")
    frame(sh, "ВАРИАНТ 1  ·  СТЕЛЛАЖ, 3 ПОЛКИ", 1)
    draw_front_shelves(sh)
    draw_side_profile_shelves(sh)
    draw_top_shelves(sh)
    note_box(sh, common_notes() + [
        "",
        "*ПОЛКИ",
        "3 шт: низ на полу,",
        "середина, верх.",
        "Просветы по 423.",
        "Глубина полки —",
        "по нижней пласти.",
        "Пролёт 1254 мм:",
        "щит 18 может",
        "провиснуть, тогда",
        "стойка посередине",
        "или щит 20 мм.",
    ])
    y = table(sh, SX, 198, 130, shelf_rows())
    sh.text(SX, min(y + 4.2, 262), "Контроль задней кромки боковины ≈ 904 мм.",
            size=2.15, anchor="start", color="#444")
    return sh


def draw_front_cabinet(sh: Sheet):
    sh.text(FX, 16, "Вид спереди", size=2.8, anchor="start", weight="700")
    # цоколь и кромка дна
    sh.rect(fz(0), fy(H), W * S, H * S, fill=WOOD, sw=0.45)
    sh.line(fz(0), fy(PLINTH_H), fz(W), fy(PLINTH_H), sw=0.25)
    sh.line(fz(0), fy(BOTTOM_TOP), fz(W), fy(BOTTOM_TOP), sw=0.2, color="#5c5348")
    # дверки
    sh.rect(fz(0), fy(DOOR_Y1), DOOR_W * S, DOOR_H * S, fill=DOOR_C, sw=0.4)
    sh.rect(fz(DOOR_W + DOOR_GAP), fy(DOOR_Y1), DOOR_W * S, DOOR_H * S, fill=DOOR_C, sw=0.4)
    # направление открывания: петли снаружи
    sh.line(fz(0), fy(DOOR_Y1), fz(DOOR_W), fy(DOOR_Y0), sw=0.12, color="#8a8174")
    sh.line(fz(W), fy(DOOR_Y1), fz(DOOR_W + DOOR_GAP), fy(DOOR_Y0), sw=0.12, color="#8a8174")
    # полка скрытая
    sh.line(fz(T), fy(SHELF_TOP), fz(W - T), fy(SHELF_TOP), sw=0.18, color="#5c564e", dash="1.8,1.1")
    sh.text(fz(W - 280), fy(SHELF_TOP + 28), f"полка, верх {SHELF_TOP}", size=2.2,
            anchor="start", color="#333", halo=True)
    # крышка — полоса сверху уже есть как контур; линия низа крышки
    sh.line(fz(0), fy(SIDE_H), fz(W), fy(SIDE_H), sw=0.3)
    sh.text(fz(W) - 3, fy(H) - 2.2, "крышка 18", size=2.2, anchor="end", halo=True)
    # размеры
    sh.dim_v(fy(0), fy(DOOR_Y0), FX - 12, str(DOOR_Y0), obj_x=FX)
    sh.dim_v(fy(DOOR_Y0), fy(DOOR_Y1), FX - 12, str(DOOR_H), obj_x=FX)
    sh.dim_v(fy(DOOR_Y1), fy(H), FX - 12, str(H - DOOR_Y1), obj_x=FX)
    sh.dim_v(fy(H), fy(0), FX - 24, "900", obj_x=FX)
    sh.dim_h(fz(0), fz(DOOR_W), FL + 8, str(DOOR_W), obj_y=FL)
    sh.dim_h(fz(DOOR_W + DOOR_GAP), fz(W), FL + 8, str(DOOR_W), obj_y=FL)
    sh.dim_h(fz(0), fz(W), FL + 17, "1290", obj_y=FL)
    sh.text(fz(W / 2), fy(DOOR_Y1 - 36), "зазор 4", size=2.15, color="#333", halo=True)
    sh.text(fz(24), fy(PLINTH_H / 2), "цоколь", size=2.1, anchor="start", color="#666")


def draw_side_cabinet(sh: Sheet):
    # габаритная огибающая — тонкая синяя
    env = [(sx(x), sy(y)) for x, y in ((0, 0), (D_BOT, 0), (D_TOP, H), (0, H))]
    sh.poly(env, fill="none", sw=0.22, color=BLUE, dash="1.4,0.9")
    side = [
        (sx(T), sy(0)),
        (sx(D_BOT), sy(0)),
        (sx(T + SIDE_D_TOP), sy(SIDE_H)),
        (sx(T), sy(SIDE_H)),
    ]
    sh.poly(side, fill=WOOD, sw=0.45)
    cap = [(sx(x), sy(y)) for x, y in ((0, SIDE_H), (D_TOP, SIDE_H), (D_TOP, H), (0, H))]
    sh.poly(cap, fill=WOOD2, sw=0.4)
    door = [(sx(x), sy(y)) for x, y in ((0, DOOR_Y0), (T, DOOR_Y0), (T, DOOR_Y1), (0, DOOR_Y1))]
    sh.poly(door, fill=DOOR_C, sw=0.4)
    # дно и полка — скрытые
    def hidden_rect(x0, x1, y0, y1):
        sh.poly([(sx(x0), sy(y0)), (sx(x1), sy(y0)), (sx(x1), sy(y1)), (sx(x0), sy(y1))],
                fill="none", sw=0.2, color="#5c564e", dash="1.5,1")

    hidden_rect(T, T + BOTTOM_D, BOTTOM_TOP - T, BOTTOM_TOP)
    hidden_rect(T, T + SHELF_D, SHELF_UNDERSIDE, SHELF_TOP)
    sh.line(sx(PROTRUSION), sy(30), sx(PROTRUSION), sy(H - 20), sw=0.22, color=BLUE, dash="1.6,1")
    sh.text(sx(PROTRUSION) + 1.2, sy(200), "проём", size=2.1, anchor="start", color=BLUE, rotate=-90)
    sh.dim_h(sx(0), sx(D_TOP), sy(H) - 7, "300", obj_y=sy(H))
    sh.dim_h(sx(0), sx(D_BOT), FL + 8, "220", obj_y=FL)
    sh.text(sx(T / 2), sy(DOOR_Y0 + 40), "18", size=2.1, anchor="middle", color="#333", halo=True)
    sh.text((sx(0) + sx(D_TOP)) / 2, FL + 16, "Вид слева", size=2.2, anchor="middle", color="#444")
    sh.text(sx(90), sy(SHELF_TOP + 40), f"полка {SHELF_D}", size=2.15, anchor="start", color="#444", halo=True)


def draw_top_cabinet(sh: Sheet):
    sh.text(TX, TY - 3.2, "Вид сверху  ·  перед сверху, по крышке", size=2.5, anchor="start", weight="700")
    sh.rect(tz(0), td(0), W * S, D_TOP * S, fill=WOOD2, sw=0.4)
    sh.line(tz(T), td(T), tz(T), td(D_TOP), sw=0.18, color="#6a6258", dash="1.4,1")
    sh.line(tz(W - T), td(T), tz(W - T), td(D_TOP), sw=0.18, color="#6a6258", dash="1.4,1")
    sh.line(tz(T), td(T + SHELF_D), tz(W - T), td(T + SHELF_D), sw=0.18, color="#6a6258", dash="1.5,1")
    sh.text(tz(W - 8), td(T + SHELF_D) - 1.2, "полка", size=2.05, anchor="end", halo=True)
    sh.line(tz(0), td(PROTRUSION), tz(W), td(PROTRUSION), sw=0.25, color=BLUE, dash="1.8,1.1")
    sh.text(tz(8), td(PROTRUSION) + 3.1, "40 — проём двери", size=2.15, anchor="start", color=BLUE)
    sh.dim_v(td(0), td(D_TOP), TX - 24, "300", obj_x=TX)
    sh.text(tz(4), td(5), "перед", size=2.0, anchor="start", color="#7a7268")


def cabinet_rows():
    return [
        ("1", "Боковина, трапеция", "2", f"{SIDE_H} × {SIDE_D_BOT}…{SIDE_D_TOP} × {T}"),
        ("2", "Крышка накладная", "1", f"{W} × {D_TOP} × {T}"),
        ("3", f"Дно, верх {BOTTOM_TOP}", "1", f"{INNER_W} × {BOTTOM_D} × {T}"),
        ("4", f"Полка, верх {SHELF_TOP}", "1", f"{INNER_W} × {SHELF_D} × {T}"),
        ("5", "Дверка накладная", "2", f"{DOOR_W} × {DOOR_H} × {T}"),
        ("6", "Цоколь", "1", f"{INNER_W} × {PLINTH_H} × {T}"),
        ("7", "Петля Ø35, 110°", "4", "вкладка 100 мм"),
    ]


def sheet_cabinet() -> Sheet:
    sh = Sheet("b")
    frame(sh, "ВАРИАНТ 2  ·  ТУМБА С ДВЕРКАМИ", 2)
    draw_front_cabinet(sh)
    draw_side_cabinet(sh)
    draw_top_cabinet(sh)
    note_box(sh, common_notes() + [
        "",
        "*ДВЕРКИ",
        "Накладные, закрывают",
        "торцы боковин.",
        "Зазор между ними 4.",
        "Зазоры сверху",
        "и снизу по 2 мм.",
        "20 сверху =",
        "зазор 2 + крышка 18.",
        "Петли по 2 шт,",
        "100 мм от торцов.",
        "Ручки не сверлить.",
        "Цоколь утоплен",
        "на 18 мм.",
        "Полка по центру,",
        "просветы по 393.",
    ])
    y = table(sh, SX, 198, 130, cabinet_rows())
    sh.text(SX, min(y + 4.2, 262), "Корпус утоплен на 18 мм: глубины деталей уже с этим вычетом.",
            size=2.1, anchor="start", color="#444")
    return sh


def draw_front_cells(sh: Sheet):
    sh.text(FX, 16, "Вид спереди", size=2.8, anchor="start", weight="700")
    for z0, z1 in VERTICALS:
        sh.rect(fz(z0), fy(H), (z1 - z0) * S, H * S, fill=WOOD, sw=0.4)
    for s in SHELVES:
        for a, b in BAYS:
            sh.rect(fz(a), fy(s["top"]), (b - a) * S, T * S, fill=WOOD2, sw=0.32)
    for y0, y1, label in SHELF_SEGMENTS:
        sh.dim_v(fy(y1), fy(y0), FX - 12, label, obj_x=FX)
    sh.dim_v(fy(H), fy(0), FX - 24, "900", obj_x=FX)
    for a, b in BAYS:
        sh.dim_h(fz(a), fz(b), FL + 8, str(CELL_W), obj_y=FL)
    sh.dim_h(fz(0), fz(W), FL + 17, "1290", obj_y=FL)
    for z0, z1 in VERTICALS:
        sh.text(fz((z0 + z1) / 2), FL + 3.8, "18", size=2.0, anchor="middle", halo=True, rotate=-90)
    mid = (BAYS[1][0] + BAYS[1][1]) / 2
    sh.text(fz(mid), fy(230), "просвет 423", size=2.15, color="#555", halo=True)
    sh.text(fz(mid), fy(670), "просвет 423", size=2.15, color="#555", halo=True)


def draw_top_cells(sh: Sheet):
    sh.text(TX, TY - 3.2, "Вид сверху  ·  перед сверху", size=2.5, anchor="start", weight="700")
    for z0, z1 in VERTICALS:
        sh.rect(tz(z0), td(0), (z1 - z0) * S, D_TOP * S, fill=WOOD, sw=0.3)
    top = SHELVES[-1]
    for a, b in BAYS:
        sh.rect(tz(a), td(0), (b - a) * S, top["depth"] * S, fill=WOOD2, sw=0.3)
    for s in SHELVES[:-1]:
        for a, b in BAYS:
            sh.line(tz(a), td(s["depth"]), tz(b), td(s["depth"]), sw=0.2, color="#6a6258", dash="1.6,1")
        sh.text(tz(BAYS[-1][1]) - 1.2, td(s["depth"]) - 0.8, str(s["depth"]),
                size=2.1, anchor="end", color="#4a433c", halo=True)
    sh.line(tz(0), td(PROTRUSION), tz(W), td(PROTRUSION), sw=0.25, color=BLUE, dash="1.8,1.1")
    sh.text(tz(8), td(PROTRUSION) + 3.1, "40 — проём двери", size=2.15, anchor="start", color=BLUE)
    sh.dim_v(td(0), td(D_TOP), TX - 24, "300", obj_x=TX)
    sh.text(tz(4), td(6), "перед", size=2.0, anchor="start", color="#7a7268")
    sh.text(tz(4), td(D_TOP) - 1.5, "зад", size=2.0, anchor="start", color="#7a7268")


def cell_rows():
    rows = [
        ("1", "Боковина, трапеция", "2", f"900 × 220…300 × {T}"),
        ("2", "Разделитель, трапеция", "2", f"900 × 220…300 × {T}"),
    ]
    labels = ("Полка нижняя", "Полка средняя", "Полка верхняя")
    for i, s in enumerate(SHELVES):
        rows.append((str(i + 3), f"{labels[i]}, верх {s['top']}", str(N_BAYS),
                     f"{CELL_W} × {s['depth']} × {T}"))
    return rows


def sheet_cells() -> Sheet:
    sh = Sheet("c")
    frame(sh, "ВАРИАНТ 3  ·  ПОЛКИ, 6 ЯЧЕЕК", 3)
    draw_front_cells(sh)
    draw_side_profile_shelves(sh, "Вид слева: боковина и разделители")
    draw_top_cells(sh)
    note_box(sh, common_notes() + [
        "",
        "*6 ЯЧЕЕК",
        "Два ряда, три",
        "отделения. Без",
        "дверок.",
        "Разделители — 2 шт",
        "на всю высоту,",
        "тот же скос,",
        "что у боковин.",
        "Полки вкладные:",
        "406 мм, по 3 шт",
        "на каждый ярус.",
        "Просветы по 423.",
    ])
    y = table(sh, SX, 198, 130, cell_rows())
    sh.text(SX, min(y + 4.2, 262), "Разделители пилить по тому же скосу, что и боковины.",
            size=2.15, anchor="start", color="#444")
    return sh


def write_svg(name: str, sh: Sheet) -> None:
    (OUT / name).write_text(sh.svg(), encoding="utf-8")


def write_html() -> None:
    parts = []
    for name in ("variant-1-stellazh.svg", "variant-2-tumba.svg", "variant-3-yacheiki.svg"):
        svg = (OUT / name).read_text(encoding="utf-8")
        svg = svg.split("?>", 1)[-1].strip()
        parts.append(f'<section class="sheet">{svg}</section>')
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Чертежи — мебель из липы</title>
<style>
  @page {{ size: A3 landscape; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: #d9d3c8; }}
  .hint {{
    font-family: "DejaVu Sans", "Liberation Sans", sans-serif;
    padding: 14px 18px; color: #2c2822; font-size: 14px;
  }}
  .sheet {{ width: 420mm; height: 297mm; background: #fff; margin: 0 auto 16px; }}
  .sheet svg {{ width: 420mm; height: 297mm; display: block; }}
  @media print {{
    .hint {{ display: none; }}
    body {{ background: #fff; }}
    .sheet {{ margin: 0; page-break-after: always; }}
  }}
</style>
</head>
<body>
<p class="hint">Печать: А3, альбомная, масштаб 100%, поля «нет». Либо откройте chertezhi.pdf.</p>
{''.join(parts)}
</body>
</html>
"""
    (OUT / "drawings.html").write_text(html, encoding="utf-8")


ROLE_COLOR = {
    "side": [212, 182, 128],
    "shelf": [228, 200, 148],
    "top": [232, 206, 156],
    "door": [218, 188, 134],
    "plinth": [198, 166, 114],
    "bottom": [208, 176, 122],
}


def box(name, x0, x1, y0, y1, z0, z1, role, grain, skip=None):
    return {
        "type": "box", "name": name,
        "x0": x0, "x1": x1, "y0": y0, "y1": y1, "z0": z0, "z1": z1,
        "color": ROLE_COLOR[role], "grain": grain, "gscale": 0.16,
        "skip": skip or [],
    }


def prism(name, profile, z0, z1, role, grain, skip_edges=None):
    return {
        "type": "prism", "name": name, "profile": profile,
        "z0": z0, "z1": z1, "color": ROLE_COLOR[role],
        "grain": grain, "gscale": 0.18, "skipEdges": skip_edges or [],
    }


def build_model() -> dict:
    shelves_parts = [
        prism("Боковина левая", [[0, 0], [D_BOT, 0], [D_TOP, H], [0, H]], 0, T, "side", "y", [0]),
        prism("Боковина правая", [[0, 0], [D_BOT, 0], [D_TOP, H], [0, H]], W - T, W, "side", "y", [0]),
    ]
    for s in SHELVES:
        skip = ["nz", "pz"] + (["ny"] if s["underside"] == 0 else [])
        shelves_parts.append(
            box(f"Полка {s['name']}", 0, s["depth"], s["underside"], s["top"], T, W - T,
                "top" if s["top"] == H else "shelf", "z", skip)
        )
    cab_profile = [[T, 0], [D_BOT, 0], [T + SIDE_D_TOP, SIDE_H], [T, SIDE_H]]
    cabinet_parts = [
        prism("Боковина левая", cab_profile, 0, T, "side", "y", [0, 2]),
        prism("Боковина правая", cab_profile, W - T, W, "side", "y", [0, 2]),
        box("Крышка", 0, D_TOP, SIDE_H, H, 0, W, "top", "z", ["ny"]),
        box("Дно", T, T + BOTTOM_D, BOTTOM_TOP - T, BOTTOM_TOP, T, W - T, "bottom", "z", ["ny", "nz", "pz"]),
        box("Полка", T, T + SHELF_D, SHELF_UNDERSIDE, SHELF_TOP, T, W - T, "shelf", "z", ["nz", "pz"]),
        box("Цоколь", T, T + T, 0, PLINTH_H, T, W - T, "plinth", "z", ["ny", "py"]),
        box("Дверка левая", 0, T - 0.6, DOOR_Y0, DOOR_Y1, 0, DOOR_W, "door", "z"),
        box("Дверка правая", 0, T - 0.6, DOOR_Y0, DOOR_Y1, DOOR_W + DOOR_GAP, W, "door", "z"),
    ]
    profile = [[0, 0], [D_BOT, 0], [D_TOP, H], [0, H]]
    names = ("Боковина левая", "Разделитель левый", "Разделитель правый", "Боковина правая")
    cells_parts = [
        prism(names[i], profile, z0, z1, "side", "y", [0])
        for i, (z0, z1) in enumerate(VERTICALS)
    ]
    for s in SHELVES:
        skip = ["nz", "pz"] + (["ny"] if s["underside"] == 0 else [])
        role = "top" if s["top"] == H else "shelf"
        for n, (a, b) in enumerate(BAYS, start=1):
            cells_parts.append(
                box(f"Полка {s['name']} {n}", 0, s["depth"], s["underside"], s["top"], a, b,
                    role, "z", skip)
            )
    warnings = [
        "Глубина 300 мм сверху и 220 мм снизу уже включает выступ 40 мм за проём двери.",
        "Скос прямой — первое приближение полукруглой стены. Окончательно подогнать по месту.",
        "Толщина щита 18 мм принята для этого чертежа, её можно заменить.",
        "Высота 900 мм выбрана так, чтобы не перекрыть выключатель.",
    ]
    return {
        "meta": {
            "W": W, "H": H, "Dtop": D_TOP, "Dbot": D_BOT, "T": T,
            "protrusion": PROTRUSION, "warnings": warnings,
        },
        "shelves": {
            "id": "shelves",
            "title": "Полки",
            "subtitle": "Открытый стеллаж, три полки",
            "blurb": "Нижняя полка на полу, средняя по центру, верхняя заподлицо с боковинами. Два просвета по 423 мм.",
            "cutlist": [{"pos": a, "name": b, "qty": c, "size": d} for a, b, c, d in shelf_rows()],
            "parts": shelves_parts,
        },
        "cabinet": {
            "id": "cabinet",
            "title": "Тумба с дверками",
            "subtitle": "Две накладные дверки и полка внутри",
            "blurb": "Дверки закрывают торцы. Цоколь утоплен на 18 мм. Полка по центру проёма, просветы по 393 мм. Ручки на чертеже не сверлятся.",
            "cutlist": [{"pos": a, "name": b, "qty": c, "size": d} for a, b, c, d in cabinet_rows()],
            "parts": cabinet_parts,
        },
        "cells": {
            "id": "cells",
            "title": "Шесть ячеек",
            "subtitle": "Три отделения, без дверок",
            "blurb": "Те же три полки, что в открытом стеллаже, плюс два вертикальных разделителя. Получается два ряда по три ячейки. Полки вкладные, просвет отделения 406 мм. Дверок нет.",
            "cutlist": [{"pos": a, "name": b, "qty": c, "size": d} for a, b, c, d in cell_rows()],
            "parts": cells_parts,
        },
    }


def write_model(model: dict) -> None:
    (OUT / "model.js").write_text(
        "window.MODEL = " + json.dumps(model, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def write_csv(model: dict) -> None:
    lines = ["\ufeffВариант;Поз.;Наименование;Кол.;Размер, мм"]
    for key in ("shelves", "cabinet", "cells"):
        title = model[key]["title"]
        for row in model[key]["cutlist"]:
            lines.append(f"{title};{row['pos']};{row['name']};{row['qty']};{row['size']}")
    (OUT / "specifikaciya.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    write_svg("variant-1-stellazh.svg", sheet_shelves())
    write_svg("variant-2-tumba.svg", sheet_cabinet())
    write_svg("variant-3-yacheiki.svg", sheet_cells())
    write_html()
    model = build_model()
    write_model(model)
    write_csv(model)
    print("полки:", [(s["name"], s["top"], s["depth"]) for s in SHELVES])
    print("тумба: боковина", SIDE_H, SIDE_D_BOT, SIDE_D_TOP, "дно", BOTTOM_D, "полка", SHELF_TOP, SHELF_D)
    print("ok", OUT)


if __name__ == "__main__":
    main()
