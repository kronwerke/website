// The background: a spiral galaxy simulated with the density wave model, a few distant
// galaxies, a star field and emission nebulae, rendered in HDR with bloom.
//
// Density waves: every star moves on an ellipse around the centre. The ellipses are
// rotated a little more the further out they are, and stars further out move slower
// (a flat rotation curve). Where neighbouring ellipses crowd together the stars bunch
// up, and those crowds are the spiral arms. The arms stay while every single star keeps
// moving through them, which is how real spiral galaxies behave.
//
// What the visitor sees first is a still of this very scene (img/sky/, rendered with
// ?poster). The simulation starts only after the page has loaded and the browser is
// idle, builds its stars in a worker, and fades in over the still. It then watches its
// own frame rate: when a device cannot keep up it lowers the resolution and the number
// of stars step by step, and when even the lowest step is too much it fades out again
// and leaves the still. Weak devices (software rendering, little memory, data saver,
// reduced motion) keep the still from the start.
//
// URL switches for checking: ?poster renders the still, ?top looks straight down on the
// disk, ?sky=0..3 fixes a quality step, ?sky=log prints the measurements, ?sky=try
// runs the simulation even on a device that would get the still.
//
// Plain WebGL2, no library.

(function () {
  "use strict";

  const canvas = document.getElementById("sky");
  if (!canvas) return;

  const query = location.search;
  const posterMode = /[?&]poster\b/.test(query);
  const topView = /[?&]top\b/.test(query);
  const forced = (query.match(/[?&]sky=(\d)/) || [])[1];
  const tryAnyway = /[?&]sky=try\b/.test(query); // skip the device checks, keep the measuring
  const log = /[?&]sky=(log|try)\b/.test(query) ? (...a) => console.info("sky:", ...a) : () => {};

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function weakDevice() {
    const c = navigator.connection;
    if (c && c.saveData) return "data saver";
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return "little memory";
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return "few cores";
    return "";
  }

  // ---- the particles, built off the main thread ------------------------------------

  const STARS = 150000, DUST = 36000, HII = 1400, FIELD = 5000, FAR = 7, FAR_STARS = 3500;

  // runs in a worker; also as a plain function when workers are not available
  function build(counts) {
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
    const starGain = 0.3;
    // per particle: a (orbit radius), phase, height, size, r, g, b, kind
    // kind: 0 old star, 0.5 young star, 1 H II region, 2 dust
    function disk(out, at, n) {
      for (let i = 0; i < n; i++) {
        const o = (at + i) * 8;
        const bulge = rnd() < 0.18;
        // exponential disk, a bulge in the middle
        let a = bulge ? Math.abs(gauss()) * 0.09 : -Math.log(1 - rnd() * 0.985) * 0.33;
        a = Math.min(a, 1.15);
        out[o] = a;
        out[o + 1] = rnd() * Math.PI * 2;
        const thick = bulge ? 0.06 * Math.exp(-a * 8) + 0.012 : 0.012 * (1 + a);
        out[o + 2] = gauss() * thick;
        // old yellow stars in the bulge, a mix in the disk, a few hot blue ones
        let temp;
        const r = rnd();
        let young = false;
        if (bulge || a < 0.1) temp = 3300 + rnd() * 2600;
        else if (r < 0.14) { temp = 9000 + rnd() * 16000; young = true; }
        else if (r < 0.4) temp = 5200 + rnd() * 2500;
        else temp = 3000 + rnd() * 2500;
        const c = blackbody(temp);
        const size = 0.8 + Math.pow(rnd(), 6) * 3.0;
        let bright = (0.45 + rnd() * 0.6) * starGain;
        if (temp > 9000) bright *= 1.6;
        if (bulge) bright *= 0.55;
        out[o + 3] = size;
        out[o + 4] = c[0] * bright;
        out[o + 5] = c[1] * bright;
        out[o + 6] = c[2] * bright;
        out[o + 7] = young ? 0.5 : 0;
      }
    }
    // H II regions: glowing hydrogen around young stars, strung along the arms
    function regions(out, at, n) {
      for (let i = 0; i < n; i++) {
        const o = (at + i) * 8;
        out[o] = 0.14 + rnd() * 0.7;
        out[o + 1] = rnd() * Math.PI * 2;
        out[o + 2] = gauss() * 0.01;
        out[o + 3] = 1.8 + rnd() * 3.5;
        out[o + 4] = 0.7; out[o + 5] = 0.2; out[o + 6] = 0.26;
        out[o + 7] = 1;
      }
    }
    function dust(out, at, n) {
      for (let i = 0; i < n; i++) {
        const o = (at + i) * 8;
        out[o] = 0.08 + Math.pow(rnd(), 0.8) * 0.85;
        out[o + 1] = rnd() * Math.PI * 2;
        out[o + 2] = gauss() * 0.006;
        out[o + 3] = 3 + Math.pow(rnd(), 2) * 12;
        // absorbs blue more than red, like real dust
        const k = 0.05 + rnd() * 0.12;
        out[o + 4] = k * 0.7; out[o + 5] = k * 0.85; out[o + 6] = k;
        out[o + 7] = 2;
      }
    }
    const { stars, hii, dustN, far, farStars, field } = counts;
    const galaxy = new Float32Array((stars + hii + dustN + far * farStars) * 8);
    disk(galaxy, 0, stars);
    regions(galaxy, stars, hii);
    dust(galaxy, stars + hii, dustN);
    disk(galaxy, stars + hii + dustN, far * farStars);
    // distant galaxies: where they sit, how they are turned, how big
    const farList = [];
    for (let i = 0; i < far; i++) {
      farList.push({
        pos: [(rnd() - 0.5) * 9, (rnd() - 0.5) * 4.5, -3.5 - rnd() * 5],
        tilt: 0.3 + rnd() * 1.1,
        spin: rnd() * Math.PI * 2,
        scale: 0.12 + rnd() * 0.22,
        twist: 2 + rnd() * 5,
        speed: 0.4 + rnd() * 0.6,
      });
    }
    // a star field far behind everything
    const stars2 = new Float32Array(field * 8);
    for (let i = 0; i < field; i++) {
      const o = i * 8;
      const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      stars2[o] = s * Math.cos(t) * 40; stars2[o + 1] = s * Math.sin(t) * 40; stars2[o + 2] = z * 40;
      stars2[o + 3] = 0.6 + Math.pow(rnd(), 6) * 2.4;
      const c = blackbody(3200 + rnd() * 9000);
      const b = 0.15 + Math.pow(rnd(), 3) * 0.9;
      stars2[o + 4] = c[0] * b; stars2[o + 5] = c[1] * b; stars2[o + 6] = c[2] * b;
      stars2[o + 7] = rnd() * 100;
    }
    return { galaxy, field: stars2, far: farList };
  }

  function particles(counts) {
    return new Promise((resolve) => {
      let url = null;
      try {
        const src = "const build = " + build.toString() + ";\n" +
          "onmessage = (e) => { const r = build(e.data); postMessage(r, [r.galaxy.buffer, r.field.buffer]); };";
        url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        const w = new Worker(url);
        w.onmessage = (e) => { w.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
        w.onerror = () => { w.terminate(); URL.revokeObjectURL(url); resolve(build(counts)); };
        w.postMessage(counts);
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        resolve(build(counts));
      }
    });
  }

  // ---- quality steps ---------------------------------------------------------------
  // dpr: highest device pixel ratio; share: part of the stars and dust drawn;
  // bloom: blur levels; low: divisor of the resolution for haze, dust and nebula;
  // fps: frame cap (0 is the display's rate)

  const STEPS = [
    { dpr: 1.75, share: 1.0, bloom: 4, low: 2, fps: 0 },
    { dpr: 1.25, share: 0.66, bloom: 3, low: 3, fps: 0 },
    { dpr: 1.0, share: 0.4, bloom: 3, low: 4, fps: 30 },
    { dpr: 0.75, share: 0.24, bloom: 2, low: 4, fps: 30 },
  ];

  async function start() {
    const gl = canvas.getContext("webgl2", {
      antialias: false, alpha: false, depth: false, stencil: false,
      powerPreference: "high-performance", preserveDrawingBuffer: posterMode,
    });
    if (!gl) return;
    if (!posterMode && !forced && !tryAnyway) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) {
        log("still only: software rendering", renderer);
        return;
      }
    }
    const hdr = !!gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    const parallel = gl.getExtension("KHR_parallel_shader_compile");

    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    let step = forced !== undefined ? Math.min(3, +forced) : posterMode ? 0 : small ? 1 : 0;

    const counts = { stars: STARS, hii: HII, dustN: DUST, far: FAR, farStars: FAR_STARS, field: FIELD };
    const [data, progs] = await Promise.all([particles(counts), programs(gl, parallel)]);
    if (!progs) return;
    const { galaxyProg, fieldProg, nebulaProg, copyProg, brightProg, blurProg, finalProg } = progs;

    const RANGE = {
      stars: [0, STARS],
      regions: [STARS, HII],
      dust: [STARS + HII, DUST],
      far: [STARS + HII + DUST, FAR_STARS * FAR],
    };
    const far = data.far;

    function vao(buf) {
      const v = gl.createVertexArray();
      gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
      gl.bindVertexArray(null);
      return v;
    }
    const galaxyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, galaxyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.galaxy, gl.STATIC_DRAW);
    const galaxyVao = vao(galaxyBuf);
    const fieldBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fieldBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.field, gl.STATIC_DRAW);
    const fieldVao = vao(fieldBuf);
    const quadVao = gl.createVertexArray(); // full screen triangle from gl_VertexID

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
    function free(t) {
      if (!t) return;
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
    }

    // scene: stars at full resolution; haze, dust and nebula: soft, so a fraction of it
    let W = 0, H = 0, sizedFor = -1, scene = null, haze = null, dust = null, nebula = null, levels = [];
    function resize() {
      const s = STEPS[step];
      const dpr = posterMode ? 1 : Math.min(window.devicePixelRatio || 1, s.dpr);
      const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
      if (w === W && h === H && sizedFor === step) return;
      W = w; H = h; sizedFor = step;
      canvas.width = w; canvas.height = h;
      [scene, haze, dust, nebula].forEach(free);
      levels.forEach((l) => { free(l.a); free(l.b); });
      scene = target(w, h);
      const lw = Math.max(2, Math.round(w / s.low)), lh = Math.max(2, Math.round(h / s.low));
      haze = target(lw, lh);
      dust = target(lw, lh);
      nebula = target(Math.max(2, Math.round(w / (s.low + 1))), Math.max(2, Math.round(h / (s.low + 1))));
      nebulaAge = Infinity;
      levels = [];
      let bw = w, bh = h;
      for (let i = 0; i < s.bloom; i++) {
        bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1);
        levels.push({ a: target(bw, bh), b: target(bw, bh) });
      }
    }

    // ---- matrices ------------------------------------------------------------------

    function perspective(fov, aspect, near, farZ) {
      const f = 1 / Math.tan(fov / 2), nf = 1 / (near - farZ);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (farZ + near) * nf, -1, 0, 0, 2 * farZ * near * nf, 0]);
    }
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
    function lookAt(eye, at, up) {
      const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    }
    function turn(tilt, spin) {
      // rotate about y (spin), then about x (tilt)
      const cs = Math.cos(spin), ss = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
      return new Float32Array([cs, st * ss, -ct * ss, 0, ct, st, ss, -st * cs, ct * cs]);
    }
    const farTurns = far.map((g) => turn(g.tilt, g.spin));
    const flat = turn(0, 0);

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
    function clear(t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.viewport(0, 0, t.w, t.h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    let nebulaAge = Infinity;
    function draw(t) {
      const s = STEPS[step];
      const aspect = W / H;
      const wide = aspect > 1.1;
      smooth[0] += (pointer[0] - smooth[0]) * 0.04;
      smooth[1] += (pointer[1] - smooth[1]) * 0.04;

      // the camera looks down at the disk from above the plane and drifts with the scroll
      const sc = Math.min(scroll, 4);
      const elev = topView ? 1.45 : 0.55 + sc * 0.08 + smooth[1] * 0.05;
      const az = 0.4 + sc * 0.22 + smooth[0] * 0.08;
      const dist = (wide ? 2.6 : 3.3) - Math.min(sc, 1.5) * 0.3;
      const eye = [Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist];
      const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      // the galaxy sits right of centre on wide screens so the text has room on the left
      const proj = perspective(0.9, aspect, 0.02, 100);
      if (wide) proj[8] = -0.36;
      else proj[9] = -0.66; // on tall screens above the text, in the empty top of the hero

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      // the nebula drifts slowly, so it is drawn small and only every other frame
      if (nebulaAge >= 2) {
        gl.useProgram(nebulaProg.p);
        gl.uniform1f(nebulaProg.u.uTime, t);
        gl.uniform1f(nebulaProg.u.uAspect, aspect);
        gl.uniform2f(nebulaProg.u.uLook, az * 0.25, elev * 0.2);
        quad(nebulaProg, nebula.fb, nebula.w, nebula.h);
        nebulaAge = 0;
      }
      nebulaAge++;
      gl.useProgram(copyProg.p);
      bind(0, nebula.tex, copyProg.u.uSrc);
      quad(copyProg, scene.fb, W, H);

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
      gl.uniform1f(galaxyProg.u.uPeak, 2.26);
      gl.uniform1f(galaxyProg.u.uHaze, 0);
      gl.uniform1f(galaxyProg.u.uHazeF, 0);
      gl.bindVertexArray(galaxyVao);

      const farN = Math.floor(FAR_STARS * Math.max(0.5, s.share));
      gl.uniform1f(galaxyProg.u.uFar, 1);
      for (let i = 0; i < far.length; i++) {
        const g = far[i];
        gl.uniform3fv(galaxyProg.u.uCenter, g.pos);
        gl.uniformMatrix3fv(galaxyProg.u.uTurn, false, farTurns[i]);
        gl.uniform1f(galaxyProg.u.uScale, g.scale);
        gl.uniform1f(galaxyProg.u.uTwist, g.twist);
        gl.uniform1f(galaxyProg.u.uSpeed, g.speed * 0.02);
        gl.drawArrays(gl.POINTS, RANGE.far[0] + i * FAR_STARS, farN);
      }

      // the stars are in random order, so drawing the first part is a fair sample;
      // fewer stars are drawn a little brighter so the disk keeps its light
      const starsN = Math.floor(STARS * s.share);
      gl.uniform3fv(galaxyProg.u.uCenter, [0, 0, 0]);
      gl.uniformMatrix3fv(galaxyProg.u.uTurn, false, flat);
      gl.uniform1f(galaxyProg.u.uScale, 1);
      gl.uniform1f(galaxyProg.u.uTwist, 5.5);
      gl.uniform1f(galaxyProg.u.uSpeed, 0.018);
      gl.uniform1f(galaxyProg.u.uFar, 0);
      gl.uniform1f(galaxyProg.u.uGain, 1 / Math.sqrt(s.share));
      gl.drawArrays(gl.POINTS, RANGE.stars[0], starsN);
      gl.drawArrays(gl.POINTS, RANGE.regions[0], Math.floor(HII * Math.max(0.5, s.share)));

      // the haze: every fifth star again, large and faint, the unresolved light of
      // billions of stars that makes a galaxy glow instead of sparkle. Soft by nature,
      // so it goes into the small target.
      clear(haze);
      gl.uniform1f(galaxyProg.u.uPixel, haze.h * 0.0028);
      gl.uniform1f(galaxyProg.u.uHaze, 1);
      gl.uniform1f(galaxyProg.u.uHazeF, 1);
      gl.uniform1f(galaxyProg.u.uHazeGain, 0.04 / Math.sqrt(s.share));
      gl.bindVertexArray(galaxyVao);
      gl.drawArrays(gl.POINTS, RANGE.stars[0], Math.floor(starsN / 5));

      // dust: how much light it takes away, summed up, in the small target too
      clear(dust);
      gl.uniform1f(galaxyProg.u.uHaze, 0);
      gl.uniform1f(galaxyProg.u.uHazeF, 0);
      gl.uniform1f(galaxyProg.u.uGain, 1 / s.share);
      gl.drawArrays(gl.POINTS, RANGE.dust[0], Math.floor(DUST * s.share));
      gl.disable(gl.BLEND);

      // bloom from the lit scene
      gl.useProgram(brightProg.p);
      bind(0, scene.tex, brightProg.u.uSrc);
      bind(1, haze.tex, brightProg.u.uHaze);
      bind(2, dust.tex, brightProg.u.uDust);
      quad(brightProg, levels[0].a.fb, levels[0].a.w, levels[0].a.h);
      for (let i = 0; i < levels.length; i++) {
        const L = levels[i];
        gl.useProgram(blurProg.p);
        if (i > 0) {
          bind(0, levels[i - 1].a.tex, blurProg.u.uSrc);
          gl.uniform2f(blurProg.u.uDir, 0, 0);
          quad(blurProg, L.a.fb, L.a.w, L.a.h);
        }
        bind(0, L.a.tex, blurProg.u.uSrc);
        gl.uniform2f(blurProg.u.uDir, 1 / L.a.w, 0);
        quad(blurProg, L.b.fb, L.b.w, L.b.h);
        bind(0, L.b.tex, blurProg.u.uSrc);
        gl.uniform2f(blurProg.u.uDir, 0, 1 / L.a.h);
        quad(blurProg, L.a.fb, L.a.w, L.a.h);
      }

      gl.useProgram(finalProg.p);
      bind(0, scene.tex, finalProg.u.uScene);
      bind(1, haze.tex, finalProg.u.uHaze);
      bind(2, dust.tex, finalProg.u.uDust);
      for (let i = 0; i < 4; i++) bind(3 + i, levels[Math.min(i, levels.length - 1)].a.tex, finalProg.u["uB" + (i + 1)]);
      gl.uniform4f(finalProg.u.uBloom, 0.35, 0.3, levels.length > 2 ? 0.3 : 0.45, levels.length > 3 ? 0.35 : 0);
      gl.uniform1f(finalProg.u.uTime, t);
      quad(finalProg, null, W, H);
    }

    // ---- the still for the page ----------------------------------------------------

    if (posterMode) {
      resize();
      nebulaAge = Infinity;
      draw(40);
      canvas.classList.add("on");
      window.__skyReady = true;
      return;
    }

    // ---- the loop, and how it keeps itself smooth ------------------------------------

    let running = true, stopped = false;
    let clock = performance.now() - 40000; // start a little into the story, not at t = 0
    let pausedAt = 0, lastTime = 40, lastDraw = 0;
    let warm = 0, samples = [], shown = false, fence = null, fenceAt = 0;
    const WARMUP = 6, QUICK = 10, WINDOW = 45;

    // rAF timing: when the GPU cannot keep up, frames arrive late. The first ten frames
    // decide quickly (and the canvas stays hidden behind the still until they pass),
    // after that every 45 frames are checked and the quality drops one step at a time.
    function judge(now, cost) {
      // later the rAF rhythm is enough
      const dt = shown ? (lastDraw ? now - lastDraw : -1) : cost;
      if (dt >= 0) {
        if (warm < WARMUP) warm++;
        else if (dt < 2000) samples.push(dt);
      }
      lastDraw = now;
      const need = shown ? WINDOW : QUICK;
      if (samples.length < need) return;
      samples.sort((a, b) => a - b);
      const typical = samples[Math.floor(samples.length * 0.6)];
      samples = [];
      const fps = STEPS[step].fps;
      const budget = fps ? (1000 / fps) * 1.3 : 1000 / 42;
      log("step", step, shown ? "" : "(first look)", "frame", typical.toFixed(1), "ms, budget", budget.toFixed(1));
      if (forced !== undefined || typical <= budget) {
        if (!shown) { shown = true; canvas.classList.add("on"); }
        return;
      }
      // every step roughly halves the work, so a frame four times too slow skips two
      const drop = shown ? 1 : Math.max(1, Math.ceil(Math.log2(typical / budget)));
      if (step + drop < STEPS.length) {
        step += drop;
        warm = 0;
        resize();
        log("down to step", step);
      } else {
        // even the lightest step is too much: the still stays
        log("too slow, keeping the still");
        stop();
      }
    }

    function stop() {
      stopped = true;
      running = false;
      canvas.classList.remove("on");
      const btn = document.getElementById("sky-toggle");
      if (btn) btn.hidden = true;
      setTimeout(() => {
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      }, 2000);
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      const fps = STEPS[step].fps;
      if (fps && lastDraw && now - lastDraw < 1000 / fps - 3) return;
      if (!shown) {
        // the first look: one frame at a time, and the next only once the GPU has
        // signalled that the last one is done, so the time is what a frame really costs
        if (fence) {
          if (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) return;
          gl.deleteSync(fence);
          fence = null;
          judge(now, now - fenceAt);
          if (!running) return;
        }
        lastTime = (now - clock) / 1000;
        draw(lastTime);
        if (!shown) {
          fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          fenceAt = performance.now();
        }
        return;
      }
      judge(now, 0);
      if (!running) return;
      lastTime = (now - clock) / 1000;
      draw(lastTime);
    }

    function setRunning(on) {
      if (on === running || stopped) return;
      running = on;
      const btn = document.getElementById("sky-toggle");
      if (btn) {
        btn.setAttribute("aria-pressed", on ? "false" : "true");
        btn.textContent = on ? "Himmel anhalten" : "Himmel weiterlaufen lassen";
      }
      if (on) {
        clock = performance.now() - pausedAt * 1000;
        lastDraw = 0; warm = 0; samples = [];
        requestAnimationFrame(frame);
      } else {
        pausedAt = lastTime;
      }
    }

    // a hidden tab costs nothing
    let hiddenPause = false;
    document.addEventListener("visibilitychange", () => {
      if (stopped) return;
      if (document.hidden && running) { pausedAt = lastTime; running = false; hiddenPause = true; }
      else if (!document.hidden && hiddenPause) { hiddenPause = false; setRunning(true); }
    });

    const toggle = document.getElementById("sky-toggle");
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener("click", () => setRunning(!running));
    }

    window.addEventListener("resize", () => { if (!stopped) resize(); });
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (!stopped) stop(); });
    resize();
    document.documentElement.classList.add("sky-on");
    requestAnimationFrame(frame);
  }

  // ---- shaders ---------------------------------------------------------------------

  function programs(gl, parallel) {
    const galaxyVS = `#version 300 es
    layout(location=0) in vec4 aOrbit;   // a, phase, height, size
    layout(location=1) in vec4 aColor;   // rgb, kind
    uniform mat4 uView, uProj;
    uniform float uTime, uTwist, uScale, uSpeed, uPixel, uFar, uHaze, uHazeGain, uPeak, uGain;
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
      if (kind < 1.5 && uFar < 0.5) col *= uGain;
      if (kind > 1.5) col *= uGain;
      if (uFar > 0.5) { col *= 0.35; }
      if (uHaze > 0.5) { size = 22.0 * uPixel / dist; col *= uHazeGain; }
      gl_PointSize = clamp(size, 0.8, (kind > 1.5 || uHaze > 0.5) ? 90.0 : 36.0);
      vColor = col;
      vKind = kind;
    }`;

    const galaxyFS = `#version 300 es
    precision mediump float;
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
    precision mediump float;
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
      // one cloud on the upper left, fading out elsewhere: nothing to compute outside it
      float place = smoothstep(1.1, 0.0, length(uv - vec2(-0.6, 0.42)));
      if (place <= 0.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 p = vec3(uv * 1.6, uTime * 0.006);
      vec3 q = vec3(fbm(p + vec3(0.0, 0.0, 0.0)), fbm(p + vec3(5.2, 1.3, 2.8)), 0.0);
      float n = fbm(p + 2.2 * q);
      float gas = smoothstep(0.5, 0.9, n) * smoothstep(0.35, 0.75, fbm(p * 4.0 + q * 2.0));
      float thin = smoothstep(0.6, 0.92, fbm(p * 2.6 - q + 3.0));
      vec3 ha = vec3(0.62, 0.13, 0.11);
      vec3 oiii = vec3(0.10, 0.34, 0.36);
      vec3 col = ha * gas * 0.55 + oiii * thin * (1.0 - gas) * 0.28;
      // dark lanes of dust inside the cloud
      float lane = smoothstep(0.5, 0.75, fbm(p * 3.1 + q * 1.5 + 11.0));
      col *= 1.0 - lane * 0.8;
      o = vec4(col * place * 0.42, 1.0);
    }`;

    const copyFS = `#version 300 es
    precision mediump float;
    in vec2 vUv;
    uniform sampler2D uSrc;
    out vec4 o;
    void main() { o = vec4(texture(uSrc, vUv).rgb, 1.0); }`;

    // the lit scene: stars and gas, the haze on top, then what the dust lets through
    const lit = `
    vec3 lit(vec2 uv) {
      vec3 c = texture(uScene, uv).rgb + texture(uHaze, uv).rgb;
      return c * exp(-texture(uDust, uv).rgb);
    }`;

    const brightFS = `#version 300 es
    precision mediump float;
    in vec2 vUv;
    uniform sampler2D uSrc, uHaze, uDust;
    #define uScene uSrc
    out vec4 o;
    ${lit}
    void main() {
      vec3 c = lit(vUv);
      float l = max(max(c.r, c.g), c.b);
      o = vec4(c * smoothstep(0.55, 1.6, l), 1.0);
    }`;

    const blurFS = `#version 300 es
    precision mediump float;
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
    uniform sampler2D uScene, uHaze, uDust, uB1, uB2, uB3, uB4;
    uniform vec4 uBloom;
    uniform float uTime;
    out vec4 o;
    ${lit}
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    void main() {
      vec3 c = lit(vUv);
      c += texture(uB1, vUv).rgb * uBloom.x + texture(uB2, vUv).rgb * uBloom.y
         + texture(uB3, vUv).rgb * uBloom.z + texture(uB4, vUv).rgb * uBloom.w;
      c = aces(c);
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

    const list = {
      galaxyProg: [galaxyVS, galaxyFS], fieldProg: [fieldVS, fieldFS], nebulaProg: [quadVS, nebulaFS],
      copyProg: [quadVS, copyFS], brightProg: [quadVS, brightFS], blurProg: [quadVS, blurFS], finalProg: [quadVS, finalFS],
    };
    const pending = {};
    for (const name in list) {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, list[name][0]], [gl.FRAGMENT_SHADER, list[name][1]]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      pending[name] = p;
    }
    // with KHR_parallel_shader_compile the driver compiles while the page stays responsive
    function done() {
      const out = {};
      for (const name in pending) {
        const p = pending[name];
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.warn("sky:", name, gl.getProgramInfoLog(p));
          return null;
        }
        const u = {};
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const uname = gl.getActiveUniform(p, i).name;
          u[uname] = gl.getUniformLocation(p, uname);
        }
        out[name] = { p, u };
      }
      return out;
    }
    if (!parallel) return Promise.resolve(done());
    return new Promise((resolve) => {
      (function poll() {
        for (const name in pending) {
          if (!gl.getProgramParameter(pending[name], parallel.COMPLETION_STATUS_KHR)) {
            setTimeout(poll, 16);
            return;
          }
        }
        resolve(done());
      })();
    });
  }

  // ---- go --------------------------------------------------------------------------

  // the still behind the page, once the page itself is there
  function still() { document.documentElement.classList.add("sky-still"); }
  if (document.readyState === "complete") still();
  else window.addEventListener("load", still, { once: true });

  if (posterMode) {
    document.documentElement.classList.add("sky-poster");
    start();
  } else {
    const weak = forced || tryAnyway ? "" : weakDevice();
    if (reduceMotion) log("still only: reduced motion");
    else if (weak) log("still only:", weak);
    else if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
  }

  // after the load event and once the browser is idle, so the page itself comes first
  function later() {
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 3000 });
    else setTimeout(start, 400);
  }
})();
