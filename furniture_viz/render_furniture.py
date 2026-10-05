#!/usr/bin/env python3
"""3D-визуализация мебели для бани: полки и комод с дверками."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Polygon
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

# Размеры в метрах
W = 1.29  # длина вдоль стены
H = 0.90  # высота
D_TOP = 0.30
D_BOT = 0.22
BOARD = 0.018  # толщина полок/панелей ~18 мм

OUT = Path(__file__).resolve().parent / "output"
OUT.mkdir(parents=True, exist_ok=True)

# Цвет липы (светлое дерево)
LINDEN = (0.82, 0.68, 0.48)
LINDEN_DARK = (0.72, 0.55, 0.38)
EDGE = (0.45, 0.32, 0.22)


def depth_at_y(y: float) -> float:
    """Глубина от задней стены до передней грани на высоте y (0 — пол)."""
    t = np.clip(y / H, 0.0, 1.0)
    return D_BOT + (D_TOP - D_BOT) * t


def tapered_corpus_faces(x0: float = 0.0, z0: float = 0.0) -> list:
    """Корпус 129×90 с глубиной 22→30 см."""
    y0 = 0.0
    d_bot = depth_at_y(y0)
    d_top = depth_at_y(H)
    p = [
        [x0, y0, z0],
        [x0 + W, y0, z0],
        [x0 + W, y0, z0 + d_bot],
        [x0, y0, z0 + d_bot],
        [x0, H, z0],
        [x0 + W, H, z0],
        [x0 + W, H, z0 + d_top],
        [x0, H, z0 + d_top],
    ]
    return [
        [p[0], p[1], p[2], p[3]],
        [p[4], p[5], p[6], p[7]],
        [p[3], p[2], p[6], p[7]],  # перед
        [p[0], p[1], p[5], p[4]],  # зад у стены
        [p[1], p[2], p[6], p[5]],  # право
        [p[0], p[3], p[7], p[4]],  # лево
    ]


def shelf_faces(y: float, thickness: float = BOARD) -> list:
    """Горизонтальная полка на высоте y."""
    d = depth_at_y(y)
    z_front = d - thickness  # полка не выступает за перед
    p = [
        [0, y, 0],
        [W, y, 0],
        [W, y, z_front],
        [0, y, z_front],
        [0, y + thickness, 0],
        [W, y + thickness, 0],
        [W, y + thickness, z_front + (depth_at_y(y + thickness) - d)],
    ]
    d2 = depth_at_y(y + thickness)
    p = [
        [0, y, 0],
        [W, y, 0],
        [W, y, d],
        [0, y, d],
        [0, y + thickness, 0],
        [W, y + thickness, 0],
        [W, y + thickness, d2],
        [0, y + thickness, d2],
    ]
    return [
        [p[0], p[1], p[2], p[3]],
        [p[4], p[5], p[6], p[7]],
        [p[0], p[1], p[5], p[4]],
        [p[2], p[3], p[7], p[6]],
        [p[1], p[2], p[6], p[5]],
        [p[0], p[3], p[7], p[4]],
    ]


def vertical_partition(x: float, thickness: float = BOARD) -> list:
    """Вертикальная перегородка (для дверей)."""
    p = [
        [x, 0, 0],
        [x + thickness, 0, 0],
        [x + thickness, 0, D_BOT],
        [x, 0, D_BOT],
        [x, H, 0],
        [x + thickness, H, 0],
        [x + thickness, H, D_TOP],
        [x, H, D_TOP],
    ]
    return [
        [p[0], p[1], p[2], p[3]],
        [p[4], p[5], p[6], p[7]],
        [p[0], p[1], p[5], p[4]],
        [p[2], p[3], p[7], p[6]],
        [p[1], p[2], p[6], p[5]],
        [p[0], p[3], p[7], p[4]],
    ]


def door_faces(x0: float, gap: float = 0.002) -> list:
    """Филёнчатая дверца (упрощённо — плоская панель с рамкой)."""
    dw = W / 2 - gap
    y0 = gap
    h = H - 2 * gap
    d = depth_at_y(H / 2) - BOARD
    inset = 0.04
    faces = []
    # рама
    for (xa, xb) in [(x0, x0 + dw)]:
        d_mid = depth_at_y(H / 2)
        z = d_mid - BOARD
        p = [
            [xa, y0, z],
            [xb, y0, z],
            [xb, y0 + h, z],
            [xa, y0 + h, z],
        ]
        faces.append(p)
    return faces


def add_faces(ax, face_list, color, alpha=1.0, edge=EDGE):
    poly = Poly3DCollection(face_list, alpha=alpha, linewidths=0.4, edgecolors=edge)
    poly.set_facecolor(color)
    ax.add_collection3d(poly)


def setup_ax(ax, title: str):
    ax.set_xlim(-0.05, W + 0.05)
    ax.set_ylim(-0.05, H + 0.05)
    ax.set_zlim(-0.05, D_TOP + 0.05)
    ax.set_xlabel("129 см →")
    ax.set_ylabel("90 см ↑")
    ax.set_zlabel("глубина →")
    ax.set_title(title, fontsize=11, pad=12)
    ax.view_init(elev=22, azim=-58)
    ax.set_box_aspect((W, H, D_TOP))


def draw_dimension_annotations(ax):
    """Подписи ключевых размеров."""
    ax.text(W / 2, -0.08, D_BOT / 2, "129 см", ha="center", fontsize=8)
    ax.text(-0.06, H / 2, D_TOP / 2, "90 см", ha="right", fontsize=8)
    ax.text(W + 0.02, 0.02, D_BOT, f"22 см", fontsize=7)
    ax.text(W + 0.02, H - 0.02, D_TOP, f"30 см", fontsize=7)


def render_shelves():
    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection="3d")

    side_faces = []
    # боковины
    for x_side, flip in [(0, 1), (W - BOARD, -1)]:
        pts = [
            [x_side, 0, 0],
            [x_side + BOARD, 0, 0],
            [x_side + BOARD, 0, D_BOT],
            [x_side, 0, D_BOT],
            [x_side, H, 0],
            [x_side + BOARD, H, 0],
            [x_side + BOARD, H, D_TOP],
            [x_side, H, D_TOP],
        ]
        side_faces.extend(
            [
                [pts[0], pts[1], pts[2], pts[3]],
                [pts[4], pts[5], pts[6], pts[7]],
                [pts[0], pts[1], pts[5], pts[4]],
                [pts[2], pts[3], pts[7], pts[6]],
                [pts[1], pts[2], pts[6], pts[5]],
                [pts[0], pts[3], pts[7], pts[4]],
            ]
        )

    add_faces(ax, tapered_corpus_faces(), LINDEN, alpha=0.15)
    add_faces(ax, side_faces, LINDEN_DARK)

    shelf_heights = [H * 0.32, H * 0.62]  # 2 полки + верх = 3 яруса
    for y in shelf_heights:
        add_faces(ax, shelf_faces(y), LINDEN)

    # верхняя крышка
    add_faces(ax, shelf_faces(H - BOARD), LINDEN_DARK)

    setup_ax(ax, "Вариант 1: открытые полки (2 полки, 3 яруса)\nлипа, 129×90 см, глубина 22→30 см")
    draw_dimension_annotations(ax)
    fig.tight_layout()
    path = OUT / "variant1_shelves_3d.png"
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def render_cabinet():
    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection="3d")

    # корпус — только бок и зад, перед открыт для дверей
    corpus = tapered_corpus_faces()
    add_faces(ax, [corpus[1], corpus[3], corpus[4], corpus[5]], LINDEN_DARK, alpha=0.95)
    add_faces(ax, [corpus[0]], LINDEN_DARK)

    # дно и внутренняя полка
    add_faces(ax, shelf_faces(BOARD), LINDEN)
    add_faces(ax, shelf_faces(H * 0.45), LINDEN)

    mid = W / 2
    add_faces(ax, vertical_partition(mid - BOARD / 2), LINDEN_DARK)

    # две дверцы
    for i, x0 in enumerate([0.003, mid + 0.003]):
        dw = W / 2 - 0.006
        d_z = depth_at_y(H / 2) - BOARD
        y0 = 0.003
        h = H - 0.006
        # рама двери
        frame_w = 0.045
        door_parts = []
        # внешний контур
        outer = [
            [x0, y0, d_z],
            [x0 + dw, y0, d_z],
            [x0 + dw, y0 + h, d_z],
            [x0, y0 + h, d_z],
        ]
        door_parts.append(outer)
        # имитация филёнки (внутренний прямоугольник темнее)
        inner = [
            [x0 + frame_w, y0 + frame_w, d_z + 0.002],
            [x0 + dw - frame_w, y0 + frame_w, d_z + 0.002],
            [x0 + dw - frame_w, y0 + h - frame_w, d_z + 0.002],
            [x0 + frame_w, y0 + h - frame_w, d_z + 0.002],
        ]
        add_faces(ax, [outer], LINDEN if i == 0 else (0.78, 0.64, 0.45))
        add_faces(ax, [inner], (0.75, 0.60, 0.42))

        # ручка
        hx = x0 + dw - 0.06
        hy = H / 2
        handle = [
            [hx, hy - 0.04, d_z + 0.015],
            [hx + 0.012, hy - 0.04, d_z + 0.015],
            [hx + 0.012, hy + 0.04, d_z + 0.015],
            [hx, hy + 0.04, d_z + 0.015],
        ]
        add_faces(ax, [handle], (0.55, 0.45, 0.35))

    setup_ax(ax, "Вариант 2: комод с двумя дверками\nлипа, 129×90 см, глубина 22→30 см")
    draw_dimension_annotations(ax)
    fig.tight_layout()
    path = OUT / "variant2_cabinet_doors_3d.png"
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return path


def render_side_section():
    """Вид сбоку — пояснение усечения глубины."""
    fig, ax = plt.subplots(figsize=(8, 4))
    wall_x = 0
    floor_y = 0
    # контур корпуса в разрезе
    poly = Polygon(
        [
            (wall_x, floor_y),
            (D_BOT, floor_y),
            (D_TOP, H),
            (wall_x, H),
        ],
        closed=True,
        facecolor=LINDEN,
        edgecolor=EDGE,
        linewidth=1.5,
    )
    ax.add_patch(poly)
    ax.annotate("", xy=(D_BOT, -0.06), xytext=(0, -0.06), arrowprops=dict(arrowstyle="<->"))
    ax.text(D_BOT / 2, -0.11, "22 см (низ)", ha="center", fontsize=9)
    ax.annotate("", xy=(D_TOP, H + 0.06), xytext=(0, H + 0.06), arrowprops=dict(arrowstyle="<->"))
    ax.text(D_TOP / 2, H + 0.11, "30 см (верх)", ha="center", fontsize=9)
    ax.annotate("", xy=(-0.08, 0), xytext=(-0.08, H), arrowprops=dict(arrowstyle="<->"))
    ax.text(-0.14, H / 2, "90 см", va="center", rotation=90, fontsize=9)
    ax.text(D_TOP + 0.05, H / 2, "наклонная\nзадняя стенка\n(полукруглая\nстена бани)", fontsize=8, va="center")
    ax.set_xlim(-0.2, 0.45)
    ax.set_ylim(-0.18, 1.05)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Разрез: глубина увеличивается кверху (22 → 30 см)", fontsize=11)
    path = OUT / "side_section_depth.png"
    fig.savefig(path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    return path


def export_simple_obj():
    """Экспорт корпуса в OBJ для CAD/SketchUp."""
    lines = ["# furniture tapered box", "o corpus"]
    d_bot, d_top = D_BOT, D_TOP
    verts = [
        (0, 0, 0),
        (W, 0, 0),
        (W, 0, d_bot),
        (0, 0, d_bot),
        (0, H, 0),
        (W, H, 0),
        (W, H, d_top),
        (0, H, d_top),
    ]
    for v in verts:
        lines.append(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}")
    faces = [
        "f 1 2 3 4",
        "f 5 6 7 8",
        "f 4 3 7 8",
        "f 1 2 6 5",
        "f 2 3 7 6",
        "f 1 4 8 5",
    ]
    lines.extend(faces)
    path = OUT / "corpus_tapered.obj"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def main():
    paths = [render_shelves(), render_cabinet(), render_side_section(), export_simple_obj()]
    print("Saved:")
    for p in paths:
        print(" ", p)


if __name__ == "__main__":
    main()
