export default [
  { id: 'lintmite', name: 'Lintmite', area: 'fray', hp: 8, dmg: 1, glints: 2, size: [26, 20], behavior: 'crawler', params: { speed: 45 },
    art: { body: 'mite', c1: '#9aa3b5', c2: '#c7d0e0', eye: '#ffffff' }, journal: 'Fluff given hunger. It wanders the Fray looking for anything soft to swallow.' },
  { id: 'stitchgrub', name: 'Stitchgrub', area: 'fray', hp: 12, dmg: 1, glints: 3, size: [34, 20], behavior: 'charger',
    art: { body: 'grub', c1: '#59627a', c2: '#8d9bb5', mask: true, c3: '#e9e4d6', eye: '#ffffff' }, journal: 'A grub sewn shut at the mouth. It runs headlong at anything that moves.' },
  { id: 'threadfly', name: 'Threadfly', area: 'fray', hp: 8, dmg: 1, glints: 2, size: [24, 20], behavior: 'flyer', params: { speed: 95 },
    art: { body: 'fly', c1: '#3b4152', c2: '#8d9bb5', eye: '#d9e6ff', centered: true, glow: true }, journal: 'It drinks the light from loose threads.' },
];
