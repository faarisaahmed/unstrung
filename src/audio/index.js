// Audio facade used by the app/game.
import { AudioEngine } from './engine.js';
import { Music } from './music.js';
import { SFX } from './sfx.js';

export class Audio {
  constructor() {
    this.engine = new AudioEngine();
    this.music = new Music(this.engine);
    this.fx = new SFX(this.engine);
    this.pending = null;
    const unlock = () => {
      this.engine.init();
      if (this.pending) { const p = this.pending; this.pending = null; this.music.play(p); }
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('gamepadconnected', unlock);
  }
  get settings() { return this.engine.settings; }
  applySettings() { this.engine.applySettings(); }
  sfx(name, k) { this.fx.play(name, k); }
  playMusic(id, opts) {
    if (!this.engine.ctx) { this.pending = id; return; }
    this.music.play(id, opts);
  }
  stopMusic(fade = 1) { this.pending = null; this.music.stop(fade); }
  get currentTrack() { return this.music.cur ? this.music.cur.id : this.pending; }
}
