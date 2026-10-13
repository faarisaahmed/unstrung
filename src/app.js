// App: owns audio, scenes (title, game, cutscenes) and overlays (pause, map, inventory, shop, ferry).
import { Game } from './game/game.js';
import { newSave, loadSave, writeSave } from './game/save.js';
import { ENEMIES } from './data/enemies/index.js';
import { PAINTERS } from './art/creatures.js';
import { Audio } from './audio/index.js';
import { ROOMS } from './data/world.js';
import { TitleScreen, PauseMenu } from './ui/screens.js';
import { InventoryScreen } from './ui/inventory.js';
import { MapScreen } from './ui/map.js';
import { ShopScreen, FerryScreen } from './ui/shop.js';
import { Cutscene } from './ui/cutscene.js';
import { INTRO, ENDINGS, CREDITS } from './data/story.js';

const ALL_AB = ['sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound', 'comet', 'dbljump', 'shrink', 'hook', 'unravel', 'lantern', 'howl'];

export class App {
  constructor(input, canvas) {
    this.input = input;
    this.canvas = canvas;
    this.enemyDefs = ENEMIES;
    this.painters = PAINTERS;
    this.audio = new Audio();
    this.overlay = null;
    this.scene = null;
    this.options = { shake: true, timer: false };
    try { Object.assign(this.options, JSON.parse(localStorage.getItem('unstrung_options') || '{}')); } catch { /* */ }

    const q = new URLSearchParams(location.search);
    if (q.get('boss')) this.debugBoss(q);
    else if (q.get('room')) this.debugRoom(q);
    else this.toTitle();
  }

  saveOptions() { try { localStorage.setItem('unstrung_options', JSON.stringify(this.options)); } catch { /* */ } }

  // ------------------------------------------------------------ scenes
  toTitle() {
    this.overlay = null;
    this.game = null;
    this.scene = new TitleScreen(this);
  }

  startNewGame(slot, opts = {}) {
    const save = newSave(slot, opts);
    writeSave(save);
    this.scene = new Cutscene(this, INTRO, {
      art: 'strand', music: 'title',
      onDone: () => this.startGame(save),
    });
  }

  startFromSave(save) { this.startGame(save); }

  startGame(save, debugDoor) {
    this.overlay = null;
    this.game = new Game(this, save, debugDoor);
    this.scene = this.game;
  }

  quitToTitle() {
    if (this.game) writeSave(this.game.save);
    this.audio.stopMusic(0.8);
    this.toTitle();
  }

  showCredits(fromEnding, after) {
    this.overlay = null;
    this.scene = new Cutscene(this, [], {
      credits: CREDITS, music: 'credits', art: 'moon',
      onDone: () => (after ? after() : this.toTitle()),
    });
  }

  // Called by final bosses: 'A' (Selene), 'B' (Hollow Thread), 'C' (First Bead)
  ending(kind) {
    const g = this.game;
    if (!g || this.endingRunning || g.echo) return;
    this.endingRunning = true;
    g.save.endings[kind] = 1;
    g.save.flags['ending_' + kind] = 1;
    writeSave(g.save);
    setTimeout(() => {
      const E = ENDINGS[kind] || { title: '', pages: [] };
      g.startFade(() => {
        this.overlay = null;
        this.scene = new Cutscene(this, E.pages, {
          title: E.title, art: kind === 'C' ? 'light' : kind === 'B' ? 'moon' : 'strand',
          music: kind === 'A' ? 'ending_a' : kind === 'B' ? 'ending_b' : 'credits',
          credits: CREDITS,
          onDone: () => {
            this.endingRunning = false;
            // the thread continues: back to the last spindle with the ending recorded
            const save = loadSave(g.save.slot) || g.save;
            save.hp = save.maxHp;
            this.startGame(save);
          },
        });
      }, 0.6);
    }, 3200);
  }

  // ------------------------------------------------------------ overlays
  closeOverlay() { this.overlay = null; this.input.eatAll(); }
  openPause() { this.overlay = new PauseMenu(this); }
  openMap() { this.overlay = new MapScreen(this); }
  openInventory(opts) { this.overlay = new InventoryScreen(this, opts); }
  openBench(spindle) { if (this.game) writeSave(this.game.save); this.overlay = new InventoryScreen(this, { tab: 1, bench: true }); }
  openShop(def) { this.overlay = new ShopScreen(this, def); }
  openFerry(ferry) { this.overlay = new FerryScreen(this, ferry); }

  // ------------------------------------------------------------ debug entry points
  debugRoom(q) {
    const save = newSave(9);
    save.room = q.get('room');
    const ab = q.get('ab');
    if (ab) for (const a of (ab === 'all' ? ALL_AB : ab.split(','))) save.abilities[a] = true;
    this.startGame(save, q.get('door'));
  }

  debugBoss(q) {
    const id = q.get('boss');
    const W = 56, H = 20;
    const rows = [];
    for (let y = 0; y < H; y++) {
      let r = '';
      for (let x = 0; x < W; x++) r += (x === 0 || x === W - 1 || y === 0 || y >= H - 2) ? '#' : ' ';
      rows.push(r);
    }
    const put = (x, y, str) => { rows[y] = rows[y].slice(0, x) + str + rows[y].slice(x + str.length); };
    put(10, H - 7, '======'); put(W - 16, H - 7, '======'); put(24, H - 11, '========');
    put(6, H - 3, '@');
    put(W - 12, H - 3, 'K');
    ROOMS.__arena = { id: '__arena', area: q.get('area') || 'echoes', tiles: rows, legend: { K: { e: 'boss', id } }, doors: {} };
    const save = newSave(9);
    save.room = '__arena';
    const ab = q.get('ab') ?? 'all';
    if (ab) for (const a of (ab === 'all' ? ALL_AB : ab.split(','))) save.abilities[a] = true;
    save.hp = save.maxHp = 9; save.thread = 99;
    this.startGame(save);
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    if (this.overlay) { this.overlay.update(dt); return; }
    this.scene && this.scene.update(dt);
  }

  draw(ctx, ui) {
    ui = ui || ctx;
    this.scene && this.scene.draw(ctx, ui);
    if (this.overlay) this.overlay.draw(ui);
  }
}
