// Per-area visual style. Colors are hex strings; shapes/decor keys select procedural painters.
export const STYLES = {
  fray: {
    sky: ['#1b2230', '#0c0f17'], fog: 'rgba(150,170,200,0.10)', rock: '#0d1018', rockHi: '#1b2130',
    rim: '#8d9bb5', accent: '#c7d3e8', glow: '#d9e6ff', decorTop: 'threads', decorBottom: 'roots',
    bg: 'threadcave', particles: 'lint', light: 'rgba(200,215,255,0.08)',
  },
  hollows: {
    sky: ['#14272a', '#081214'], fog: 'rgba(110,190,170,0.10)', rock: '#0a1414', rockHi: '#16292a',
    rim: '#5f9c8c', accent: '#9fe0c4', glow: '#bff5df', decorTop: 'moss', decorBottom: 'roots',
    bg: 'bells', particles: 'spores', light: 'rgba(140,240,200,0.07)',
  },
  town: {
    sky: ['#2a2733', '#121019'], fog: 'rgba(200,170,140,0.08)', rock: '#120f15', rockHi: '#231e28',
    rim: '#a18d77', accent: '#ffcf86', glow: '#ffd99a', decorTop: 'tiles', decorBottom: 'drips',
    bg: 'town', particles: 'rain', light: 'rgba(255,200,130,0.08)',
  },
  gardens: {
    sky: ['#17301e', '#08140b'], fog: 'rgba(170,220,120,0.10)', rock: '#0a160d', rockHi: '#173021',
    rim: '#79a85b', accent: '#d8e86c', glow: '#efffa8', decorTop: 'leaves', decorBottom: 'vines',
    bg: 'greenhouse', particles: 'pollen', light: 'rgba(230,255,150,0.08)',
  },
  catacombs: {
    sky: ['#1d1610', '#0a0705'], fog: 'rgba(230,170,90,0.07)', rock: '#120d09', rockHi: '#261c14',
    rim: '#9a7a52', accent: '#ffb85c', glow: '#ffcf7a', decorTop: 'candles', decorBottom: 'wax',
    bg: 'crypt', particles: 'embers', light: 'rgba(255,180,90,0.08)',
  },
  hushwood: {
    sky: ['#1e1530', '#0b0714'], fog: 'rgba(180,140,230,0.10)', rock: '#0e0a17', rockHi: '#1f1830',
    rim: '#8b74b8', accent: '#d6b4ff', glow: '#ead8ff', decorTop: 'mushrooms', decorBottom: 'roots',
    bg: 'fungal', particles: 'spores', light: 'rgba(210,170,255,0.08)',
  },
  bastion: {
    sky: ['#2a1f15', '#110c08'], fog: 'rgba(230,160,90,0.08)', rock: '#120e0b', rockHi: '#2a2016',
    rim: '#b5824a', accent: '#f0b060', glow: '#ffd08a', decorTop: 'bolts', decorBottom: 'pipes',
    bg: 'gears', particles: 'sparks', light: 'rgba(255,190,110,0.07)',
  },
  cistern: {
    sky: ['#0e1d33', '#050a14'], fog: 'rgba(90,150,230,0.10)', rock: '#08101c', rockHi: '#132339',
    rim: '#4f7fb3', accent: '#7fc4ff', glow: '#bfe4ff', decorTop: 'barnacles', decorBottom: 'drips',
    bg: 'aqueduct', particles: 'bubbles', light: 'rgba(120,190,255,0.08)',
  },
  kilns: {
    sky: ['#2b100b', '#100403'], fog: 'rgba(255,110,60,0.10)', rock: '#140806', rockHi: '#2f130d',
    rim: '#c45a33', accent: '#ff8a3d', glow: '#ffb070', decorTop: 'glass', decorBottom: 'slag',
    bg: 'furnace', particles: 'embers', light: 'rgba(255,120,60,0.10)',
  },
  mirror: {
    sky: ['#2a1a2e', '#0f0812'], fog: 'rgba(255,190,230,0.10)', rock: '#140b17', rockHi: '#2d1c33',
    rim: '#c792c9', accent: '#ffd0f2', glow: '#fff0fb', decorTop: 'crystals', decorBottom: 'crystals',
    bg: 'prisms', particles: 'glitter', light: 'rgba(255,200,240,0.08)',
  },
  bellfry: {
    sky: ['#3c4a63', '#1a2133'], fog: 'rgba(230,235,255,0.12)', rock: '#161a26', rockHi: '#2b3247',
    rim: '#a9b4d0', accent: '#ffe7b0', glow: '#fff5d6', decorTop: 'tiles', decorBottom: 'icicles',
    bg: 'clouds', particles: 'wind', light: 'rgba(255,245,220,0.08)',
  },
  archive: {
    sky: ['#191733', '#0a0918'], fog: 'rgba(160,150,255,0.09)', rock: '#0e0c1d', rockHi: '#211d3f',
    rim: '#8079c9', accent: '#e7c96a', glow: '#fff1b5', decorTop: 'books', decorBottom: 'threads',
    bg: 'library', particles: 'pages', light: 'rgba(230,210,140,0.07)',
  },
  warrens: {
    sky: ['#161a0c', '#070904'], fog: 'rgba(170,200,80,0.08)', rock: '#0b0d05', rockHi: '#1c220d',
    rim: '#6f7f2e', accent: '#c7e04a', glow: '#e8ff88', decorTop: 'eggs', decorBottom: 'webs',
    bg: 'hive', particles: 'spores', light: 'rgba(200,240,80,0.06)',
  },
  frost: {
    sky: ['#16293a', '#081119'], fog: 'rgba(190,240,255,0.12)', rock: '#0a141d', rockHi: '#18303f',
    rim: '#8fd0e8', accent: '#d8f6ff', glow: '#eefcff', decorTop: 'snow', decorBottom: 'icicles',
    bg: 'iceshrine', particles: 'snow', light: 'rgba(210,245,255,0.09)',
  },
  loom: {
    sky: ['#0d0d10', '#020203'], fog: 'rgba(220,220,230,0.06)', rock: '#050506', rockHi: '#141418',
    rim: '#6d6d78', accent: '#f2f2f7', glow: '#ffffff', decorTop: 'threads', decorBottom: 'threads',
    bg: 'looms', particles: 'lint', light: 'rgba(255,255,255,0.05)',
  },
  cradle: {
    sky: ['#2c3247', '#0f1220'], fog: 'rgba(230,235,255,0.12)', rock: '#12141f', rockHi: '#2a2f45',
    rim: '#c8cde6', accent: '#ffffff', glow: '#f4f6ff', decorTop: 'threads', decorBottom: 'threads',
    bg: 'moonsky', particles: 'glitter', light: 'rgba(240,245,255,0.10)',
  },
  unwoven: {
    sky: ['#0a0612', '#000000'], fog: 'rgba(160,60,200,0.08)', rock: '#05020a', rockHi: '#170a24',
    rim: '#7a3fa8', accent: '#d07bff', glow: '#f0c8ff', decorTop: 'threads', decorBottom: 'threads',
    bg: 'void', particles: 'void', light: 'rgba(200,100,255,0.06)',
  },
  dunes: {
    sky: ['#3a3020', '#17120a'], fog: 'rgba(240,220,170,0.12)', rock: '#18130b', rockHi: '#33291a',
    rim: '#c9ad78', accent: '#ffe3a0', glow: '#fff1c8', decorTop: 'lint', decorBottom: 'drips',
    bg: 'dunes', particles: 'lint', light: 'rgba(255,230,170,0.08)',
  },
  echoes: {
    sky: ['#24223a', '#0b0a16'], fog: 'rgba(255,240,200,0.10)', rock: '#100f1a', rockHi: '#25233a',
    rim: '#d8c48e', accent: '#ffe6a6', glow: '#fff4d2', decorTop: 'tiles', decorBottom: 'threads',
    bg: 'temple', particles: 'glitter', light: 'rgba(255,235,190,0.09)',
  },
};

// Per-area colors for the '!' hazard liquid: [body, surface]
const ACID = {
  kilns: ['rgba(255,104,36,0.78)', 'rgba(255,224,150,0.95)'],
  warrens: ['rgba(90,140,20,0.7)', 'rgba(210,255,90,0.85)'],
  archive: ['rgba(14,12,40,0.85)', 'rgba(140,130,255,0.8)'],
  cistern: ['rgba(18,10,40,0.8)', 'rgba(170,120,255,0.8)'],
  unwoven: ['rgba(40,0,60,0.8)', 'rgba(220,120,255,0.9)'],
  loom: ['rgba(8,8,10,0.9)', 'rgba(240,240,250,0.8)'],
};
for (const [k, v] of Object.entries(ACID)) if (STYLES[k]) STYLES[k].acid = v;

export function styleFor(area) {
  return STYLES[area] || STYLES.fray;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
