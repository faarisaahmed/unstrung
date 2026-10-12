"""Builds src/data/rooms/town.js — Spindletown, the surface hub. Run: python3 tools/build_town.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from roomkit import Room, emit

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'rooms', 'town.js')
rooms = []
T = 'town'

# ---------------------------------------------------------------- town_gate (outskirts)
r = Room('town_gate', 64, 26, area=T, name='Spindletown Outskirts', sky=True)
r.rect(1, 1, 62, 21)
r.slope_up(14, 21, 2); r.fill(16, 20, 30, 21); r.slope_down(31, 21, 2)
r.put(6, 21, 'L')
r.put(22, 19, 'P').put(44, 21, 'P')
r.put(36, 21, 'F').put(52, 21, 'S')
r.put(28, 19, 'm')
r.door('left', 19, 3, '9').door('right', 18, 4, '1')
rooms.append(r.js(legend={
    'L': dict(e='deco', kind='lamppost'),
    'P': dict(e='deco', kind='lamppost'),
    'F': dict(e='deco', kind='fence', w=5),
    'S': dict(e='deco', kind='sign', text='Spindletown'),
    'm': dict(e='enemy', id='fray_pillbug'),
}, doors={'9': 'fray_exit:9', '1': 'town_square:1'}))

# ---------------------------------------------------------------- town_square (shops, spindle)
r = Room('town_square', 96, 28, area=T, name='Spindle Square', sky=True)
r.rect(1, 1, 94, 23)
# hovering rooftops to climb toward the spire door (a passage stays open beneath them)
r.put(60, 20, '=====').put(64, 17, '=====')
r.fill(70, 15, 79, 18); r.fill(80, 11, 87, 18); r.fill(88, 7, 94, 18)
# a cellar under the square, behind a fake floor
r.rect(30, 25, 40, 26); r.fill(30, 25, 40, 26, '*'); r.fill(33, 24, 34, 24, '*'); r.put(37, 26, 'j')
r.put(5, 23, 'q').put(25, 23, 'v').put(45, 23, 'z')
r.put(12, 23, 'b').put(32, 23, 't').put(52, 23, 'u').put(42, 23, 's').put(58, 23, 'L')
r.put(20, 23, 'p').put(67, 23, 'p')
r.put(84, 10, 'k')
r.door('left', 20, 4, '1').door('right', 20, 4, '2').door('right', 3, 4, '3')
rooms.append(r.js(legend={
    'q': dict(e='deco', kind='house', w=5, h=5, door=True, sign="Bobbin's", color='#2a2230'),
    'v': dict(e='deco', kind='house', w=6, h=6, door=True, sign='Tinsmith', color='#262233', roof='#40303a'),
    'z': dict(e='deco', kind='house', w=5, h=4, door=True, sign='Beadmother', color='#2c2428'),
    'b': dict(e='npc', id='bobbin'),
    't': dict(e='npc', id='tinsmith'),
    'u': dict(e='npc', id='beadmother'),
    's': dict(e='spindle'),
    'L': dict(e='lore', id='town_1'),
    'p': dict(e='deco', kind='lamppost'),
    'j': dict(e='beadling'),
    'k': dict(e='pot', cache=True, value=50),
}, doors={'1': 'town_gate:1', '2': 'town_well:1', '3': 'town_spire:1'}))

# ---------------------------------------------------------------- town_spire (bell spire, sealed top)
r = Room('town_spire', 40, 64, area=T, name='The Old Spire', req=['sap', 'dash', 'glide', 'comet'])
r.rect(1, 5, 38, 58)
r.fill(1, 59, 38, 62)
for (y, x0, x1) in [(55, 6, 13), (51, 16, 23), (47, 26, 33), (43, 16, 23), (39, 6, 13), (35, 15, 22),
                    (31, 25, 32), (27, 15, 22), (23, 5, 12), (19, 14, 21), (15, 24, 31), (11, 14, 21), (8, 12, 19)]:
    r.row(y, x0, x1, '=')
r.rect(2, 1, 30, 3)                              # bell-loft corridor under the roof
r.put(14, 4, '=====')                            # way up into it
r.fill(20, 1, 21, 3, 'C')                        # crystal seal (Comet Roll smashes it)
r.put(28, 30, 'j')
r.put(8, 38, 'L')
r.put(18, 18, 'f')
r.door('left', 55, 4, '1').door('top', 25, 3, '8')
rooms.append(r.js(legend={
    'j': dict(e='beadling'),
    'L': dict(e='lore', id='town_2'),
    'f': dict(e='enemy', id='fray_threadfly'),
}, doors={'1': 'town_square:3', '8': 'bellfry_town:8'}))

# ---------------------------------------------------------------- town_well (down to the Hollows)
r = Room('town_well', 70, 28, area=T, name='The Old Well', sky=True)
r.rect(1, 1, 68, 23)
r.rect(32, 24, 34, 26)                          # the well shaft
r.fill(30, 22, 30, 23); r.fill(36, 22, 36, 23)  # well rim
r.put(33, 21, 'y')
# stair of roofs up to the moongate (top-right)
r.put(44, 20, '======').put(50, 16, '======').put(56, 12, '======').put(60, 8, '======').put(64, 4, '===')
r.put(10, 23, 'p').put(44, 23, 'p')
r.put(20, 23, 'h')
r.put(40, 20, 'd')
r.door('left', 20, 4, '1').door('right', 20, 4, '2').door('bottom', 32, 3, '9').door('top', 64, 3, '3')
rooms.append(r.js(legend={
    'y': dict(e='deco', kind='well'),
    'p': dict(e='deco', kind='lamppost'),
    'h': dict(e='deco', kind='house', w=6, h=5, door=True, color='#251f2b'),
    'd': dict(e='trigger', w=1, h=4, hint='The Old Well', desc='Far below, the caverns of Mossbell Hollows.\nYou can always climb back up.'),
}, doors={'1': 'town_square:2', '2': 'town_ferry:1', '9': 'hollows_well:9', '3': 'town_moongate:1'}))

# ---------------------------------------------------------------- town_moongate (to Moon's Cradle)
r = Room('town_moongate', 36, 48, area=T, name='Moongate Shrine', sky=True)
r.rect(1, 1, 34, 45)
r.rect(16, 46, 18, 46)
for (y, x0, x1) in [(42, 8, 13), (38, 20, 26), (34, 9, 15), (30, 20, 27), (26, 8, 14), (22, 19, 25), (18, 12, 23)]:
    r.row(y, x0, x1, '=')
r.fill(14, 1, 15, 14); r.fill(19, 1, 20, 14)
r.put(16, 14, 'g')
r.put(17, 17, 'L')
r.door('bottom', 16, 3, '1').door('top', 16, 3, '7')
rooms.append(r.js(legend={
    'g': dict(e='gate', item='moonKey', w=3, h=1),
    'L': dict(e='deco', kind='statue'),
}, doors={'1': 'town_well:3', '7': 'cradle_entry:9'}, lockedDoors=['7'], deadEnd=['1'], oneWay={'7': True}, req=['sap']))

# ---------------------------------------------------------------- town_ferry (moth ferry)
r = Room('town_ferry', 52, 24, area=T, name='Mothwing Landing', sky=True)
r.rect(1, 1, 50, 19)
r.put(24, 19, 'o').put(30, 19, 'F')
r.put(8, 19, 'p').put(44, 19, 'p')
r.door('left', 16, 4, '1').door('right', 16, 4, '2')
rooms.append(r.js(legend={
    'o': dict(e='npc', id='gossamer'),
    'F': dict(e='ferry', id='town'),
    'p': dict(e='deco', kind='lamppost'),
}, doors={'1': 'town_well:2', '2': 'town_hall:1'}))

# ---------------------------------------------------------------- town_hall (elder; to the Hall of Echoes)
r = Room('town_hall', 64, 26, area=T, name='Elder\'s Hall', sky=True)
r.rect(1, 1, 62, 21)
r.fill(54, 18, 62, 21)
r.put(20, 21, 'h').put(30, 21, 'e')
r.put(58, 14, 'g')
r.fill(36, 18, 46, 21); r.fill(39, 15, 43, 17)   # terraces up to the dojo stair
r.put(39, 11, '=====').put(39, 7, '=====').put(39, 3, '=====')
r.put(12, 21, 'p')
r.put(45, 17, 'L')
r.door('left', 18, 4, '1').door('right', 14, 4, '8').door('top', 40, 3, '3')
rooms.append(r.js(legend={
    'h': dict(e='deco', kind='house', w=7, h=6, door=True, sign='Hall', color='#2a2333', roof='#3c2f45'),
    'e': dict(e='npc', id='elder'),
    'g': dict(e='gate', item='echoBell', h=4),
    'p': dict(e='deco', kind='lamppost'),
    'L': dict(e='deco', kind='lamppost'),
}, doors={'1': 'town_ferry:2', '8': 'echoes_entry:9', '3': 'town_dojo:1'}, lockedDoors=['8']))

# ---------------------------------------------------------------- town_dojo (Rollmasters)
r = Room('town_dojo', 48, 24, area=T, name='Rolling Dojo')
r.rect(1, 3, 46, 19)
r.rect(20, 20, 22, 22)
r.put(8, 15, '=====').put(35, 15, '=====')
r.put(20, 20, 'a')
r.put(12, 19, 'R').put(32, 19, 'K')
r.put(40, 19, 'n')
r.door('bottom', 20, 3, '1')
rooms.append(r.js(legend={
    'a': dict(e='gate', arena=True, w=3, h=1),
    'R': dict(e='npc', id='rollmaster_spin'),
    'K': dict(e='boss', id='rollmasters', ifFlag='trio_ready', needs=['dbljump']),
    'n': dict(e='deco', kind='banner', color='#6a3040'),
}, doors={'1': 'town_hall:3'}))

emit(OUT, '// Spindletown: the surface hub. GENERATED by tools/build_town.py; edit that script, not this file.', rooms)
print('wrote', OUT, len(rooms), 'rooms')
