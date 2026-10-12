// App: owns audio + scenes (title, game) and overlay menus (pause, map, inventory, bench).
import { Game } from './game/game.js';
import { newSave, loadSave, writeSave } from './game/save.js';
import { ENEMIES } from './data/enemies/index.js';
import { PAINTERS } from './art/creatures.js';
import { Audio } from './audio/index.js';

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
    if (q.get('room')) {
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
