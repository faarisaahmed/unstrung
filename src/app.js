// App: owns audio + scenes (title, game) and overlay menus (pause, map, inventory, bench).
import { Game } from './game/game.js';
import { newSave, loadSave, writeSave } from './game/save.js';
import { ENEMIES } from './data/enemies/index.js';
import { PAINTERS } from './art/creatures.js';

export class App {
  constructor(input, canvas) {
    this.input = input;
    this.canvas = canvas;
    this.enemyDefs = ENEMIES;
    this.painters = PAINTERS;
    this.audio = null;
    this.overlay = null;
    this.scene = null;
    this.startGame(newSave(0));
  }

  startGame(save) {
    this.game = new Game(this, save);
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
