// Hand-drawn post-process (WebGL): the world layer is "boiled" (redrawn with a slightly different
// wobble ~8 times a second, like hand-animated linework), edges pool ink, and everything sits on
// textured paper. The UI layer is composited on top untouched so text stays crisp.
const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `
precision mediump float;
uniform sampler2D uWorld;
uniform sampler2D uUI;
uniform vec2 uRes;
uniform float uSeed;
uniform float uBoil;
uniform float uInk;
uniform float uPaper;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
void main() {
  vec2 px = 1.0 / uRes;
  vec2 P = vUv * uRes;
  // boil: a low-frequency displacement field, reseeded a few times a second
  vec2 q = P / (7.0 * uRes.x / 960.0);
  vec2 d = vec2(noise(q + uSeed * 17.31), noise(q + vec2(41.7, 13.1) + uSeed * 9.73)) - 0.5;
  vec2 uv = vUv + d * px * uBoil;
  vec4 c = texture2D(uWorld, uv);
  // ink pooling: darken where luminance changes sharply (thickens and roughens the ink lines)
  float s = uRes.x / 960.0;
  float l = lum(c.rgb);
  float lx = lum(texture2D(uWorld, uv + vec2(px.x * s, 0.0)).rgb);
  float ly = lum(texture2D(uWorld, uv + vec2(0.0, px.y * s)).rgb);
  float lx2 = lum(texture2D(uWorld, uv - vec2(px.x * s, 0.0)).rgb);
  float ly2 = lum(texture2D(uWorld, uv - vec2(0.0, px.y * s)).rgb);
  float e = clamp((abs(l - lx) + abs(l - ly) + abs(l - lx2) + abs(l - ly2)) * 1.6, 0.0, 1.0);
  float rough = 0.75 + 0.5 * noise(P / (3.0 * s) + uSeed * 3.0);
  c.rgb *= 1.0 - e * uInk * rough;
  // paper: broad mottling, fibres and fine grain
  vec2 pp = P / s;
  float mott = noise(pp / 220.0) * 0.6 + noise(pp / 60.0) * 0.4;
  float fib = noise(vec2(pp.x / 3.0, pp.y / 40.0)) * noise(vec2(pp.x / 40.0, pp.y / 3.0));
  float paper = 1.0 - uPaper * (0.10 * (1.0 - mott) + 0.05 * fib);
  float grain = (hash(floor(pp) + floor(uSeed * 7.0)) - 0.5) * 0.045 * uPaper;
  c.rgb = c.rgb * paper + grain;
  // gentle print tint: lift the blacks to ink, warm the lights
  c.rgb = mix(vec3(lum(c.rgb)), c.rgb, 0.82);
  c.rgb = mix(vec3(0.035, 0.03, 0.045), vec3(1.0, 0.985, 0.95), c.rgb);
  vec4 ui = texture2D(uUI, vUv);
  gl_FragColor = vec4(mix(c.rgb, ui.rgb, ui.a), 1.0);
}`;

export class PostFX {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = [0, 1].map((i) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    gl.uniform1i(gl.getUniformLocation(prog, 'uWorld'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uUI'), 1);
    this.u = {};
    for (const n of ['uRes', 'uSeed', 'uBoil', 'uInk', 'uPaper']) this.u[n] = gl.getUniformLocation(prog, n);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.seed = 0; this.seedT = 0;
    this.boil = 2.4; this.ink = 0.42; this.paper = 1;
  }

  render(world, ui, dt) {
    const gl = this.gl;
    this.seedT += dt;
    if (this.seedT > 1 / 8) { this.seedT = 0; this.seed = (this.seed + 1) % 3; } // three alternating "drawings"
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ui);
    gl.uniform2f(this.u.uRes, world.width, world.height);
    gl.uniform1f(this.u.uSeed, this.seed + 1);
    gl.uniform1f(this.u.uBoil, this.boil * world.width / 960);
    gl.uniform1f(this.u.uInk, this.ink);
    gl.uniform1f(this.u.uPaper, this.paper);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
