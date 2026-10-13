"""Builds src/data/rooms/fray.js — The Fray, the tutorial area. Run: python3 tools/build_fray.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from roomkit import Room, emit

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'rooms', 'fray.js')
rooms = []

E = lambda i, **k: dict(e='enemy', id='fray_' + i, **k)

# ---------------------------------------------------------------- 1. The Cradle (spawn)
r = Room('fray_cradle', 44, 22, name='The Cradle')
r.rect(1, 7, 42, 19)
r.ellipse(12, 6, 9, 4)
r.ellipse(32, 6, 8, 3)
r.slope_up(13, 19, 2); r.fill(15, 18, 17, 19); r.slope_down(18, 19, 2)
r.fill(26, 17, 31, 19)
r.put(5, 17, '====').put(10, 14, '====').put(15, 11, '=====')
r.put(4, 19, '@')
r.put(7, 16, 'h')
r.put(22, 19, 'w')
r.put(17, 10, 'j')
r.put(36, 19, 'p')
r.put(39, 19, 'l')
r.door('right', 17, 3, '1')
rooms.append(r.js(legend={
    'h': dict(e='trigger', w=1, h=4, hint='←  →  roll       Z  jump', desc='Hold Z for a higher jump.'),
    'w': dict(e='npc', id='threadwisp', facing=-1),
    'j': dict(e='beadling'),
    'p': dict(e='pot', value=4),
    'l': dict(e='lore', id='fray_1'),
}, doors={'1': 'fray_02:1'}))

# ---------------------------------------------------------------- 2. Loose Ends (jumps, Bonk)
r = Room('fray_02', 64, 24, name='Loose Ends')
r.rect(1, 9, 62, 20)
r.ellipse(20, 8, 12, 4)
r.ellipse(46, 8, 10, 4)
r.fill(22, 18, 27, 20)                      # a 3-tile step
r.rect(31, 21, 35, 22); r.row(22, 31, 35, '^')  # spike ditch (5 wide)
r.fill(45, 4, 53, 14)                       # low ceiling ...
r.fill(48, 15, 49, 20, 'B')                 # ... and a cracked wall to Bonk through
r.put(42, 17, 'b')
r.put(10, 20, 'm').put(38, 20, 'm')
r.put(56, 20, 'p')
r.put(17, 15, '=====').put(15, 12, '=====')
r.put(19, 11, 'g')
r.door('left', 18, 3, '1').door('right', 18, 3, '2')
rooms.append(r.js(legend={
    'b': dict(e='trigger', w=1, h=4, hint='X  Bonk', desc='Bonk the cracked wall until it breaks.'),
    'm': E('lintmite'),
    'p': dict(e='pot', value=5),
    'g': dict(e='pot', value=8),
}, doors={'1': 'fray_cradle:1', '2': 'fray_03:1'}))

# ---------------------------------------------------------------- 3. Threadfall (descent, drop-through)
r = Room('fray_03', 46, 40, name='Threadfall')
r.rect(1, 2, 44, 36)
r.fill(1, 9, 12, 10)                         # entry ledge under the left door
r.put(16, 13, '======').put(28, 17, '======').put(10, 21, '=======').put(24, 25, '======')
r.row(30, 1, 44, '=')                        # a full floor of one-ways: Down+Z to drop
r.put(18, 28, 'd')
r.rect(20, 37, 22, 38)                       # exit shaft to the Needle Pit
r.put(5, 8, 'L')
r.put(30, 10, 'f')
r.put(26, 3, 'u')
r.put(38, 36, 'p')
r.door('left', 6, 3, '1').door('bottom', 20, 3, '2')
rooms.append(r.js(legend={
    'L': dict(e='lore', id='fray_2'),
    'd': dict(e='trigger', w=6, h=2, hint='↓ + Z  drop down', desc='Hold Down and jump to fall through thin platforms.'),
    'f': E('threadfly'),
    'u': E('fuzzdrop'),
    'p': dict(e='pot', value=6),
}, doors={'1': 'fray_02:2', '2': 'fray_04:1'}, oneWay={'2': True}, lockedDoors=['1']))

# ---------------------------------------------------------------- 4. Needle Pit (pogo)
r = Room('fray_04', 70, 22, name='Needle Pit')
r.rect(1, 1, 68, 19)
r.fill(1, 1, 4, 19); r.fill(10, 1, 68, 5)    # entry chute walls
r.ellipse(40, 6, 20, 3)
r.row(19, 18, 27, '^')                        # 10 spikes: needs one pogo
r.row(19, 40, 52, '^'); r.fill(46, 18, 46, 19)  # a tiny rest pillar in the second field
r.put(12, 16, 'q')
r.put(34, 19, 'k')
r.put(60, 19, 'p').put(64, 19, 'p')
r.fill(63, 17, 66, 19)
r.put(58, 13, '=====')
r.put(60, 12, 'c')
r.door('top', 6, 3, '1').door('right', 17, 3, '2')
rooms.append(r.js(legend={
    'q': dict(e='trigger', w=2, h=4, hint='↓ + X  in mid-air: pogo', desc='Bonk downward onto spikes and foes to bounce off them.'),
    'k': E('knotling'),
    'p': dict(e='pot', value=5),
    'c': dict(e='pot', cache=True, value=30),
}, doors={'1': 'fray_03:2', '2': 'fray_05:1'}, lockedDoors=['1'], oneWay={'2': True}))

# ---------------------------------------------------------------- 5. Spindle Nook (bench, mend)
r = Room('fray_05', 40, 20, name='Spindle Nook')
r.rect(1, 4, 38, 16)
r.ellipse(20, 5, 10, 4)
r.put(19, 16, 's')
r.put(11, 13, 't')
r.put(30, 16, 'L')
r.put(25, 16, 'c')
r.put(14, 7, 'n')
r.door('left', 14, 3, '1').door('right', 14, 3, '2')
rooms.append(r.js(legend={
    's': dict(e='spindle'),
    't': dict(e='trigger', w=1, h=4, hint='Spindles', desc='Press ↑ to rest: heal, save, and tie Knots.\nRoll fast to wind up Spin. Hold F while rolling to Buff out scratches.'),
    'L': dict(e='lore', id='fray_3'),
    'c': dict(e='deco', kind='candle'),
    'n': dict(e='deco', kind='lamp', hang=True),
}, doors={'1': 'fray_04:2', '2': 'fray_06:1'}))

# ---------------------------------------------------------------- 6. Tangle Gallery (combat)
r = Room('fray_06', 64, 26, name='Tangle Gallery')
r.rect(1, 6, 62, 23)
r.ellipse(32, 7, 20, 5)
r.fill(44, 20, 62, 23)
r.put(48, 17, '=====')
r.fill(54, 15, 62, 19)
r.put(10, 18, '=====').put(26, 15, '======')
r.put(20, 23, 'g').put(36, 23, 'g')
r.put(30, 11, 'f')
r.put(50, 19, 'k')
r.put(58, 14, 'c')
r.put(28, 14, 'p')
r.door('left', 21, 3, '1').door('right', 12, 3, '2')
rooms.append(r.js(legend={
    'g': E('stitchgrub'),
    'f': E('threadfly'),
    'k': E('knotling'),
    'c': dict(e='pot', cache=True, value=40),
    'p': dict(e='pot', value=6),
}, doors={'1': 'fray_05:2', '2': 'fray_07:1'}))

# ---------------------------------------------------------------- 7. Moth-eaten Hall (secret)
r = Room('fray_07', 56, 22, name='Moth-eaten Hall')
r.rect(1, 4, 54, 14)
r.fill(20, 17, 30, 20, '*')                    # hidden chamber below the floor (all fake wall until found)
r.fill(24, 15, 25, 16, '*')                    # fake floor into it
r.put(22, 18, '======')
r.put(28, 20, 'j')
r.fill(42, 1, 54, 7)                           # solid shoulder of rock
r.put(36, 8, '======')                         # high ledge (needs Bubble Hop)
r.fill(42, 8, 49, 8); r.put(42, 7, 'HHHHHH')   # crawlspace (needs Pinhole)
r.rect(48, 1, 49, 7, ' ')                      # shaft up to the secret way
r.put(10, 14, 'L')
r.put(32, 5, 'u')
r.put(38, 14, 'm')
r.put(16, 4, 'n').put(36, 4, 'n')
r.door('left', 12, 3, '1').door('right', 12, 3, '2').door('top', 48, 2, '3')
rooms.append(r.js(legend={
    'j': dict(e='beadling'),
    'L': dict(e='lore', id='fray_4'),
    'u': E('fuzzdrop'),
    'm': E('pillbug'),
    'n': dict(e='deco', kind='banner', color='#3a4458'),
}, doors={'1': 'fray_06:2', '2': 'fray_08:1', '3': 'fray_secret:1'}, lockedDoors=['3'], oneWay={'3': True}))

# ---------------------------------------------------------------- 7b. The secret way up (to the Dunes)
r = Room('fray_secret', 34, 30, name='Lint Chimney', req=['sap', 'dash', 'glide', 'dbljump', 'shrink'])
r.rect(1, 1, 32, 26)
r.rect(28, 27, 29, 28)
r.row(26, 4, 10, '^'); r.row(26, 22, 28, '^')
r.fill(8, 19, 13, 20); r.fill(20, 13, 25, 14); r.fill(6, 7, 11, 8)
r.put(23, 12, 'k')
r.door('bottom', 28, 2, '1').door('top', 15, 3, '8')
rooms.append(r.js(legend={
    'k': dict(e='item', item='knot', id='wanderer'),
}, doors={'1': 'fray_07:3', '8': 'dunes_entry:9'}))

# ---------------------------------------------------------------- 8. Unravelled Stair (climb without abilities)
r = Room('fray_08', 40, 40, name='Unravelled Stair')
r.rect(1, 1, 38, 35)
for (y, x0, x1) in [(34, 22, 29), (31, 12, 19), (28, 3, 10), (25, 12, 19), (22, 22, 29),
                    (19, 30, 37), (16, 20, 27), (13, 10, 17), (10, 20, 27)]:
    r.row(y, x0, x1, '=')
r.fill(30, 7, 38, 8)
r.put(30, 18, 'k')
r.put(14, 20, 'f').put(26, 6, 'f')
r.put(4, 27, 'p')
r.door('left', 33, 3, '1').door('right', 4, 3, '2')
rooms.append(r.js(legend={
    'k': E('knotling'),
    'f': E('threadfly'),
    'p': dict(e='pot', value=10),
}, doors={'1': 'fray_07:2', '2': 'fray_09:1'}))

# ---------------------------------------------------------------- 9. Last Light (pre-boss spindle)
r = Room('fray_09', 44, 20, name='Last Light')
r.rect(1, 5, 42, 16)
r.ellipse(22, 5, 12, 4)
r.put(20, 16, 's')
r.put(14, 16, 'c').put(28, 16, 'c')
r.put(34, 9, 'n')
r.door('left', 14, 3, '1').door('right', 14, 3, '2')
rooms.append(r.js(legend={
    's': dict(e='spindle'),
    'c': dict(e='deco', kind='candle'),
    'n': dict(e='deco', kind='lamp', hang=True),
}, doors={'1': 'fray_08:2', '2': 'fray_boss:1'}))

# ---------------------------------------------------------------- 10. The Tangle (Gnarlknot arena)
r = Room('fray_boss', 60, 22, name='The Tangle')
r.rect(1, 4, 58, 19)
r.ellipse(30, 4, 22, 3)
r.put(12, 15, '=====').put(43, 15, '=====').put(26, 11, '========')
r.put(2, 17, 'a').put(57, 17, 'a')
r.put(40, 19, 'K')
r.door('left', 17, 3, '1').door('right', 17, 3, '2')
rooms.append(r.js(legend={
    'a': dict(e='gate', arena=True, h=3),
    'K': dict(e='boss', id='gnarlknot'),
}, doors={'1': 'fray_09:2', '2': 'fray_11:1'}))

# ---------------------------------------------------------------- 11. Unknotted Rise (up to the surface)
r = Room('fray_11', 36, 36, name='Unknotted Rise')
r.rect(1, 1, 34, 33)
for (y, x0, x1) in [(31, 10, 17), (28, 20, 27), (25, 28, 34), (22, 18, 25), (19, 8, 15),
                    (16, 16, 23), (13, 24, 31), (10, 14, 21), (7, 22, 29), (4, 26, 28)]:
    r.row(y, x0, x1, '=')
r.fill(25, 1, 25, 5); r.fill(29, 1, 29, 5)      # little chimney walls around the exit
r.put(3, 17, '=====')
r.put(5, 16, 'i')
r.put(30, 23, 'f')
r.door('left', 31, 3, '1').door('top', 26, 3, '2')
rooms.append(r.js(legend={
    'i': dict(e='item', item='glints', value=60),
    'f': E('threadfly'),
}, doors={'1': 'fray_boss:2', '2': 'fray_exit:1'}))

# ---------------------------------------------------------------- 12. The Snapped End (surface, to town)
r = Room('fray_exit', 64, 24, name='The Snapped End', music='fray')
r.rect(1, 1, 62, 19)
r.rect(10, 20, 12, 22)                        # shaft up from below
r.fill(1, 16, 6, 19)
r.slope_up(40, 19, 3); r.fill(43, 17, 62, 19)
r.put(50, 16, 'n')
r.put(30, 19, 'm')
r.put(20, 15, 'x')
r.door('bottom', 10, 3, '1').door('right', 14, 3, '9')
rooms.append(r.js(legend={
    'n': dict(e='deco', kind='sign', text='Spindletown  →'),
    'm': E('pillbug'),
    'x': dict(e='trigger', w=1, h=5, flag='seen_surface', text=['The air tastes of rain.', 'Far above, past the clouds, something pale is watching.'], style='lore'),
}, doors={'1': 'fray_11:2', '9': 'town_gate:9'}))

emit(OUT, '// The Fray: tutorial area. GENERATED by tools/build_fray.py; edit that script, not this file.', rooms)
print('wrote', OUT, len(rooms), 'rooms')
