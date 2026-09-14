/* ══════════════════════════════════════════════════════════════════════════
   hero.js — the one three.js flourish (DESIGN.md §6 "perpetual micro-life")
   A low-poly translucent cup with a slowly swirling slush of Flavor Swirl
   particles. Decorative only: index.html lazy-loads three.js and this file
   after window load at idle, then calls window.SLURPEE_HERO(). It never
   blocks first paint, and bows out entirely for reduced-motion or missing
   WebGL, leaving the static #icon-cup sprite in place.
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Phones get a lighter scene: lower pixel ratio and fewer slush particles.
  var MOBILE = window.matchMedia &&
    window.matchMedia('(max-width: 768px)').matches;
  var MAX_DPR = MOBILE ? 1.5 : 2;
  var COLORS = [0x3E2C23, 0x3D8BFD, 0x5FBF4A, 0xF2768F, 0xF5A623];  // cola/raspberry/apple/strawberry/mango
  var PARTICLES = MOBILE ? 140 : 260;

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function init() {
    var host = document.getElementById('hero');
    var canvas = document.getElementById('hero-canvas');
    if (!host || !canvas) return;

    // Bow out quietly — the sprite fallback is already in the DOM.
    if (reducedMotion() || !webglOK() || typeof THREE === 'undefined') return;

    var w = host.clientWidth || 76;
    var h = host.clientHeight || 76;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, alpha: true, antialias: true
      });
    } catch (e) {
      return;                               // driver said no; keep the sprite
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    camera.position.set(0, 0.35, 6.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    var key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(2, 3, 4);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x3D8BFD, 0.9);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    var cup = new THREE.Group();
    scene.add(cup);

    // ── the cup: tapered, open-ended, frosty ──
    var wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.06, 0.72, 2.5, 24, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        roughness: 0.28,
        metalness: 0,
        transmission: 0.5,
        side: THREE.DoubleSide
      })
    );
    cup.add(wall);

    // dome lid
    var lid = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.26,
        roughness: 0.2,
        side: THREE.DoubleSide
      })
    );
    lid.position.y = 1.25;
    cup.add(lid);

    // straw, in Slurpee Red — the accent's one appearance here
    var straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 3.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xE8402A, roughness: 0.45 })
    );
    straw.position.set(0.34, 1.0, 0.14);
    straw.rotation.z = -0.32;
    cup.add(straw);

    // ── the slush: particles swirling inside the cup ──
    var positions = new Float32Array(PARTICLES * 3);
    var colors = new Float32Array(PARTICLES * 3);
    var swirl = [];
    var col = new THREE.Color();

    for (var i = 0; i < PARTICLES; i++) {
      var y = -1.15 + Math.random() * 2.1;
      // cup tapers, so the usable radius shrinks toward the bottom
      var t = (y + 1.25) / 2.5;
      var maxR = 0.66 + t * 0.3;
      var r = Math.sqrt(Math.random()) * maxR;
      var a = Math.random() * Math.PI * 2;

      swirl.push({ r: r, a: a, y: y, speed: 0.12 + Math.random() * 0.3 });
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;

      col.setHex(COLORS[(Math.random() * COLORS.length) | 0]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    var slush = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.17,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true
    }));
    cup.add(slush);

    host.classList.add('has-webgl');

    // ── loop ──
    var raf = null;
    var t0 = performance.now();
    var attr = geo.getAttribute('position');

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var t = (now - t0) / 1000;

      cup.rotation.y = Math.sin(t * 0.35) * 0.42;
      cup.position.y = Math.sin(t * 0.9) * 0.06;          // gentle idle float

      for (var i = 0; i < PARTICLES; i++) {
        var p = swirl[i];
        p.a += p.speed * 0.01;
        attr.array[i * 3] = Math.cos(p.a) * p.r;
        attr.array[i * 3 + 2] = Math.sin(p.a) * p.r;
        attr.array[i * 3 + 1] = p.y + Math.sin(t * 0.8 + p.a * 2) * 0.05;
      }
      attr.needsUpdate = true;

      renderer.render(scene, camera);
    }

    function start() { if (raf == null) { t0 = performance.now() - 1; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    // Don't burn frames while the hero is scrolled or snapped out of view.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !document.hidden) start();
        else stop();
      }, { threshold: 0.05 }).observe(host);
    } else {
      start();
    }

    window.addEventListener('resize', function () {
      var nw = host.clientWidth || 76, nh = host.clientHeight || 76;
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });

    start();
  }

  // index.html loads this file lazily and calls the boot function.
  window.SLURPEE_HERO = init;
})();
