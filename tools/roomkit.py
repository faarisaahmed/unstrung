"""Tiny room-carving kit used by the lead to author rooms (outputs the ASCII format of docs/AUTHORING.md).

    r = Room('fray_02', 60, 22)
    r.rect(1, 3, 58, 19)            # carve air (inclusive)
    r.ellipse(30, 8, 10, 5)
    r.fill(20, 15, 24, 19, '#')     # add rock back
    r.door('left', 17, 3, '1')      # cells on the border: rows 17..19
    r.put(10, 19, 's')              # entity marker
    print(r.js(legend={...}, doors={...}))
"""
import json
import math


class Room:
    def __init__(self, rid, w, h, area='fray', **meta):
        self.id, self.w, self.h, self.area = rid, w, h, area
        self.g = [['#'] * w for _ in range(h)]
        self.meta = meta

    def inb(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x, y, ch):
        if self.inb(x, y):
            self.g[y][x] = ch

    def get(self, x, y):
        return self.g[y][x] if self.inb(x, y) else '#'

    def rect(self, x0, y0, x1, y1, ch=' '):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                # never carve the outer border except via door()
                if 0 < x < self.w - 1 and 0 < y < self.h - 1 or ch != ' ':
                    self.set(x, y, ch)
        return self

    def fill(self, x0, y0, x1, y1, ch='#'):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.set(x, y, ch)
        return self

    def ellipse(self, cx, cy, rx, ry, ch=' '):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2 <= 1.0:
                    if 0 < x < self.w - 1 and 0 < y < self.h - 1:
                        self.set(x, y, ch)
        return self

    def put(self, x, y, s):
        for i, ch in enumerate(s):
            self.set(x + i, y, ch)
        return self

    def col(self, x, y0, y1, ch):
        for y in range(y0, y1 + 1):
            self.set(x, y, ch)
        return self

    def row(self, y, x0, x1, ch):
        for x in range(x0, x1 + 1):
            self.set(x, y, ch)
        return self

    def door(self, edge, start, length, digit):
        """Door cells on a border. For left/right: rows start..start+len-1; for top/bottom: columns."""
        for i in range(length):
            if edge == 'left':
                self.set(0, start + i, digit)
            elif edge == 'right':
                self.set(self.w - 1, start + i, digit)
            elif edge == 'top':
                self.set(start + i, 0, digit)
            elif edge == 'bottom':
                self.set(start + i, self.h - 1, digit)
        return self

    def stairs(self, x, y, n, dx=1, ch='#'):
        """Solid staircase going up from (x,y) n steps (each 1 tile)."""
        for i in range(n):
            self.fill(x + i * dx, y - i, x + i * dx, y, ch)
        return self

    def slope_up(self, x, y, n):
        """45° ramp rising to the right: n tiles starting at floor level y (rock filled under)."""
        for i in range(n):
            self.set(x + i, y - i, '/')
            for yy in range(y - i + 1, y + 1):
                self.set(x + i, yy, '#')
        return self

    def slope_down(self, x, y, n):
        """45° ramp falling to the right, top at (x, y-n+1)."""
        for i in range(n):
            self.set(x + i, y - (n - 1 - i), '\\')
            for yy in range(y - (n - 1 - i) + 1, y + 1):
                self.set(x + i, yy, '#')
        return self

    def rows(self):
        return [''.join(r) for r in self.g]

    def js(self, legend=None, doors=None, **extra):
        lines = ['  {']
        lines.append(f"    id: '{self.id}', area: '{self.area}',")
        meta = dict(self.meta)
        meta.update(extra)
        for k, v in meta.items():
            lines.append(f"    {k}: {json.dumps(v)},")
        if legend:
            lines.append('    legend: {')
            for k, v in legend.items():
                lines.append(f"      {k}: {js_obj(v)},")
            lines.append('    },')
        if doors:
            lines.append('    doors: { ' + ', '.join(f"{k}: '{v}'" for k, v in doors.items()) + ' },')
        lines.append('    tiles: [')
        for r in self.rows():
            lines.append("      '" + r.replace('\\', '\\\\') + "',")
        lines.append('    ],')
        lines.append('  },')
        return '\n'.join(lines)


def js_obj(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(f"{k}: {js_obj(x)}" for k, x in v.items()) + ' }'
    if isinstance(v, list):
        return '[' + ', '.join(js_obj(x) for x in v) + ']'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    return json.dumps(v)


def emit(path, header, rooms_js):
    with open(path, 'w') as f:
        f.write(header + '\nexport default [\n' + '\n'.join(rooms_js) + '\n];\n')
