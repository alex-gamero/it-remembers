"""Generates every sprite for It Remembers.

Run from the repo root:  python tools/make_sprites.py
Needs Pillow:            pip install pillow
Output goes to public/assets/.
"""
import math
import os
import random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets")
os.makedirs(OUT, exist_ok=True)

# Phase 1 is grey + red. Phase 2 is the same room drowned in red.
PHASES = {
    "p1": dict(ramp=["#000000", "#141414", "#2e2e2e", "#8c8c8c", "#ffffff"], acc="#ff2b3d", accd="#5c0a14"),
    "p2": dict(ramp=["#080305", "#1a080d", "#381019", "#9a3346", "#f6eded"], acc="#ff1f4b", accd="#62091c"),
}

ROOM_W, ROOM_H = 512, 352
CLEAR = (0, 0, 0, 0)


def save(image, name):
    image.save(os.path.join(OUT, name))
    print("wrote", name, image.size)


def add_outline(image, color):
    """Adds a 1px outline around every opaque pixel."""
    source = image.load()
    result = image.copy()
    target = result.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            if source[x, y][3] != 0:
                continue
            for near_x, near_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= near_x < width and 0 <= near_y < height and source[near_x, near_y][3] != 0:
                    target[x, y] = color
                    break
    return result


def paint_rows(image, rows, left, top, colors):
    pixels = image.load()
    for row_index, row in enumerate(rows):
        for column_index, letter in enumerate(row):
            if letter in colors:
                x, y = left + column_index, top + row_index
                if 0 <= x < image.width and 0 <= y < image.height:
                    pixels[x, y] = colors[letter]


# ---------------------------------------------------------------- room
def make_room(phase_name):
    phase = PHASES[phase_name]
    ramp, accent, accent_dark = phase["ramp"], phase["acc"], phase["accd"]
    corrupted = phase_name == "p2"
    image = Image.new("RGB", (ROOM_W, ROOM_H), ramp[0])
    draw = ImageDraw.Draw(image)
    rng = random.Random(7)

    # floor: circuit board tiles
    for tile_y in range(40, ROOM_H - 8, 16):
        for tile_x in range(8, ROOM_W - 8, 16):
            draw.rectangle([tile_x, tile_y, tile_x + 15, tile_y + 15], fill=ramp[1])
            draw.line([(tile_x, tile_y), (tile_x + 15, tile_y)], fill=ramp[0])
            draw.line([(tile_x, tile_y), (tile_x, tile_y + 15)], fill=ramp[0])
            roll = rng.random()
            if roll < 0.25:
                trace_y = tile_y + rng.randint(4, 11)
                trace_color = accent_dark if corrupted and rng.random() < 0.5 else ramp[2]
                draw.line([(tile_x + 2, trace_y), (tile_x + 9, trace_y), (tile_x + 12, trace_y - 3)], fill=trace_color)
                draw.rectangle([tile_x + 12, trace_y - 4, tile_x + 13, trace_y - 3], fill=trace_color)
            elif roll < (0.5 if corrupted else 0.36):
                draw.line([(tile_x + 4, tile_y + 3), (tile_x + 7, tile_y + 7), (tile_x + 6, tile_y + 11)], fill=ramp[0])

    # faint arena ring in the middle of the floor
    center_x, center_y = ROOM_W // 2, 196
    for step in range(0, 360, 4):
        if (step // 4) % 3 == 2:
            continue
        angle = math.radians(step)
        draw.point((center_x + math.cos(angle) * 150, center_y + math.sin(angle) * 96), fill=ramp[2])
        draw.point((center_x + math.cos(angle) * 146, center_y + math.sin(angle) * 92), fill=ramp[2])

    # back wall
    draw.rectangle([0, 0, ROOM_W, 9], fill=ramp[0])
    draw.rectangle([8, 10, ROOM_W - 9, 39], fill=ramp[2])
    for panel_x in range(8, ROOM_W - 8, 24):
        draw.line([(panel_x, 10), (panel_x, 39)], fill=ramp[1])
        draw.rectangle([panel_x + 6, 15, panel_x + 17, 17], fill=ramp[1])
        draw.rectangle([panel_x + 6, 30, panel_x + 17, 31], fill=ramp[1])
    draw.line([(8, 39), (ROOM_W - 9, 39)], fill=ramp[3])

    # wall screens
    for screen_x in (168, 316):
        draw.rectangle([screen_x, 12, screen_x + 28, 30], fill=ramp[0], outline=ramp[3])
        draw.rectangle([screen_x + 2, 14, screen_x + 26, 28], fill=accent_dark)
        if corrupted:
            for line_y in (17, 21, 25):
                draw.line([(screen_x + 4, line_y), (screen_x + 4 + rng.randint(8, 20), line_y)], fill=accent)
        else:
            draw.rectangle([screen_x + 8, 18, screen_x + 12, 22], fill=accent)
            draw.rectangle([screen_x + 16, 18, screen_x + 20, 22], fill=accent)
            draw.line([(screen_x + 8, 25), (screen_x + 20, 25)], fill=accent)

    # server racks
    rack_positions = (24, 52, 112, 380, 440, 468)
    for rack_x in rack_positions:
        draw.rectangle([rack_x, 2, rack_x + 20, 42], fill=ramp[1], outline=ramp[0])
        for shelf_y in range(5, 40, 5):
            draw.line([(rack_x + 3, shelf_y + 2), (rack_x + 17, shelf_y + 2)], fill=ramp[0])
            light = accent if rng.random() < (0.7 if corrupted else 0.35) else ramp[3]
            draw.point((rack_x + 4 + rng.randint(0, 10), shelf_y), fill=light)
        draw.rectangle([rack_x + 2, 43, rack_x + 18, 45], fill=ramp[0])

    # side and bottom walls
    draw.rectangle([0, 0, 7, ROOM_H], fill=ramp[0])
    draw.rectangle([ROOM_W - 8, 0, ROOM_W, ROOM_H], fill=ramp[0])
    draw.rectangle([0, ROOM_H - 8, ROOM_W, ROOM_H], fill=ramp[0])
    draw.line([(7, 40), (7, ROOM_H - 8)], fill=ramp[2])
    draw.line([(ROOM_W - 8, 40), (ROOM_W - 8, ROOM_H - 8)], fill=ramp[2])
    draw.line([(7, ROOM_H - 8), (ROOM_W - 8, ROOM_H - 8)], fill=ramp[2])

    # cables on the floor, running from the racks to the middle
    for rack_x in rack_positions:
        side = -1 if rack_x < center_x else 1
        points = [
            (rack_x + 10, 46),
            (rack_x + 10 - side * 8, 70 + rng.randint(0, 12)),
            (center_x + side * rng.randint(50, 110), 110 + rng.randint(0, 30)),
            (center_x + side * rng.randint(20, 40), 150 + rng.randint(0, 20)),
        ]
        draw.line(points, fill=ramp[0], width=3)
        draw.line(points, fill=accent_dark if corrupted else ramp[2], width=1)

    # props: broken monitors and floppy disks
    for prop_x, prop_y in [(26, 150), (470, 120), (440, 300), (40, 290), (300, 320)]:
        draw.rectangle([prop_x, prop_y + 10, prop_x + 15, prop_y + 12], fill=ramp[0])
        draw.rectangle([prop_x, prop_y, prop_x + 15, prop_y + 10], fill=ramp[2], outline=ramp[0])
        draw.rectangle([prop_x + 2, prop_y + 2, prop_x + 13, prop_y + 8], fill=ramp[1])
        draw.line([(prop_x + 4, prop_y + 2), (prop_x + 8, prop_y + 6), (prop_x + 6, prop_y + 8)], fill=ramp[3])
    for floppy_x, floppy_y in [(90, 70), (410, 84), (60, 230), (450, 220), (150, 310), (360, 280), (230, 66), (120, 180)]:
        draw.rectangle([floppy_x, floppy_y, floppy_x + 5, floppy_y + 5], fill=ramp[3])
        draw.rectangle([floppy_x + 1, floppy_y, floppy_x + 4, floppy_y + 1], fill=ramp[0])
    return image


# ---------------------------------------------------------------- boss
BOSS_FRAME_W, BOSS_FRAME_H = 144, 80
BOSS_CENTER_X, BOSS_TOP = 72, 8


def make_boss(phase_name):
    phase = PHASES[phase_name]
    ramp, accent = phase["ramp"], phase["acc"]
    sheet = Image.new("RGBA", (BOSS_FRAME_W * 4, BOSS_FRAME_H), CLEAR)
    for frame in range(4):
        image = Image.new("RGBA", (BOSS_FRAME_W, BOSS_FRAME_H), CLEAR)
        draw = ImageDraw.Draw(image)
        cx, top = BOSS_CENTER_X, BOSS_TOP
        # cable legs
        for side in (-1, 1):
            for leg in range(4):
                step = (frame + leg * 2 + (0 if side < 0 else 1)) % 4
                shift = [0, 2, 0, -2][step]
                lift = [0, 3, 0, 0][step]
                start = (cx + side * 25, top + 18 + leg * 7)
                knee = (cx + side * (40 + leg * 7) + shift, top + 6 + leg * 9 - lift)
                foot = (cx + side * (46 + leg * 6) + shift, top + 50 + leg * 4 - lift)
                draw.line([start, knee, foot], fill=ramp[0], width=3)
                draw.line([start, knee, foot], fill=ramp[3], width=1)
                draw.rectangle([foot[0] - 2, foot[1] - 1, foot[0] + 2, foot[1] + 2], fill=ramp[4])
                draw.rectangle([foot[0] - 1, foot[1] + 3, foot[0] + 1, foot[1] + 4], fill=ramp[3])
        # tube, top face, front face
        draw.rectangle([cx - 17, top - 6, cx + 17, top + 2], fill=ramp[3], outline=ramp[0])
        draw.rectangle([cx - 26, top + 2, cx + 26, top + 12], fill=ramp[3], outline=ramp[0])
        for vent_x in range(cx - 20, cx + 21, 4):
            draw.line([(vent_x, top + 5), (vent_x, top + 9)], fill=ramp[2])
        draw.rectangle([cx - 26, top + 12, cx + 26, top + 50], fill=ramp[2], outline=ramp[0])
        draw.rectangle([cx - 22, top + 15, cx + 22, top + 41], fill=ramp[0])
        draw.rectangle([cx - 20, top + 17, cx + 20, top + 39], fill=ramp[1])
        # bezel details
        draw.rectangle([cx - 20, top + 44, cx - 8, top + 46], fill=ramp[0])
        draw.rectangle([cx + 17, top + 43, cx + 20, top + 46], fill=accent)
        # cracks
        draw.line([(cx + 12, top + 17), (cx + 9, top + 22), (cx + 14, top + 25)], fill=ramp[4])
        if phase_name == "p2":
            draw.line([(cx - 20, top + 30), (cx - 14, top + 27), (cx - 16, top + 22), (cx - 10, top + 19)], fill=ramp[4])
            draw.line([(cx - 26, top + 20), (cx - 22, top + 24), (cx - 24, top + 31)], fill=ramp[0])
            draw.line([(cx + 26, top + 36), (cx + 21, top + 40), (cx + 23, top + 47)], fill=ramp[0])
            draw.line([(cx - 4, top + 2), (cx, top + 7), (cx - 3, top + 12)], fill=ramp[0])
        sheet.paste(image, (frame * BOSS_FRAME_W, 0))
    return sheet


FACE_W, FACE_H = 41, 23


def make_faces(phase_name):
    """Frames: 0 neutral, 1 angry, 2 laugh, 3 hurt. Drawn in the accent color on a clear background."""
    accent = PHASES[phase_name]["acc"]
    sheet = Image.new("RGBA", (FACE_W * 4, FACE_H), CLEAR)

    def frame(index):
        image = Image.new("RGBA", (FACE_W, FACE_H), CLEAR)
        return image, ImageDraw.Draw(image), index

    def done(image, index):
        sheet.paste(image, (index * FACE_W, 0))

    image, draw, index = frame(0)
    draw.rectangle([5, 5, 15, 12], fill=accent)
    draw.rectangle([25, 5, 35, 12], fill=accent)
    draw.rectangle([9, 8, 11, 10], fill=CLEAR)
    draw.rectangle([29, 8, 31, 10], fill=CLEAR)
    draw.rectangle([10, 17, 30, 18], fill=accent)
    done(image, index)

    image, draw, index = frame(1)
    draw.polygon([(4, 4), (16, 8), (16, 13), (4, 13)], fill=accent)
    draw.polygon([(24, 8), (36, 4), (36, 13), (24, 13)], fill=accent)
    draw.rectangle([6, 9, 8, 11], fill=CLEAR)
    draw.rectangle([26, 9, 28, 11], fill=CLEAR)
    draw.rectangle([7, 16, 33, 20], fill=accent)
    for tooth in range(5):
        draw.rectangle([9 + tooth * 5, 16, 10 + tooth * 5, 17], fill=CLEAR)
        draw.rectangle([11 + tooth * 5, 19, 12 + tooth * 5, 20], fill=CLEAR)
    done(image, index)

    image, draw, index = frame(2)
    draw.line([(5, 11), (10, 6), (15, 11)], fill=accent, width=2)
    draw.line([(25, 11), (30, 6), (35, 11)], fill=accent, width=2)
    draw.polygon([(8, 14), (32, 14), (29, 21), (11, 21)], fill=accent)
    draw.rectangle([12, 14, 28, 15], fill=CLEAR)
    for tooth in range(4):
        draw.rectangle([13 + tooth * 4, 14, 14 + tooth * 4, 15], fill=accent)
    done(image, index)

    image, draw, index = frame(3)
    for left in (5, 25):
        draw.line([(left, 5), (left + 9, 12)], fill=accent, width=2)
        draw.line([(left, 12), (left + 9, 5)], fill=accent, width=2)
    draw.line([(9, 18), (13, 16), (17, 18), (21, 16), (25, 18), (29, 16), (32, 18)], fill=accent, width=2)
    done(image, index)
    return sheet


def make_shadow():
    image = Image.new("RGBA", (112, 18), CLEAR)
    ImageDraw.Draw(image).ellipse([0, 0, 111, 17], fill=(0, 0, 0, 120))
    return image


def make_glow():
    width, height = 96, 64
    image = Image.new("RGBA", (width, height), CLEAR)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            distance = math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2))
            strength = max(0.0, 1.0 - distance) ** 2
            pixels[x, y] = (255, 40, 60, int(150 * strength))
    return image


# ---------------------------------------------------------------- player
PLAYER_FRAME_W, PLAYER_FRAME_H = 16, 18
HOOD = {
    "R": (224, 40, 60, 255),     # red cloak
    "L": (255, 98, 110, 255),    # highlight
    "D": (140, 20, 38, 255),     # shadow
    "K": (10, 10, 10, 255),      # the empty face
    "G": (90, 90, 90, 255),      # boots
}
PLAYER_BODY = [
    "....RRRR....",
    "...RLLRRR...",
    "..RLRRRRRD..",
    "..RRKKKKRD..",
    "..RKKKKKKD..",
    "..RKKKKKKD..",
    "..RRKKKKRD..",
    "...RRRRRD...",
    "..RRRRRRRD..",
    ".RRRRRRRRRD.",
    ".RLRRRRRRDD.",
    ".RRRRRRRRDD.",
    "..RRDRRDRD..",
]
LEGS_BOTH = "...GG..GG..."
LEGS_LEFT = "...GG......."
LEGS_RIGHT = ".......GG..."
PLAYER_DASH = [
    "......RRRR..",
    ".....RLLRRR.",
    "....RLRRRRRD",
    "....RRKKKKRD",
    "...RRKKKKKKD",
    "...RRKKKKKKD",
    "..RRRRKKKKRD",
    "..RRRRRRRRD.",
    ".RRRRRRRRRD.",
    "RRLRRRRRRD..",
    "RRRRRRRDD...",
    ".RDRRDRD....",
    "..D..D......",
]


def make_player():
    """Frames: 0-1 idle, 2-5 walk, 6 dash."""
    white = (255, 255, 255, 255)
    poses = [
        (PLAYER_BODY + [LEGS_BOTH], 0),
        (PLAYER_BODY + [LEGS_BOTH], 1),
        (PLAYER_BODY + [LEGS_LEFT], -1),
        (PLAYER_BODY + [LEGS_BOTH], 0),
        (PLAYER_BODY + [LEGS_RIGHT], -1),
        (PLAYER_BODY + [LEGS_BOTH], 0),
        (PLAYER_DASH, 1),
    ]
    sheet = Image.new("RGBA", (PLAYER_FRAME_W * len(poses), PLAYER_FRAME_H), CLEAR)
    for index, (rows, bob) in enumerate(poses):
        image = Image.new("RGBA", (PLAYER_FRAME_W, PLAYER_FRAME_H), CLEAR)
        paint_rows(image, rows, 2, 2 + bob, HOOD)
        sheet.paste(add_outline(image, white), (index * PLAYER_FRAME_W, 0))
    return sheet


def make_gun():
    image = Image.new("RGBA", (10, 6), CLEAR)
    rows = [
        ".WWWWWWW.",
        ".WWWWWWWW",
        ".GGW.....",
        ".GG......",
    ]
    paint_rows(image, rows, 0, 1, {"W": (230, 230, 230, 255), "G": (140, 140, 140, 255)})
    return image


def make_player_bullet():
    image = Image.new("RGBA", (6, 4), CLEAR)
    rows = [".YYYY.", "YWWWWY", "YWWWWY", ".YYYY."]
    paint_rows(image, rows, 0, 0, {"Y": (255, 214, 120, 255), "W": (255, 250, 230, 255)})
    return image


# ---------------------------------------------------------------- bits and UI
def make_bits():
    """Frames: 0 is a '0', 1 is a '1'. White digit with a red outline."""
    glyphs = [
        [".XXX.", "X...X", "X...X", "X...X", ".XXX."],
        ["..X..", ".XX..", "..X..", "..X..", ".XXX."],
    ]
    sheet = Image.new("RGBA", (14, 7), CLEAR)
    for index, rows in enumerate(glyphs):
        image = Image.new("RGBA", (7, 7), CLEAR)
        paint_rows(image, rows, 1, 1, {"X": (255, 255, 255, 255)})
        outlined = add_outline(image, (255, 43, 61, 255))
        if index == 0:
            # keep the hole of the zero dark so it reads as a digit
            ImageDraw.Draw(outlined).rectangle([2, 2, 4, 4], fill=(20, 0, 4, 255))
        sheet.paste(outlined, (index * 7, 0))
    return sheet


def make_hearts():
    """Frames: 0 full, 1 empty."""
    rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."]
    sheet = Image.new("RGBA", (18, 8), CLEAR)
    for index, color in enumerate([(255, 43, 61, 255), (70, 70, 70, 255)]):
        image = Image.new("RGBA", (9, 8), CLEAR)
        paint_rows(image, rows, 1, 1, {"X": color})
        sheet.paste(add_outline(image, (0, 0, 0, 255)), (index * 9, 0))
    return sheet


def make_spark():
    image = Image.new("RGBA", (3, 3), CLEAR)
    paint_rows(image, [".X.", "XXX", ".X."], 0, 0, {"X": (255, 255, 255, 255)})
    return image


if __name__ == "__main__":
    for name in PHASES:
        save(make_room(name), f"room_{name}.png")
        save(make_boss(name), f"boss_{name}.png")
        save(make_faces(name), f"face_{name}.png")
    save(make_shadow(), "shadow.png")
    save(make_glow(), "glow.png")
    save(make_player(), "player.png")
    save(make_gun(), "gun.png")
    save(make_player_bullet(), "pbullet.png")
    save(make_bits(), "bits.png")
    save(make_hearts(), "hearts.png")
    save(make_spark(), "spark.png")
