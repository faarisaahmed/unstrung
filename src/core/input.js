// Keyboard + gamepad input with edge detection. Call input.update() once per fixed tick.
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  focus: ['KeyF', 'KeyL'],
  ability: ['KeyV', 'KeyI'],
  map: ['Tab', 'KeyM'],
  inventory: ['KeyE', 'KeyQ'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'KeyZ', 'Space'],
  back: ['Escape', 'Backspace'],
};
// WASD conflicts with letter actions on some layouts; A is left so focus uses F/L.

const PAD = {
  jump: [0], attack: [2], dash: [5, 1], focus: [3], ability: [4],
  map: [8], inventory: [7], pause: [9], confirm: [0], back: [1],
  up: [12], down: [13], left: [14], right: [15],
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.state = {};
    this.prev = {};
    this.actions = Object.keys(KEYMAP);
    for (const a of this.actions) { this.state[a] = false; this.prev[a] = false; }
    this.axisX = 0; this.axisY = 0;
    this.anyPressed = false;
    this.lastDevice = 'keyboard';
    this.virtual = null; // for scripted/automated play: {action:true}
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  update() {
    for (const a of this.actions) this.prev[a] = this.state[a];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    let ax = 0, ay = 0;
    if (pad) {
      ax = Math.abs(pad.axes[0]) > 0.35 ? pad.axes[0] : 0;
      ay = Math.abs(pad.axes[1]) > 0.5 ? pad.axes[1] : 0;
    }
    this.anyPressed = false;
    for (const a of this.actions) {
      let v = KEYMAP[a].some((k) => this.keys.has(k));
      if (pad && PAD[a]) {
        const pv = PAD[a].some((i) => pad.buttons[i] && pad.buttons[i].pressed);
        if (pv) { v = true; this.lastDevice = 'pad'; }
      }
      if (a === 'left' && ax < 0) v = true;
      if (a === 'right' && ax > 0) v = true;
      if (a === 'up' && ay < 0) v = true;
      if (a === 'down' && ay > 0) v = true;
      if (this.virtual && this.virtual[a]) v = true;
      this.state[a] = v;
      if (v && !this.prev[a]) this.anyPressed = true;
    }
    this.axisX = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    this.axisY = (this.state.down ? 1 : 0) - (this.state.up ? 1 : 0);
  }

  down(a) { return this.state[a]; }
  pressed(a) { return this.state[a] && !this.prev[a]; }
  released(a) { return !this.state[a] && this.prev[a]; }
  // Consume a press so it doesn't trigger twice across UI layers
  eat(a) { this.prev[a] = this.state[a]; }
  eatAll() { for (const a of this.actions) this.prev[a] = this.state[a]; }
}
