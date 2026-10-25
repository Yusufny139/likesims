import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Prosedürel dokular ve paylaşılan malzemeler
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noiseOverlay(ctx, w, h, amount, alpha, rnd) {
  for (let i = 0; i < amount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const s = 1 + rnd() * 3;
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${alpha * rnd()})`;
    ctx.fillRect(x, y, s, s);
  }
}

// --- Dokular ---------------------------------------------------------------

function woodFloorTexture() {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(71);
  ctx.fillStyle = '#c69a6b';
  ctx.fillRect(0, 0, w, h);
  const plankH = 64;
  for (let row = 0; row < h / plankH; row++) {
    const y = row * plankH;
    const offset = (row % 2) * 96;
    for (let x = -offset; x < w; x += 256) {
      const tone = 0.86 + rnd() * 0.24;
      const r = Math.round(198 * tone);
      const g = Math.round(154 * tone);
      const b = Math.round(107 * tone);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 2, y + 2, 252, plankH - 4);
      // ahşap damarları
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = `rgba(96,63,38,${0.03 + rnd() * 0.07})`;
        ctx.lineWidth = 0.6 + rnd() * 1.4;
        ctx.beginPath();
        const yy = y + 6 + rnd() * (plankH - 12);
        ctx.moveTo(x + 6, yy);
        ctx.bezierCurveTo(x + 80, yy + (rnd() - 0.5) * 9, x + 170, yy + (rnd() - 0.5) * 9, x + 248, yy + (rnd() - 0.5) * 5);
        ctx.stroke();
      }
      // düğüm
      if (rnd() > 0.55) {
        ctx.fillStyle = `rgba(92,58,33,${0.12 + rnd() * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(x + 40 + rnd() * 170, y + 12 + rnd() * 40, 5 + rnd() * 4, 2 + rnd() * 2, rnd(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(84,55,32,0.32)';
    ctx.fillRect(0, y, w, 2.2);
  }
  noiseOverlay(ctx, w, h, 900, 0.05, rnd);
  return canvasTexture(c, { repeatX: 6, repeatY: 5 });
}

function woodTexture({ base = '#b98a5e', dark = '#8d6340', repeatX = 3, repeatY = 2, seed = 11 } = {}) {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(70,45,26,${0.03 + rnd() * 0.1})`;
    ctx.lineWidth = 0.7 + rnd() * 2;
    ctx.beginPath();
    const y = rnd() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 18, w * 0.65, y + (rnd() - 0.5) * 22, w, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgba(70,45,26,${0.06 + rnd() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 14, 2 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, dark + '00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  noiseOverlay(ctx, w, h, 400, 0.06, rnd);
  return canvasTexture(c, { repeatX, repeatY });
}

function wallTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(5);
  ctx.fillStyle = '#f5ece0';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(208,186,160,${0.05 + rnd() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 8 + rnd() * 34, 0, Math.PI * 2);
    ctx.fill();
  }
  noiseOverlay(ctx, w, h, 1500, 0.045, rnd);
  return canvasTexture(c, { repeatX: 3, repeatY: 2 });
}

function counterTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(23);
  ctx.fillStyle = '#e8dfd1';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(150,135,116,${0.06 + rnd() * 0.1})`;
    ctx.lineWidth = 0.8 + rnd() * 2;
    ctx.beginPath();
    let x = rnd() * w;
    let y = rnd() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.3) * 50;
      y += (rnd() - 0.5) * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  noiseOverlay(ctx, w, h, 700, 0.04, rnd);
  return canvasTexture(c, { repeatX: 2, repeatY: 1 });
}

function tileTexture({ base = '#e9eee8', grout = '#c9d2c6', accent = '#a8bda9' } = {}) {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(33);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, w, h);
  const size = 64;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const isAccent = (x / size + y / size) % 3 === 0;
      ctx.fillStyle = isAccent ? accent : base;
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
      const g = ctx.createLinearGradient(x, y, x + size, y + size);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(120,130,120,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    }
  }
  noiseOverlay(ctx, w, h, 500, 0.05, rnd);
  return canvasTexture(c, { repeatX: 4, repeatY: 3 });
}

function fabricTexture(color = '#9db6a4') {
  const w = 128;
  const h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const rnd = mulberry32(9);
  for (let i = 0; i < w; i += 3) {
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.03})`;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${0.02 + rnd() * 0.02})`;
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }
  return canvasTexture(c, { repeatX: 3, repeatY: 3 });
}

function rugTexture() {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(48);
  ctx.fillStyle = '#c07a5d';
  ctx.fillRect(0, 0, w, h);
  // dış çerçeve
  ctx.strokeStyle = '#f0e2cb';
  ctx.lineWidth = 26;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.strokeStyle = '#8d5340';
  ctx.lineWidth = 6;
  ctx.strokeRect(46, 46, w - 92, h - 92);
  // ortada elmas desen
  const drawDiamond = (cx, cy, r, color, lw = 8) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();
  };
  for (let i = 0; i < 3; i++) {
    drawDiamond(w / 2, h / 2, 90 + i * 46, i % 2 ? '#f0e2cb' : '#8d5340', 10 - i * 2);
  }
  ctx.fillStyle = '#8fa78d';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2);
  ctx.fill();
  // küçük motifler
  for (let i = 0; i < 20; i++) {
    const x = 70 + rnd() * (w - 140);
    const y = rnd() > 0.5 ? 66 + rnd() * 14 : h - 80 + rnd() * 14;
    ctx.fillStyle = '#f0e2cb';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // hav dokusu
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '60,30,20'},${0.02 + rnd() * 0.04})`;
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  return canvasTexture(c);
}

function grassTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(64);
  ctx.fillStyle = '#8fae74';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const g = 120 + Math.floor(rnd() * 70);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.55)},${0.16 + rnd() * 0.3})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 4);
  }
  return canvasTexture(c, { repeatX: 18, repeatY: 18 });
}

function deckTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(81);
  const plank = 42;
  for (let y = 0; y < h; y += plank) {
    const t = 0.86 + rnd() * 0.2;
    ctx.fillStyle = `rgb(${Math.round(170 * t)},${Math.round(126 * t)},${Math.round(88 * t)})`;
    ctx.fillRect(0, y, w, plank - 2);
    ctx.fillStyle = 'rgba(60,38,22,0.35)';
    ctx.fillRect(0, y + plank - 2, w, 2);
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = `rgba(80,50,28,${0.04 + rnd() * 0.06})`;
      ctx.beginPath();
      const yy = y + 4 + rnd() * (plank - 8);
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy + (rnd() - 0.5) * 4);
      ctx.stroke();
    }
  }
  noiseOverlay(ctx, w, h, 500, 0.05, rnd);
  return canvasTexture(c, { repeatX: 3, repeatY: 4 });
}

function screenTexture() {
  const w = 512;
  const h = 288;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#20365a');
  grad.addColorStop(0.55, '#c06a7a');
  grad.addColorStop(1, '#f2b880');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // güneş
  ctx.fillStyle = 'rgba(255,226,174,0.92)';
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.42, 46, 0, Math.PI * 2);
  ctx.fill();
  // tepeler
  ctx.fillStyle = '#3a4d5f';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.25, h * 0.55, w * 0.45, h * 0.78, w * 0.62, h * 0.66);
  ctx.bezierCurveTo(w * 0.78, h * 0.55, w * 0.9, h * 0.7, w, h * 0.6);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b3b49';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.84);
  ctx.bezierCurveTo(w * 0.3, h * 0.72, w * 0.5, h * 0.9, w * 0.72, h * 0.78);
  ctx.bezierCurveTo(w * 0.85, h * 0.72, w * 0.95, h * 0.8, w, h * 0.76);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // yıldızlar
  const rnd = mulberry32(3);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
    ctx.fillRect(rnd() * w, rnd() * h * 0.45, 1.4, 1.4);
  }
  // film şeridi altlık
  ctx.fillStyle = 'rgba(15,20,28,0.35)';
  ctx.fillRect(0, h - 26, w, 26);
  return canvasTexture(c);
}

function artTexture(variant = 1) {
  const w = 256;
  const h = 320;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(variant === 1 ? 12 : 89);
  ctx.fillStyle = variant === 1 ? '#f3e7d4' : '#e7ded2';
  ctx.fillRect(0, 0, w, h);
  const palette = variant === 1
    ? ['#c9785a', '#6f8f7a', '#e2b25f', '#3f4c56']
    : ['#d9a15b', '#8c6d8f', '#5d8a8a', '#b3563f'];
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
    ctx.globalAlpha = 0.75 + rnd() * 0.25;
    if (rnd() > 0.5) {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 20 + rnd() * 54, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(rnd() * w, rnd() * h);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillRect(-40 - rnd() * 30, -14, 80 + rnd() * 60, 28 + rnd() * 40);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // fırça izleri
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + rnd() * 0.07})`;
    ctx.lineWidth = 2 + rnd() * 6;
    ctx.beginPath();
    ctx.moveTo(rnd() * w, rnd() * h);
    ctx.lineTo(rnd() * w, rnd() * h);
    ctx.stroke();
  }
  // çerçeve
  ctx.strokeStyle = '#b98a5e';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  return canvasTexture(c);
}

function skyTexture() {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#86b9d9');
  grad.addColorStop(0.5, '#cfe2e8');
  grad.addColorStop(1, '#f4e6cf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return canvasTexture(c);
}

// --- Malzemeler ------------------------------------------------------------

let cache = null;

export function getMaterials() {
  if (cache) return cache;

  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.02, ...opts });

  const floorTex = woodFloorTexture();
  const woodTex = woodTexture();
  const darkWoodTex = woodTexture({ base: '#8b6243', dark: '#5f3f27', seed: 31, repeatX: 2, repeatY: 1 });
  const wallTex = wallTexture();
  const counterTex = counterTexture();
  const tileTex = tileTexture();
  const sageTileTex = tileTexture({ base: '#dfe8dc', grout: '#bccbbb', accent: '#9fb7a0' });
  const rugTex = rugTexture();
  const grassTex = grassTexture();
  const deckTex = deckTexture();
  const screenTex = screenTexture();
  const art1 = artTexture(1);
  const art2 = artTexture(2);
  const sageFabric = fabricTexture('#9bb3a1');
  const rustFabric = fabricTexture('#c98264');
  const creamFabric = fabricTexture('#e8dcc6');

  const m = {
    floor: std({ map: floorTex, roughness: 0.62 }),
    wood: std({ map: woodTex, roughness: 0.72 }),
    darkWood: std({ map: darkWoodTex, roughness: 0.74 }),
    wall: std({ map: wallTex, roughness: 0.95 }),
    wallAccent: std({ color: '#dcc7ae', roughness: 0.95 }),
    wallSage: std({ color: '#a9bda9', roughness: 0.94 }),
    ceiling: std({ color: '#f8f1e7', roughness: 1 }),
    counter: std({ map: counterTex, roughness: 0.45 }),
    tile: std({ map: tileTex, roughness: 0.5 }),
    sageTile: std({ map: sageTileTex, roughness: 0.5 }),
    rug: std({ map: rugTex, roughness: 0.95 }),
    grass: std({ map: grassTex, roughness: 1 }),
    deck: std({ map: deckTex, roughness: 0.8 }),
    screen: new THREE.MeshStandardMaterial({ map: screenTex, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 0.35, roughness: 0.35 }),
    picture1: std({ map: art1, roughness: 0.85 }),
    picture2: std({ map: art2, roughness: 0.85 }),
    sofaSage: std({ map: sageFabric, color: '#9bb3a1', roughness: 0.96 }),
    sofaSageDark: std({ map: sageFabric, color: '#829c89', roughness: 0.96 }),
    sofaRust: std({ map: rustFabric, color: '#c98264', roughness: 0.96 }),
    cream: std({ map: creamFabric, color: '#f0e4cf', roughness: 0.95 }),
    linen: std({ color: '#f6efe3', roughness: 0.95 }),
    duvet: std({ map: creamFabric, color: '#e9d7bd', roughness: 0.95 }),
    pillow: std({ color: '#f8f1e4', roughness: 0.98 }),
    metal: std({ color: '#b8b3a8', roughness: 0.35, metalness: 0.75 }),
    darkMetal: std({ color: '#3c3a37', roughness: 0.45, metalness: 0.55 }),
    brass: std({ color: '#c9a365', roughness: 0.32, metalness: 0.85 }),
    ceramic: std({ color: '#fbf6ec', roughness: 0.28 }),
    ceramicSage: std({ color: '#9db29c', roughness: 0.3 }),
    ceramicRust: std({ color: '#c07b5c', roughness: 0.35 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#cfdcdd', roughness: 0.08, metalness: 0.92 }),
    // transmission kullanılmıyor: kırılma geçişi tüm sahneyi ikinci kez çizdiriyor
    glass: new THREE.MeshStandardMaterial({
      color: '#dcecf0', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    windowGlass: new THREE.MeshStandardMaterial({
      color: '#cfe4ea', roughness: 0.14, metalness: 0.08, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    leaf: std({ color: '#5d8a5f', roughness: 0.85 }),
    leafDark: std({ color: '#416b47', roughness: 0.88 }),
    leafLight: std({ color: '#7fa172', roughness: 0.85 }),
    soil: std({ color: '#5a4233', roughness: 1 }),
    paper: std({ color: '#f7f0e2', roughness: 0.95 }),
    black: std({ color: '#2b2a28', roughness: 0.6 }),
    white: std({ color: '#f7f2e7', roughness: 0.6 }),
    red: std({ color: '#b8554c', roughness: 0.6 }),
    honey: std({ color: '#d8a44e', roughness: 0.5 }),
    olive: std({ color: '#6f7f52', roughness: 0.7 }),
    terracotta: std({ color: '#bd7150', roughness: 0.85 }),
    book: [ '#b8564d', '#5f7f9a', '#c79a56', '#6f9271', '#8d6d92', '#d2b28c', '#3f5668' ].map((c) => std({ color: c, roughness: 0.8 })),
    bulb: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd9a0', emissiveIntensity: 1.6, roughness: 0.3 }),
    bulbCool: new THREE.MeshStandardMaterial({ color: '#eef4ff', emissive: '#cfe0ff', emissiveIntensity: 1.1, roughness: 0.3 }),
    lampShade: std({ color: '#f2e2c8', roughness: 0.9, emissive: '#f7d9a4', emissiveIntensity: 0.12, side: THREE.DoubleSide }),
    catFur: std({ color: '#efe3d2', roughness: 0.98 }),
    catFurDark: std({ color: '#d5bca2', roughness: 0.98 }),
    catNose: std({ color: '#e6a3a1', roughness: 0.7 }),
    catEye: std({ color: '#5f7f4a', roughness: 0.3 }),
  };

  m.sky = new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false });

  cache = m;
  return m;
}
