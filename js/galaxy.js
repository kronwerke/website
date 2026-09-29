// The background: a spiral galaxy simulated with the density wave model, a few distant
// galaxies, a star field and emission nebulae, rendered in HDR with bloom.
//
// Density waves: every star moves on an ellipse around the centre. The ellipses are
// rotated a little more the further out they are, and stars further out move slower
// (a flat rotation curve). Where neighbouring ellipses crowd together the stars bunch
// up, and those crowds are the spiral arms. The arms stay while every single star keeps
// moving through them, which is how real spiral galaxies behave.
//
// Plain WebGL2, no library. Without WebGL2 the page keeps its CSS background.

(function () {
  "use strict";

  const canvas = document.getElementById("sky");
  if (!canvas) return;
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return;
  const hdr = !!gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("OES_texture_float_linear");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const topView = /[?&]top\b/.test(location.search); // straight down on the disk, for checking the arms
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const STARS = small ? 60000 : 150000;
  const DUST = small ? 14000 : 36000;
  const FIELD = small ? 2500 : 5000;
  const FAR = 7;           // distant galaxies
  const FAR_STARS = small ? 1800 : 3500;

  // ---- small helpers ---------------------------------------------------------

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  // a seeded random source, so the galaxy looks the same on every visit
  let seed = 20270115;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // colour of a black body, roughly, for a temperature in kelvin
  function blackbody(t) {
    t /= 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.47 * Math.log(t) - 161.12;
      b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    } else {
      r = 329.7 * Math.pow(t - 60, -0.1332);
      g = 288.12 * Math.pow(t - 60, -0.0755);
      b = 255;
    }
    const c = (x) => Math.min(1, Math.max(0, x / 255));
    return [c(r), c(g), c(b)];
  }

  // ---- the particles -----------------------------------------------------------
  // per particle: a (orbit radius), phase, height, size, r, g, b, kind
  // kind: 0 old star, 0.5 young star, 1 H II region, 2 dust

  const RADIUS = 1.0;

  function disk(n) {
    const per = 8;
    const data = new Float32Array(n * per);
    for (let i = 0; i < n; i++) {
      const o = i * per;
      const bulge = rnd() < 0.18;
      // exponential disk, a bulge in the middle
      let a = bulge ? Math.abs(gauss()) * 0.09 : -Math.log(1 - rnd() * 0.985) * 0.33;
      a = Math.min(a, RADIUS * 1.15);
      data[o] = a;
      data[o + 1] = rnd() * Math.PI * 2;
      const thick = bulge ? 0.06 * Math.exp(-a * 8) + 0.012 : 0.012 * (1 + a);
      data[o + 2] = gauss() * thick;
      // old yellow stars in the bulge, a mix in the disk, a few hot blue ones
      let temp;
      const r = rnd();
      let young = false;
      if (bulge || a < 0.1) temp = 3300 + rnd() * 2600;
      else if (r < 0.14) { temp = 9000 + rnd() * 16000; young = true; }
      else if (r < 0.4) temp = 5200 + rnd() * 2500;
      else temp = 3000 + rnd() * 2500;
      const c = blackbody(temp);
      let size = 0.8 + Math.pow(rnd(), 6) * 3.0;
      let bright = (0.45 + rnd() * 0.6) * starGain;
      if (temp > 9000) bright *= 1.6;
      if (bulge) bright *= 0.55;
      data[o + 3] = size;
      data[o + 4] = c[0] * bright;
      data[o + 5] = c[1] * bright;
      data[o + 6] = c[2] * bright;
      data[o + 7] = young ? 0.5 : 0;
    }
    return data;
  }

  function regions(n) {
    // H II regions: glowing hydrogen around young stars, strung along the arms
    const per = 8;
    const data = new Float32Array(n * per);
    for (let i = 0; i < n; i++) {
      const o = i * per;
      data[o] = 0.14 + rnd() * 0.7;
      data[o + 1] = rnd() * Math.PI * 2;
      data[o + 2] = gauss() * 0.01;
      data[o + 3] = 1.8 + rnd() * 3.5;
      data[o + 4] = 0.7; data[o + 5] = 0.2; data[o + 6] = 0.26;
      data[o + 7] = 1;
    }
    return data;
  }

  function dust(n) {
    const per = 8;
    const data = new Float32Array(n * per);
    for (let i = 0; i < n; i++) {
      const o = i * per;
      data[o] = 0.08 + Math.pow(rnd(), 0.8) * 0.85;
      data[o + 1] = rnd() * Math.PI * 2;
      data[o + 2] = gauss() * 0.006;
      data[o + 3] = 3 + Math.pow(rnd(), 2) * 12;
      // absorbs blue more than red, like real dust
      const k = 0.05 + rnd() * 0.12;
      data[o + 4] = k * 0.7; data[o + 5] = k * 0.85; data[o + 6] = k;
      data[o + 7] = 2;
    }
    return data;
  }

  function concat(arrays) {
    let len = 0;
    for (const a of arrays) len += a.length;
    const out = new Float32Array(len);
    let at = 0;
    for (const a of arrays) { out.set(a, at); at += a.length; }
    return out;
  }

  const HII = small ? 500 : 1400;
  const starGain = 0.3;
  const hazeGain = 0.04;
  const mainStars = disk(STARS);
  const mainRegions = regions(HII);
  const mainDust = dust(DUST);
  const farStars = disk(FAR_STARS * FAR);

  const galaxyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, galaxyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, concat([mainStars, mainRegions, mainDust, farStars]), gl.STATIC_DRAW);
  const RANGE = {
    stars: [0, STARS],
    regions: [STARS, HII],
    dust: [STARS + HII, DUST],
    far: [STARS + HII + DUST, FAR_STARS * FAR],
  };

  const galaxyVao = gl.createVertexArray();
  gl.bindVertexArray(galaxyVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindVertexArray(null);

  // distant galaxies: where they sit, how they are turned, how big
  const far = [];
  for (let i = 0; i < FAR; i++) {
    far.push({
      pos: [(rnd() - 0.5) * 9, (rnd() - 0.5) * 4.5, -3.5 - rnd() * 5],
      tilt: 0.3 + rnd() * 1.1,
      spin: rnd() * Math.PI * 2,
      scale: 0.12 + rnd() * 0.22,
      twist: 2 + rnd() * 5,
      speed: 0.4 + rnd() * 0.6,
    });
  }

  // a star field far behind everything
  const field = new Float32Array(FIELD * 8);
  for (let i = 0; i < FIELD; i++) {
    const o = i * 8;
    // uniform on a sphere
    const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    field[o] = s * Math.cos(t) * 40; field[o + 1] = s * Math.sin(t) * 40; field[o + 2] = z * 40;
    field[o + 3] = 0.6 + Math.pow(rnd(), 6) * 2.4;
    const c = blackbody(3200 + rnd() * 9000);
    const b = 0.15 + Math.pow(rnd(), 3) * 0.9;
    field[o + 4] = c[0] * b; field[o + 5] = c[1] * b; field[o + 6] = c[2] * b;
    field[o + 7] = rnd() * 100;
  }
  const fieldBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fieldBuf);
  gl.bufferData(gl.ARRAY_BUFFER, field, gl.STATIC_DRAW);
  const fieldVao = gl.createVertexArray();
  gl.bindVertexArray(fieldVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindVertexArray(null);

  const quadVao = gl.createVertexArray(); // full screen triangle from gl_VertexID

  // ---- shaders -----------------------------------------------------------------

  const galaxyVS = `#version 300 es
  layout(location=0) in vec4 aOrbit;   // a, phase, height, size
  layout(location=1) in vec4 aColor;   // rgb, kind
  uniform mat4 uView, uProj;
  uniform float uTime, uTwist, uScale, uSpeed, uPixel, uFar, uHaze, uHazeGain, uPeak;
  uniform vec3 uCenter;
  uniform mat3 uTurn;
  out vec3 vColor;
  out float vKind;
  // round in the core, elongated where the arms are, round again at the rim
  float ecc(float a) {
    if (a < 0.1) return mix(1.0, 0.62, a / 0.1);
    if (a < 0.7) return 0.62;
    return mix(0.62, 1.0, clamp((a - 0.7) / 0.4, 0.0, 1.0));
  }
  void main() {
    float a = aOrbit.x;
    float kind = aColor.w;
    // flat rotation curve: the angular speed falls off with the radius
    float omega = uSpeed * 0.9 / (a + 0.06);
    float t = aOrbit.y + uTime * omega;
    // every orbit is tilted a little off the ideal, or the arms would look drawn
    float jitter = (fract(sin(aOrbit.y * 91.37) * 43758.545) - 0.5) * 0.16;
    float tilt = a * uTwist + jitter;
    // where on its ellipse the star is decides whether it is in an arm right now:
    // the ellipses crowd at the same point of every orbit, and that crowd is the arm
    float arm = pow(max(0.0, cos(2.0 * (t - uPeak))), 6.0);
    // dust sits on the inner edge of the arms, just before the stars pile up
    float lane = pow(max(0.0, cos(2.0 * (t - uPeak + 0.22 + jitter * 1.4))), 4.0);
    float b = a * ecc(a);
    vec2 e = vec2(a * cos(t), b * sin(t));
    float c = cos(tilt), s = sin(tilt);
    vec3 p = vec3(c * e.x - s * e.y, aOrbit.z, s * e.x + c * e.y);
    p = uTurn * (p * uScale) + uCenter;
    vec4 view = uView * vec4(p, 1.0);
    gl_Position = uProj * view;
    float dist = max(0.05, -view.z);
    float size = aOrbit.w * uPixel / dist;
    vec3 col = aColor.rgb;
    if (kind < 0.25) {
      col *= 0.7 + 0.6 * arm;                 // old stars: everywhere, a little brighter in the arms
    } else if (kind < 0.75) {
      col *= 0.12 + 2.4 * arm;                // young hot stars: born in the arms
    } else if (kind < 1.5) {
      // H II regions: glowing gas around new stars, only in the arms, each on its own clock
      float life = fract(uTime * 0.02 + aOrbit.y * 1.7);
      col *= arm * smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life)) * 2.6;
    } else {
      col *= 0.12 + 1.3 * lane;
    }
    if (uFar > 0.5) { col *= 0.35; }
    // the haze pass draws every star again, large and faint: the unresolved light
    // of billions of stars that makes a galaxy glow instead of sparkle
    if (uHaze > 0.5) { size = 22.0 * uPixel / dist; col *= uHazeGain; }
    gl_PointSize = clamp(size, 0.8, (kind > 1.5 || uHaze > 0.5) ? 90.0 : 36.0);
    vColor = col;
    vKind = kind;
  }`;

  const galaxyFS = `#version 300 es
  precision highp float;
  in vec3 vColor;
  in float vKind;
  uniform float uHazeF;
  out vec4 o;
  void main() {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(d, d);
    if (r2 > 1.0) discard;
    // a soft core with a faint wide halo, like a star through a telescope
    float core = exp(-r2 * 7.0);
    float halo = exp(-r2 * 2.2) * 0.18;
    float k = (vKind > 1.5 || uHazeF > 0.5) ? exp(-r2 * 2.5) : core + halo;
    o = vec4(vColor * k, 1.0);
  }`;

  const fieldVS = `#version 300 es
  layout(location=0) in vec4 aPos;
  layout(location=1) in vec4 aColor;
  uniform mat4 uView, uProj;
  uniform float uTime, uPixel;
  out vec3 vColor;
  void main() {
    vec4 v = uView * vec4(aPos.xyz, 0.0); // direction only: the field does not move with the camera
    gl_Position = uProj * vec4(v.xyz, 1.0);
    gl_Position.z = gl_Position.w * 0.9999;
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + fract(aColor.w) * 1.4) + aColor.w * 7.0);
    vColor = aColor.rgb * twinkle;
    gl_PointSize = aPos.w * uPixel * 0.0022;
  }`;

  const fieldFS = `#version 300 es
  precision highp float;
  in vec3 vColor;
  out vec4 o;
  void main() {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(d, d);
    if (r2 > 1.0) discard;
    o = vec4(vColor * exp(-r2 * 6.0), 1.0);
  }`;

  const quadVS = `#version 300 es
  out vec2 vUv;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  // emission nebulae: domain warped noise, hydrogen red with oxygen teal at the edges
  const nebulaFS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform float uTime, uAspect;
  uniform vec2 uLook;
  out vec4 o;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0) + uLook;
    vec3 p = vec3(uv * 1.6, uTime * 0.006);
    vec3 q = vec3(fbm(p + vec3(0.0, 0.0, 0.0)), fbm(p + vec3(5.2, 1.3, 2.8)), 0.0);
    float n = fbm(p + 2.2 * q);
    float gas = smoothstep(0.5, 0.9, n) * smoothstep(0.35, 0.75, fbm(p * 4.0 + q * 2.0));
    float thin = smoothstep(0.6, 0.92, fbm(p * 2.6 - q + 3.0));
    // one cloud on the upper left, fading out elsewhere
    float place = smoothstep(1.1, 0.0, length(uv - vec2(-0.6, 0.42)));
    vec3 ha = vec3(0.62, 0.13, 0.11);
    vec3 oiii = vec3(0.10, 0.34, 0.36);
    vec3 col = ha * gas * 0.55 + oiii * thin * (1.0 - gas) * 0.28;
    // dark lanes of dust inside the cloud
    float lane = smoothstep(0.5, 0.75, fbm(p * 3.1 + q * 1.5 + 11.0));
    col *= 1.0 - lane * 0.8;
    o = vec4(col * place * 0.42, 1.0);
  }`;

  const brightFS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uSrc;
  out vec4 o;
  void main() {
    vec3 c = texture(uSrc, vUv).rgb;
    float l = max(max(c.r, c.g), c.b);
    o = vec4(c * smoothstep(0.55, 1.6, l), 1.0);
  }`;

  const blurFS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uSrc;
  uniform vec2 uDir;
  out vec4 o;
  void main() {
    vec3 c = texture(uSrc, vUv).rgb * 0.227;
    c += texture(uSrc, vUv + uDir * 1.385).rgb * 0.316;
    c += texture(uSrc, vUv - uDir * 1.385).rgb * 0.316;
    c += texture(uSrc, vUv + uDir * 3.231).rgb * 0.070;
    c += texture(uSrc, vUv - uDir * 3.231).rgb * 0.070;
    o = vec4(c, 1.0);
  }`;

  const finalFS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uScene, uB1, uB2, uB3, uB4;
  uniform float uTime, uExposure;
  out vec4 o;
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  void main() {
    vec3 c = texture(uScene, vUv).rgb;
    c += texture(uB1, vUv).rgb * 0.35 + texture(uB2, vUv).rgb * 0.3 + texture(uB3, vUv).rgb * 0.3 + texture(uB4, vUv).rgb * 0.35;
    c = aces(c * uExposure);
    // a slight vignette, and grain so the dark areas do not band
    vec2 d = vUv - 0.5;
    c *= 1.0 - dot(d, d) * 0.55;
    float g = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    c += (g - 0.5) / 255.0 * 1.5;
    c = pow(c, vec3(1.0 / 2.2));
    // a faint lift instead of pure black
    c = max(c, vec3(0.055, 0.047, 0.063));
    o = vec4(c, 1.0);
  }`;

  let galaxyProg, fieldProg, nebulaProg, brightProg, blurProg, finalProg;
  try {
    galaxyProg = program(galaxyVS, galaxyFS);
    fieldProg = program(fieldVS, fieldFS);
    nebulaProg = program(quadVS, nebulaFS);
    brightProg = program(quadVS, brightFS);
    blurProg = program(quadVS, blurFS);
    finalProg = program(quadVS, finalFS);
  } catch (e) {
    console.warn("sky:", e);
    return;
  }

  // ---- render targets ------------------------------------------------------------

  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  let W = 0, H = 0, scene, levels = [];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = w; canvas.height = h;
    scene = target(w, h);
    levels = [];
    let lw = w, lh = h;
    for (let i = 0; i < 4; i++) {
      lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
      levels.push({ a: target(lw, lh), b: target(lw, lh) });
    }
    draw(lastTime);
  }

  // ---- matrices ------------------------------------------------------------------

  function perspective(fov, aspect, near, farZ) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - farZ);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (farZ + near) * nf, -1, 0, 0, 2 * farZ * near * nf, 0]);
  }
  function lookAt(eye, at, up) {
    const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  function turn(tilt, spin) {
    // rotate about y (spin), then about x (tilt)
    const cs = Math.cos(spin), ss = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
    return new Float32Array([cs, st * ss, -ct * ss, 0, ct, st, ss, -st * cs, ct * cs]);
  }

  // ---- drawing -------------------------------------------------------------------

  let scroll = 0, pointer = [0, 0], smooth = [0, 0];
  window.addEventListener("scroll", () => { scroll = window.scrollY / Math.max(1, window.innerHeight); }, { passive: true });
  window.addEventListener("pointermove", (e) => {
    pointer = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
  }, { passive: true });

  function quad(prog, fb, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function bind(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  let lastTime = 0;
  function draw(time) {
    if (!scene) return;
    const t = time;
    const aspect = W / H;
    const wide = aspect > 1.1;
    smooth[0] += (pointer[0] - smooth[0]) * 0.04;
    smooth[1] += (pointer[1] - smooth[1]) * 0.04;

    // the camera looks down at the disk from above the plane and drifts with the scroll
    const s = Math.min(scroll, 4);
    const elev = topView ? 1.45 : 0.55 + s * 0.08 + smooth[1] * 0.05;
    const az = 0.4 + s * 0.22 + smooth[0] * 0.08;
    const dist = (wide ? 2.6 : 3.3) - Math.min(s, 1.5) * 0.3;
    const eye = [Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist];
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    // the galaxy sits right of centre on wide screens so the text has room on the left
    const proj = perspective(0.9, aspect, 0.02, 100);
    if (wide) proj[8] = -0.36;
    else proj[9] = -0.66; // on tall screens above the text, in the empty top of the hero

    gl.disable(gl.DEPTH_TEST);

    // nebula into the scene
    gl.disable(gl.BLEND);
    gl.useProgram(nebulaProg.p);
    gl.uniform1f(nebulaProg.u.uTime, t);
    gl.uniform1f(nebulaProg.u.uAspect, aspect);
    gl.uniform2f(nebulaProg.u.uLook, az * 0.25, elev * 0.2);
    quad(nebulaProg, scene.fb, W, H);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // star field
    gl.useProgram(fieldProg.p);
    gl.uniformMatrix4fv(fieldProg.u.uView, false, view);
    gl.uniformMatrix4fv(fieldProg.u.uProj, false, proj);
    gl.uniform1f(fieldProg.u.uTime, t);
    gl.uniform1f(fieldProg.u.uPixel, H);
    gl.bindVertexArray(fieldVao);
    gl.drawArrays(gl.POINTS, 0, FIELD);

    // galaxies
    gl.useProgram(galaxyProg.p);
    gl.uniformMatrix4fv(galaxyProg.u.uView, false, view);
    gl.uniformMatrix4fv(galaxyProg.u.uProj, false, proj);
    gl.uniform1f(galaxyProg.u.uTime, t);
    gl.uniform1f(galaxyProg.u.uPixel, H * 0.0028);
    gl.bindVertexArray(galaxyVao);

    gl.uniform1f(galaxyProg.u.uPeak, 2.26);
    for (let i = 0; i < far.length; i++) {
      const g = far[i];
      gl.uniform3fv(galaxyProg.u.uCenter, g.pos);
      gl.uniformMatrix3fv(galaxyProg.u.uTurn, false, turn(g.tilt, g.spin));
      gl.uniform1f(galaxyProg.u.uScale, g.scale);
      gl.uniform1f(galaxyProg.u.uTwist, g.twist);
      gl.uniform1f(galaxyProg.u.uSpeed, g.speed * 0.02);
      gl.uniform1f(galaxyProg.u.uFar, 1);
      gl.uniform1f(galaxyProg.u.uHaze, 0);
      gl.uniform1f(galaxyProg.u.uHazeF, 0);
      gl.drawArrays(gl.POINTS, RANGE.far[0] + i * FAR_STARS, FAR_STARS);
    }

    gl.uniform3fv(galaxyProg.u.uCenter, [0, 0, 0]);
    gl.uniformMatrix3fv(galaxyProg.u.uTurn, false, turn(0, 0));
    gl.uniform1f(galaxyProg.u.uScale, 1);
    gl.uniform1f(galaxyProg.u.uTwist, 5.5);
    gl.uniform1f(galaxyProg.u.uPeak, 2.26);
    gl.uniform1f(galaxyProg.u.uSpeed, 0.018);
    gl.uniform1f(galaxyProg.u.uFar, 0);
    // one star in five is enough for the haze; the stars are in random order
    gl.uniform1f(galaxyProg.u.uHaze, 1);
    gl.uniform1f(galaxyProg.u.uHazeF, 1);
    gl.uniform1f(galaxyProg.u.uHazeGain, hazeGain);
    gl.drawArrays(gl.POINTS, RANGE.stars[0], Math.floor(RANGE.stars[1] / 5));
    gl.uniform1f(galaxyProg.u.uHaze, 0);
    gl.uniform1f(galaxyProg.u.uHazeF, 0);
    gl.drawArrays(gl.POINTS, RANGE.stars[0], RANGE.stars[1]);
    gl.drawArrays(gl.POINTS, RANGE.regions[0], RANGE.regions[1]);
    // dust darkens what is behind it
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    gl.drawArrays(gl.POINTS, RANGE.dust[0], RANGE.dust[1]);
    gl.disable(gl.BLEND);

    // bloom
    gl.useProgram(brightProg.p);
    bind(0, scene.tex, brightProg.u.uSrc);
    quad(brightProg, levels[0].a.fb, levels[0].a.w, levels[0].a.h);
    for (let i = 0; i < levels.length; i++) {
      const L = levels[i];
      if (i > 0) {
        gl.useProgram(blurProg.p);
        bind(0, levels[i - 1].a.tex, blurProg.u.uSrc);
        gl.uniform2f(blurProg.u.uDir, 0, 0);
        quad(blurProg, L.a.fb, L.a.w, L.a.h);
      }
      gl.useProgram(blurProg.p);
      bind(0, L.a.tex, blurProg.u.uSrc);
      gl.uniform2f(blurProg.u.uDir, 1 / L.a.w, 0);
      quad(blurProg, L.b.fb, L.b.w, L.b.h);
      bind(0, L.b.tex, blurProg.u.uSrc);
      gl.uniform2f(blurProg.u.uDir, 0, 1 / L.a.h);
      quad(blurProg, L.a.fb, L.a.w, L.a.h);
    }

    gl.useProgram(finalProg.p);
    bind(0, scene.tex, finalProg.u.uScene);
    bind(1, levels[0].a.tex, finalProg.u.uB1);
    bind(2, levels[1].a.tex, finalProg.u.uB2);
    bind(3, levels[2].a.tex, finalProg.u.uB3);
    bind(4, levels[3].a.tex, finalProg.u.uB4);
    gl.uniform1f(finalProg.u.uTime, t);
    gl.uniform1f(finalProg.u.uExposure, 1.0);
    quad(finalProg, null, W, H);
  }

  // ---- the loop ------------------------------------------------------------------

  let running = !reduceMotion.matches;
  let start = performance.now() - 40000; // start a little into the story, not at t = 0
  let pausedAt = 0;
  function frame(now) {
    if (!running) return;
    lastTime = (now - start) / 1000;
    draw(lastTime);
    requestAnimationFrame(frame);
  }

  function setRunning(on) {
    if (on === running) return;
    running = on;
    const btn = document.getElementById("sky-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      btn.textContent = on ? "Himmel anhalten" : "Himmel weiterlaufen lassen";
    }
    if (on) {
      start = performance.now() - pausedAt * 1000;
      requestAnimationFrame(frame);
    } else {
      pausedAt = lastTime;
    }
  }

  // a hidden tab costs nothing
  let hiddenPause = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) { pausedAt = lastTime; running = false; hiddenPause = true; }
    else if (!document.hidden && hiddenPause) { hiddenPause = false; setRunning(true); }
  });

  const toggle = document.getElementById("sky-toggle");
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", () => setRunning(!running));
    if (!running) { toggle.setAttribute("aria-pressed", "true"); toggle.textContent = "Himmel weiterlaufen lassen"; }
  }

  window.addEventListener("resize", resize);
  lastTime = 40;
  resize();
  document.documentElement.classList.add("sky-on");
  if (running) requestAnimationFrame(frame);
  else draw(lastTime);
})();
