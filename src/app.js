// App: owns audio + scenes (title, game) and overlay menus (pause, map, inventory, bench).
import { Game } from './game/game.js';
import { newSave, loadSave, writeSave } from './game/save.js';
import { ENEMIES } from './data/enemies/index.js';
import { PAINTERS } from './art/creatures.js';
import { Audio } from './audio/index.js';
import { ROOMS } from './data/world.js';

export class App {
  constructor(input, canvas) {
    this.input = input;
    this.canvas = canvas;
    this.enemyDefs = ENEMIES;
    this.painters = PAINTERS;
    this.audio = new Audio();
    this.overlay = null;
    this.scene = null;
    // Debug: ?room=<id>&ab=sap,dash|all&door=<id>
    const q = new URLSearchParams(location.search);
    const save = newSave(0);
    if (q.get('boss')) {
      // Boss test arena: ?boss=<id>&ab=...
      const id = q.get('boss');
      const W = 56, H = 20;
      const rows = [];
      for (let y = 0; y < H; y++) {
        let r = '';
        for (let x = 0; x < W; x++) {
          const edge = x === 0 || x === W - 1 || y === 0 || y >= H - 2;
          r += edge ? '#' : ' ';
        }
        rows.push(r);
      }
      const put = (x, y, str) => { rows[y] = rows[y].slice(0, x) + str + rows[y].slice(x + str.length); };
      put(10, H - 7, '======'); put(W - 16, H - 7, '======'); put(24, H - 11, '========');
      put(4, H - 3, 'K'.replace('K', ' '));
      put(6, H - 3, '@');
      put(W - 12, H - 3, 'K');
      ROOMS['__arena'] = { id: '__arena', area: q.get('area') || 'echoes', tiles: rows, legend: { K: { e: 'boss', id } }, doors: {} };
      save.room = '__arena';
      const ab = q.get('ab') || 'all';
      const ALL = ['sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound', 'comet', 'dbljump', 'shrink', 'hook', 'unravel', 'lantern', 'howl'];
      for (const a of (ab === 'all' ? ALL : ab.split(','))) save.abilities[a] = true;
      save.hp = save.maxHp = 9; save.thread = 99;
    } else if (q.get('room')) {
      save.room = q.get('room');
      const ab = q.get('ab');
      const ALL = ['sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound', 'comet', 'dbljump', 'shrink', 'hook', 'unravel', 'lantern', 'howl'];
      if (ab) for (const a of (ab === 'all' ? ALL : ab.split(','))) save.abilities[a] = true;
      this.debugDoor = q.get('door');
    }
    this.startGame(save);
  }

  startGame(save) {
    this.game = new Game(this, save, this.debugDoor);
    this.scene = this.game;
  }

  toTitle() { /* title screen comes later */ }

  openBench(spindle) { if (this.game) writeSave(this.game.save); }
  openFerry(ferry) {}

  update(dt) {
    if (this.overlay) { this.overlay.update(dt); return; }
    this.scene && this.scene.update(dt);
  }

  draw(ctx) {
    this.scene && this.scene.draw(ctx);
    if (this.overlay) this.overlay.draw(ctx);
  }
}
