import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getMaterials } from './materials.js';
import { FURNITURE, SIMS } from './data.js';
import { NavGrid } from './nav.js';

const WALL_H = 2.72;
const WALL_T = 0.14;

const M = getMaterials();

// ---------------------------------------------------------------------------
// yardımcı çizim fonksiyonları
// ---------------------------------------------------------------------------
function rbox(w, h, d, mat, radius = 0.03, segments = 3) {
  const g = new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2.05, h / 2.05, d / 2.05));
  return new THREE.Mesh(g, mat);
}

function cube(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rt, rb, h, mat, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

function sph(r, mat, seg = 14) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.floor(seg * 0.8))), mat);
}

function put(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function shadow(obj, cast = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
  return obj;
}

function rotLocal(x, z, rotY) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return { x: x * c + z * s, z: -x * s + z * c };
}

function localSeat(parentX, parentZ, rotY, lx, lz, y, localYaw = 0, extra = {}) {
  const p = rotLocal(lx, lz, rotY);
  return {
    x: parentX + p.x,
    z: parentZ + p.z,
    yaw: rotY + localYaw,
    y,
    pose: extra.pose || 'sit',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Ev inşaatçısı
// ---------------------------------------------------------------------------
export function buildWorld(scene) {
  const nav = new NavGrid(-7.2, 7.4, -5.4, 8.6, 0.25);
  const objects = [];
  const fadeWalls = [];
  const lights = [];
  const onUpdate = [];
  let objCount = 0;

  // --- dış alan -----------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), M.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.07;
  ground.receiveShadow = true;
  scene.add(ground);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 24), M.sky);
  sky.position.y = 4;
  scene.add(sky);

  // yıldızlar
  const starPositions = [];
  for (let i = 0; i < 520; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const r = 62;
    starPositions.push(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r + 6,
      Math.sin(phi) * Math.sin(theta) * r,
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: '#fff4d8', size: 0.25, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- ev zemini ----------------------------------------------------------
  const floor = box3(12.3, 9.3, 0.18, M.floor, 0, -0.09, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const foundation = box3(12.7, 9.7, 0.22, M.ceramicSage, 0, -0.12, 0);
  foundation.receiveShadow = true;
  scene.add(foundation);

  function box3(w, d, h, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    return mesh;
  }

  // banyo fayansı
  const bathFloor = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.02, 3.7), M.tile);
  bathFloor.position.set(0.4, 0.011, -2.65);
  bathFloor.receiveShadow = true;
  scene.add(bathFloor);

  // --- duvarlar -----------------------------------------------------------
  function wallMaterial() {
    const m = M.wall.clone();
    m.transparent = true;
    m.opacity = 1;
    return m;
  }

  function buildWall(axis, fixed, from, to, opts = {}) {
    const {
      windows = [], doors = [], height = WALL_H, thickness = WALL_T,
      fadeNormal = null, interiorFade = null, name = '',
    } = opts;
    const mat = wallMaterial();
    const group = new THREE.Group();
    group.name = name || `wall-${axis}-${fixed}`;
    scene.add(group);
    const meshes = [];
    const openings = [
      ...windows.map((w) => ({ ...w, kind: 'window' })),
      ...doors.map((d) => ({ ...d, kind: 'door' })),
    ].sort((a, b) => a.a - b.a);

    const addBox = (a, b, y0, y1) => {
      if (b - a < 0.005 || y1 - y0 < 0.005) return;
      const len = b - a;
      const h = y1 - y0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(
        axis === 'x' ? len : thickness,
        h,
        axis === 'x' ? thickness : len,
      ), mat);
      const mid = (a + b) / 2;
      mesh.position.set(
        axis === 'x' ? mid : fixed,
        y0 + h / 2,
        axis === 'x' ? fixed : mid,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes.push(mesh);
    };

    const block = (a, b) => {
      if (axis === 'x') nav.blockRect(a, fixed - thickness / 2, b, fixed + thickness / 2);
      else nav.blockRect(fixed - thickness / 2, a, fixed + thickness / 2, b);
    };

    let cur = from;
    for (const o of openings) {
      const a = Math.max(from, o.a);
      const b = Math.min(to, o.b);
      if (a > cur) {
        addBox(cur, a, 0, height);
        block(cur, a);
      }
      if (o.kind === 'window') {
        const sill = o.sill ?? 0.95;
        const top = o.top ?? 2.08;
        addBox(a, b, 0, sill);
        addBox(a, b, top, height);
        block(a, b);
        addWindow(axis, fixed, a, b, sill, top, thickness, group);
      } else {
        const dh = o.h ?? 2.12;
        addBox(a, b, dh, height);
        addDoorFrame(axis, fixed, a, b, dh, group, o);
      }
      cur = Math.max(cur, b);
    }
    if (cur < to) {
      addBox(cur, to, 0, height);
      block(cur, to);
    }

    // duvarın tüm parçaları (cam, çerçeve, kapı) birlikte solsun
    const cloneMap = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      let m = cloneMap.get(o.material);
      if (!m) {
        m = o.material.clone();
        m.transparent = true;
        cloneMap.set(o.material, m);
        meshes.push(o);
      }
      o.material = m;
    });
    fadeWalls.push({
      group,
      mat,
      mats: [...cloneMap.values()],
      meshes,
      fadeNormal,
      interiorFade,
      opacity: 1,
    });
    return group;
  }

  function addWindow(axis, fixed, a, b, sill, top, thickness, group) {
    const len = b - a;
    const h = top - sill;
    const frameMat = M.white;
    const frameD = thickness + 0.07;
    const bar = 0.055;
    const cx = (a + b) / 2;
    const cy = (sill + top) / 2;
    const mk = (wg, hg, lg) => new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? wg : lg,
      hg,
      axis === 'x' ? lg : wg,
    ), frameMat);
    const topBar = mk(len, bar, frameD);
    topBar.position.set(axis === 'x' ? cx : fixed, top, axis === 'x' ? fixed : cx);
    group.add(topBar);
    const bottomBar = mk(len, bar, frameD + 0.06);
    bottomBar.position.set(axis === 'x' ? cx : fixed, sill, axis === 'x' ? fixed : cx);
    group.add(bottomBar);
    for (const s of [a + bar / 2, b - bar / 2]) {
      const side = mk(bar, h, frameD);
      side.position.set(axis === 'x' ? s : fixed, cy, axis === 'x' ? fixed : s);
      group.add(side);
    }
    if (len > 1.05) {
      const mull = mk(0.04, h, frameD * 0.7);
      mull.position.set(axis === 'x' ? cx : fixed, cy, axis === 'x' ? fixed : cx);
      group.add(mull);
    }
    const glass = mk(len - bar, h - bar, 0.02);
    glass.material = M.windowGlass;
    glass.position.set(axis === 'x' ? cx : fixed, cy, axis === 'x' ? fixed : cx);
    glass.castShadow = false;
    group.add(glass);
    // iç pencere pervazı
    const ledge = mk(len + 0.16, 0.05, 0.24);
    ledge.position.set(axis === 'x' ? cx : fixed - Math.sign(fixed) * 0.06, sill - 0.02, axis === 'x' ? fixed : cx);
    group.add(ledge);
  }

  function addDoorFrame(axis, fixed, a, b, dh, group, opts) {
    const frameMat = M.white;
    const bar = 0.06;
    const mk = (w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? w : d,
      h,
      axis === 'x' ? d : w,
    ), frameMat);
    for (const s of [a + bar / 2, b - bar / 2]) {
      const side = mk(bar, dh, WALL_T + 0.06);
      side.position.set(axis === 'x' ? s : fixed, dh / 2, axis === 'x' ? fixed : s);
      group.add(side);
    }
    const head = mk(b - a, bar, WALL_T + 0.06);
    head.position.set(axis === 'x' ? (a + b) / 2 : fixed, dh - bar / 2, axis === 'x' ? fixed : (a + b) / 2);
    group.add(head);

    if (opts.leaf) {
      const leafGroup = new THREE.Group();
      const leafW = (b - a) - 0.09;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, dh - 0.09, 0.045), opts.leafMat || M.doorWood || M.wood);
      leaf.position.set(leafW / 2, (dh - 0.09) / 2, 0);
      leaf.castShadow = true;
      leafGroup.add(leaf);
      const knob = sph(0.035, M.brass, 10);
      knob.position.set(leafW - 0.1, dh * 0.48, 0.05);
      leafGroup.add(knob);
      const panel = rbox(leafW * 0.66, dh * 0.6, 0.015, M.darkWood, 0.01);
      panel.position.set(leafW / 2, dh * 0.5, 0.03);
      leafGroup.add(panel);
      const hingeSide = opts.hinge === 'right' ? b : a;
      if (axis === 'x') {
        leafGroup.position.set(hingeSide, 0, fixed + (opts.swing ?? -0.08));
        leafGroup.rotation.y = opts.swingAngle ?? (opts.hinge === 'right' ? -1.15 : 1.15);
      } else {
        leafGroup.rotation.y = Math.PI / 2;
        leafGroup.position.set(fixed + (opts.swing ?? -0.08), 0, hingeSide);
        leafGroup.rotation.y += opts.swingAngle ?? (opts.hinge === 'right' ? -1.15 : 1.15);
      }
      group.add(leafGroup);
    }
  }

  // dış duvarlar
  buildWall('x', -4.5, -6, 6, {
    windows: [
      { a: -4.9, b: -3.4 },
      { a: 0.05, b: 0.85, sill: 1.5, top: 2.2 },
      { a: 3.0, b: 4.4 },
    ],
    fadeNormal: { x: 0, z: -1 }, name: 'kuzey-duvar',
  });
  buildWall('x', 4.5, -6, 6, {
    windows: [
      { a: -5.3, b: -3.7, sill: 1.05 },
      { a: 2.6, b: 4.3 },
    ],
    doors: [{ a: -0.44, b: 0.66, h: 2.15, leaf: true, hinge: 'left', swingAngle: 1.25 }],
    fadeNormal: { x: 0, z: 1 }, name: 'guney-duvar',
  });
  buildWall('z', -6, -4.5, 4.5, {
    windows: [
      { a: -3.4, b: -2.0 },
      { a: 1.6, b: 2.9, sill: 1.05 },
    ],
    fadeNormal: { x: -1, z: 0 }, name: 'bati-duvar',
  });
  buildWall('z', 6, -4.5, 4.5, {
    windows: [
      { a: -3.1, b: -1.8 },
      { a: 0.1, b: 1.5, sill: 1.0 },
    ],
    fadeNormal: { x: 1, z: 0 }, name: 'dogu-duvar',
  });

  // iç duvar (odaların önü)
  buildWall('x', -0.8, -6, 6, {
    doors: [
      { a: -3.5, b: -2.5, h: 2.12, leaf: true, hinge: 'left', swingAngle: 1.2 },
      { a: -0.08, b: 0.8, h: 2.12, leaf: true, hinge: 'right', swingAngle: 1.2 },
      { a: 4.0, b: 5.1, h: 2.15, leaf: true, hinge: 'left', swingAngle: 1.2 },
    ],
    interiorFade: 'south', name: 'koridor-duvar',
  });
  buildWall('z', -1.0, -4.5, -0.8, { fadeNormal: null, name: 'yatak-banyo' });
  buildWall('z', 1.8, -4.5, -0.8, { fadeNormal: null, name: 'banyo-calisma' });

  // --- teras --------------------------------------------------------------
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.12, 3.2), M.deck);
  deck.position.set(0.8, 0.0, 6.25);
  deck.receiveShadow = true;
  scene.add(deck);
  const deckEdge = box3(6.1, 0.16, 0.9, M.darkWood, 0.8, -0.06, 4.55);
  deckEdge.receiveShadow = true;
  scene.add(deckEdge);

  // teras dışındaki alanı kapat (çimlere çıkılmasın)
  nav.blockRect(-7.2, 4.66, -2.25, 8.6);
  nav.blockRect(3.85, 4.66, 7.4, 8.6);
  nav.blockRect(-7.2, 7.95, 7.4, 8.6);

  // basamaklar
  for (let i = 0; i < 2; i++) {
    const step = box3(2.2, 0.3 + i * 0.16, 0.42, M.deck, 0.8, -0.06 + i * 0.08, 7.98 + i * 0.4);
    step.receiveShadow = true;
    scene.add(step);
  }
  nav.blockRect(0.8 - 1.1, 8.1, 0.8 + 1.1, 8.6);

  // --- kayıt yardımcıları -------------------------------------------------
  function register(type, group, opts) {
    const def = FURNITURE[type];
    const obj = {
      id: `${type}-${++objCount}`,
      type,
      def,
      label: opts.label || def.label,
      icon: opts.icon || def.icon,
      group,
      x: opts.x,
      z: opts.z,
      seats: opts.seats || [],
      standSlots: opts.standSlots || [],
      lieSlots: opts.lieSlots || [],
      light: opts.light || null,
      screen: opts.screen || null,
      onUse: opts.onUse || null,
    };
    const pick = { type: 'object', ref: obj };
    group.userData.pick = pick;
    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.pick = pick;
      }
    });
    scene.add(group);
    objects.push(obj);
    for (const b of opts.blocks || []) nav.blockRect(b.x1, b.z1, b.x2, b.z2);
    return obj;
  }

  function addPointLight(x, y, z, color = '#ffd9a3', intensity = 6, distance = 6.5) {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    l.castShadow = false;
    scene.add(l);
    return l;
  }

  // =========================================================================
  // MUTFAK
  // =========================================================================

  // buzdolabı
  {
    const g = new THREE.Group();
    const body = rbox(0.72, 1.86, 0.72, M.cream, 0.06);
    body.position.y = 0.93;
    g.add(body);
    const doorLine = cube(0.74, 0.015, 0.015, M.metal);
    doorLine.position.set(0, 1.16, 0.365);
    g.add(doorLine);
    const handleTop = rbox(0.035, 0.5, 0.05, M.metal, 0.015);
    handleTop.position.set(0.27, 1.48, 0.39);
    g.add(handleTop);
    const handleBottom = handleTop.clone();
    handleBottom.position.set(0.27, 0.72, 0.39);
    g.add(handleBottom);
    // magnetler
    const magnets = ['#d97b5f', '#e8c46a', '#7fa892'];
    magnets.forEach((c, i) => {
      const mag = cube(0.07, 0.07, 0.02, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
      mag.position.set(-0.18 + i * 0.09, 1.35 + (i % 2) * 0.08, 0.372);
      mag.rotation.z = i * 0.3;
      g.add(mag);
    });
    g.position.set(-5.55, 0, -0.25);
    g.rotation.y = Math.PI / 2;
    register('fridge', g, {
      x: -5.55, z: -0.25,
      standSlots: [{ x: -4.75, z: -0.25, yaw: -Math.PI / 2 }],
      blocks: [{ x1: -5.95, z1: -0.64, x2: -5.15, z2: 0.14 }],
    });
  }

  // mutfak tezgahı + ocak + lavabo
  {
    const g = new THREE.Group();
    const base = rbox(0.62, 0.86, 3.0, M.cream, 0.03);
    base.position.set(-5.6, 0.44, 1.7);
    g.add(base);
    const counterTop = rbox(0.7, 0.07, 3.1, M.counter, 0.025);
    counterTop.position.set(-5.58, 0.905, 1.7);
    g.add(counterTop);
    const kick = cube(0.5, 0.1, 2.9, M.darkWood);
    kick.position.set(-5.66, 0.05, 1.7);
    g.add(kick);
    // dolap kapakları
    for (let i = 0; i < 3; i++) {
      const door = rbox(0.03, 0.68, 0.9, M.cream, 0.01);
      door.position.set(-5.28, 0.5, 0.6 + i * 1.0);
      door.userData.noPick = true;
      g.add(door);
      const handle = cyl(0.012, 0.012, 0.18, M.metal, 8);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(-5.25, 0.78, 0.6 + i * 1.0 + 0.28);
      g.add(handle);
    }
    // tezgah üstü
    const sinkBase = rbox(0.5, 0.035, 0.62, M.metal, 0.02);
    sinkBase.position.set(-5.58, 0.935, 0.85);
    g.add(sinkBase);
    const sinkHole = rbox(0.4, 0.03, 0.5, M.black, 0.02);
    sinkHole.position.set(-5.58, 0.94, 0.85);
    g.add(sinkHole);
    const faucet = new THREE.Group();
    const pipe = cyl(0.022, 0.022, 0.32, M.metal, 10);
    pipe.position.y = 0.16;
    faucet.add(pipe);
    const arm = cyl(0.02, 0.02, 0.22, M.metal, 10);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.1, 0.32, 0);
    faucet.add(arm);
    faucet.position.set(-5.82, 0.94, 0.85);
    g.add(faucet);
    // ocak
    const hob = rbox(0.56, 0.03, 0.72, M.darkMetal, 0.01);
    hob.position.set(-5.56, 0.95, 2.34);
    g.add(hob);
    for (let i = 0; i < 4; i++) {
      const burner = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), M.metal);
      burner.rotation.x = Math.PI / 2;
      burner.position.set(-5.72 + (i % 2) * 0.3, 0.965, 2.15 + Math.floor(i / 2) * 0.36);
      g.add(burner);
    }
    for (let i = 0; i < 4; i++) {
      const knob = cyl(0.022, 0.022, 0.03, M.metal, 10);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(-5.27, 0.83, 2.1 + i * 0.16);
      g.add(knob);
    }
    // davlumbaz
    const hood = rbox(0.55, 0.32, 0.85, M.metal, 0.03);
    hood.position.set(-5.72, 1.95, 2.34);
    g.add(hood);
    // üst dolaplar
    const upper = rbox(0.42, 0.72, 2.4, M.cream, 0.03);
    upper.position.set(-5.78, 1.88, 1.55);
    g.add(upper);
    for (let i = 0; i < 3; i++) {
      const d = rbox(0.02, 0.62, 0.72, M.cream, 0.01);
      d.position.set(-5.56, 1.88, 0.6 + i * 0.8);
      g.add(d);
      const h = cyl(0.01, 0.01, 0.12, M.metal, 6);
      h.position.set(-5.54, 1.6, 0.6 + i * 0.8 + 0.26);
      g.add(h);
    }
    // tezgah detayları
    const kettle = new THREE.Group();
    const kb = sph(0.11, M.ceramicRust);
    kb.scale.set(1, 0.8, 1);
    kb.position.y = 0.07;
    kettle.add(kb);
    const spout = cyl(0.02, 0.03, 0.14, M.ceramicRust, 8);
    spout.rotation.z = -0.7;
    spout.position.set(0.11, 0.1, 0);
    kettle.add(spout);
    const khandle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 14, Math.PI), M.black);
    khandle.position.y = 0.18;
    kettle.add(khandle);
    kettle.position.set(-5.55, 0.95, 1.55);
    g.add(kettle);
    // meyve kasesi
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.ceramicSage);
    bowl.position.set(-5.56, 1.02, 3.0);
    g.add(bowl);
    const fruits = ['#d9644a', '#e8b83f', '#7f9e5b'];
    fruits.forEach((c, i) => {
      const f = sph(0.055, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }), 10);
      f.position.set(-5.6 + (i % 2) * 0.08, 1.05, 2.94 + Math.floor(i / 2) * 0.08 + (i % 2) * 0.04);
      g.add(f);
    });
    // kesme tahtası
    const board = rbox(0.28, 0.03, 0.4, M.wood, 0.01);
    board.position.set(-5.52, 0.965, 2.95);
    board.rotation.y = 0.2;
    g.add(board);
    // baharat kavanozları
    for (let i = 0; i < 3; i++) {
      const jar = cyl(0.035, 0.035, 0.13, M.glass, 10);
      jar.position.set(-5.8, 1.03, 0.35 + i * 0.12);
      g.add(jar);
    }
    // mutfak halısı
    const matMesh = cube(0.9, 0.012, 1.6, M.sofaRust);
    matMesh.position.set(-4.8, 0.012, 1.0);
    g.add(matMesh);

    const sinkSeat = { x: -4.85, z: 0.85, yaw: -Math.PI / 2 };
    const stoveSeat = { x: -4.85, z: 2.34, yaw: -Math.PI / 2 };
    register('counter', g, {
      x: -5.58, z: 1.6,
      standSlots: [
        { ...sinkSeat },
        { ...stoveSeat },
        { x: -5.0, z: 3.55, yaw: -Math.PI / 2 },
      ],
      blocks: [{ x1: -5.98, z1: 0.12, x2: -5.18, z2: 3.28 }],
    });
  }

  // mutfak masası + sandalyeler
  {
    const g = new THREE.Group();
    const top = rbox(1.5, 0.07, 0.95, M.wood, 0.04);
    top.position.y = 0.76;
    g.add(top);
    for (const [x, z] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) {
      const leg = cyl(0.045, 0.035, 0.74, M.darkWood, 8);
      leg.position.set(x, 0.37, z);
      g.add(leg);
    }
    // tabaklar ve bardak
    const plate = cyl(0.16, 0.14, 0.02, M.ceramic);
    plate.position.set(-0.35, 0.805, 0.1);
    g.add(plate);
    const plate2 = plate.clone();
    plate2.position.set(0.35, 0.805, -0.1);
    g.add(plate2);
    const cup = cyl(0.05, 0.042, 0.09, M.ceramicRust, 12);
    cup.position.set(-0.05, 0.84, -0.18);
    g.add(cup);
    const vase = cyl(0.055, 0.075, 0.18, M.ceramicSage, 12);
    vase.position.set(0.03, 0.88, 0.22);
    g.add(vase);
    for (let i = 0; i < 3; i++) {
      const stem = cyl(0.006, 0.006, 0.24, M.leafDark, 4);
      stem.position.set(0.03 + (i - 1) * 0.02, 1.03, 0.22);
      stem.rotation.z = (i - 1) * 0.2;
      g.add(stem);
      const flower = sph(0.032, new THREE.MeshStandardMaterial({ color: i === 1 ? '#e8b9a5' : '#d98a76', roughness: 0.7 }), 8);
      flower.position.set(0.03 + (i - 1) * 0.04, 1.15, 0.22);
      g.add(flower);
    }
    // sandalyeler
    const chairParts = (cx, cz, rot) => {
      const ch = new THREE.Group();
      const seat = rbox(0.44, 0.06, 0.44, M.wood, 0.03);
      seat.position.y = 0.46;
      ch.add(seat);
      const cushion = rbox(0.4, 0.05, 0.38, M.cream, 0.02);
      cushion.position.y = 0.5;
      ch.add(cushion);
      const back = rbox(0.44, 0.5, 0.06, M.wood, 0.03);
      back.position.set(0, 0.76, -0.19);
      back.rotation.x = 0.06;
      ch.add(back);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const leg = cyl(0.022, 0.018, 0.45, M.darkWood, 6);
        leg.position.set(lx, 0.23, lz);
        ch.add(leg);
      }
      ch.position.set(cx, 0, cz);
      ch.rotation.y = rot;
      g.add(ch);
    };
    chairParts(0, -0.85, 0);
    chairParts(0, 0.85, Math.PI);
    // sarkıt lamba
    const cord = cyl(0.008, 0.008, 0.9, M.black, 4);
    cord.position.set(0, 2.25, 0);
    g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.26, 20, 1, true), M.lampShade);
    shade.position.set(0, 1.78, 0);
    shade.rotation.x = Math.PI;
    g.add(shade);
    const bulb = sph(0.06, M.bulb, 10);
    bulb.position.set(0, 1.68, 0);
    g.add(bulb);

    g.position.set(-3.25, 0, 1.9);
    const light = addPointLight(-3.25, 1.62, 1.9, '#ffd2a0', 7, 5.5);
    lights.push({ light, kind: 'indoor', base: 7 });
    register('table', g, {
      x: -3.25, z: 1.9,
      seats: [
        { x: -3.25, z: 1.075, yaw: 0, y: 0.5, pose: 'sit', approach: { x: -3.25, z: 0.42 } },
        { x: -3.25, z: 2.725, yaw: Math.PI, y: 0.5, pose: 'sit', approach: { x: -3.25, z: 3.4 } },
      ],
      standSlots: [
        { x: -4.6, z: 1.9, yaw: Math.PI / 2 },
        { x: -1.9, z: 1.9, yaw: -Math.PI / 2 },
      ],
      blocks: [
        { x1: -4.0, z1: 1.42, x2: -2.5, z2: 2.38 },
        { x1: -3.48, z1: 0.85, x2: -3.02, z2: 1.3 },
        { x1: -3.48, z1: 2.5, x2: -3.02, z2: 2.95 },
      ],
    });
  }

  // =========================================================================
  // SALON
  // =========================================================================

  // halı
  {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.025, 3.1), M.rug);
    rug.position.set(4.15, 0.015, 2.35);
    rug.receiveShadow = true;
    scene.add(rug);
  }

  // kanepe
  {
    const g = new THREE.Group();
    const base = rbox(2.3, 0.34, 0.92, M.sofaSageDark, 0.08);
    base.position.y = 0.31;
    g.add(base);
    const cushions = [-0.72, 0, 0.72];
    for (const x of cushions) {
      const c = rbox(0.69, 0.17, 0.8, M.sofaSage, 0.07);
      c.position.set(x, 0.52, 0.02);
      g.add(c);
    }
    const back = rbox(2.3, 0.68, 0.24, M.sofaSageDark, 0.09);
    back.position.set(0, 0.72, -0.35);
    back.rotation.x = -0.06;
    g.add(back);
    for (const x of cushions) {
      const bc = rbox(0.68, 0.5, 0.16, M.sofaSage, 0.07);
      bc.position.set(x, 0.7, -0.24);
      bc.rotation.x = -0.12;
      g.add(bc);
    }
    for (const side of [-1, 1]) {
      const arm = rbox(0.2, 0.56, 0.94, M.sofaSageDark, 0.07);
      arm.position.set(side * 1.06, 0.5, 0);
      g.add(arm);
      for (const [fx, fz] of [[side * 0.95, -0.34], [side * 0.95, 0.34]]) {
        const foot = cyl(0.035, 0.026, 0.16, M.darkWood, 8);
        foot.position.set(fx, 0.09, fz);
        g.add(foot);
      }
    }
    // yastıklar
    const p1 = rbox(0.4, 0.38, 0.14, M.sofaRust, 0.06);
    p1.position.set(-0.62, 0.68, -0.1);
    p1.rotation.z = 0.25;
    g.add(p1);
    const p2 = rbox(0.34, 0.34, 0.13, M.cream, 0.06);
    p2.position.set(0.7, 0.64, -0.08);
    p2.rotation.z = -0.3;
    g.add(p2);
    // battaniye
    const blanket = rbox(0.5, 0.06, 0.5, M.duvet, 0.02);
    blanket.position.set(0.95, 0.62, 0.05);
    blanket.rotation.z = 0.04;
    g.add(blanket);

    g.position.set(3.55, 0, 2.2);
    g.rotation.y = Math.PI / 2;
    register('sofa', g, {
      x: 3.55, z: 2.2,
      seats: [-0.72, 0, 0.72].map((lx) => localSeat(3.55, 2.2, Math.PI / 2, lx, 0.02, 0.53, 0,
        { approach: { x: 3.55 + 0.72, z: 2.2 - lx } })),
      standSlots: [
        { x: 3.55 + 0.75, z: 2.2 - 1.3, yaw: 0 },
        { x: 3.55 + 0.75, z: 2.2 + 1.3, yaw: 0 },
      ],
      blocks: [{ x1: 3.06, z1: 1.02, x2: 4.02, z2: 3.38 }],
    });
  }

  // sehpa
  {
    const g = new THREE.Group();
    const top = rbox(0.95, 0.06, 1.5, M.wood, 0.06);
    top.position.y = 0.42;
    g.add(top);
    const lower = rbox(0.8, 0.04, 1.3, M.darkWood, 0.02);
    lower.position.y = 0.16;
    g.add(lower);
    for (const [x, z] of [[-0.38, -0.62], [0.38, -0.62], [-0.38, 0.62], [0.38, 0.62]]) {
      const leg = cyl(0.028, 0.024, 0.4, M.darkWood, 8);
      leg.position.set(x, 0.21, z);
      g.add(leg);
    }
    const book = rbox(0.3, 0.05, 0.22, M.book[0], 0.01);
    book.position.set(-0.2, 0.47, 0.1);
    book.rotation.y = 0.3;
    g.add(book);
    const book2 = rbox(0.26, 0.04, 0.2, M.book[2], 0.01);
    book2.position.set(-0.16, 0.51, 0.05);
    book2.rotation.y = 0.15;
    g.add(book2);
    const mug = cyl(0.06, 0.05, 0.1, M.ceramic, 12);
    mug.position.set(0.2, 0.48, -0.35);
    g.add(mug);
    const candle = cyl(0.05, 0.05, 0.09, M.cream, 10);
    candle.position.set(0.15, 0.48, 0.4);
    g.add(candle);
    const flame = sph(0.018, new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffae42', emissiveIntensity: 2 }), 8);
    flame.position.set(0.15, 0.55, 0.4);
    g.add(flame);
    // küçük yeşil
    const pot = cyl(0.09, 0.07, 0.14, M.terracotta, 12);
    pot.position.set(-0.25, 0.48, -0.45);
    g.add(pot);
    for (let i = 0; i < 4; i++) {
      const leaf = sph(0.07, M.leaf, 8);
      leaf.scale.set(1, 0.4, 1.4);
      leaf.position.set(-0.25 + Math.cos(i * 1.6) * 0.05, 0.58, -0.45 + Math.sin(i * 1.6) * 0.05);
      leaf.rotation.y = i;
      g.add(leaf);
    }

    g.position.set(4.78, 0, 2.2);
    scene.add(shadow(g));
    nav.blockRect(4.28, 1.42, 5.28, 2.98);
  }

  // TV ünitesi
  {
    const g = new THREE.Group();
    const consoleBody = rbox(1.9, 0.46, 0.42, M.wood, 0.04);
    consoleBody.position.y = 0.28;
    g.add(consoleBody);
    for (const x of [-0.45, 0.45]) {
      const door = rbox(0.8, 0.36, 0.02, M.darkWood, 0.01);
      door.position.set(x, 0.28, 0.215);
      g.add(door);
      const handle = cyl(0.012, 0.012, 0.12, M.brass, 6);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(x, 0.3, 0.235);
      g.add(handle);
    }
    // TV
    const tvGroup = new THREE.Group();
    const frame = rbox(1.5, 0.88, 0.07, M.black, 0.02);
    tvGroup.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.78), M.screen);
    screen.position.z = 0.04;
    tvGroup.add(screen);
    const standBase = rbox(0.42, 0.03, 0.22, M.darkMetal, 0.01);
    standBase.position.y = -0.48;
    tvGroup.add(standBase);
    const standPole = cyl(0.03, 0.03, 0.12, M.darkMetal, 8);
    standPole.position.y = -0.42;
    tvGroup.add(standPole);
    tvGroup.position.set(0, 0.96, 0);
    g.add(tvGroup);
    const soundbar = rbox(0.9, 0.08, 0.1, M.darkMetal, 0.02);
    soundbar.position.set(0, 0.55, 0.16);
    g.add(soundbar);
    // saksı detayı
    const plantPot = cyl(0.09, 0.07, 0.16, M.ceramicSage, 12);
    plantPot.position.set(-0.75, 0.59, 0.05);
    g.add(plantPot);

    g.position.set(5.74, 0, 2.2);
    g.rotation.y = -Math.PI / 2;
    const obj = register('tv', g, {
      x: 5.74, z: 2.2,
      standSlots: [
        { x: 5.0, z: 3.55, yaw: Math.PI * 0.18 },
      ],
      blocks: [{ x1: 5.5, z1: 1.2, x2: 5.99, z2: 3.2 }],
      screen,
    });
    obj.screen = screen;
  }

  // kitaplık
  {
    const g = new THREE.Group();
    const frameMat = M.wood;
    const box = rbox(1.45, 1.95, 0.36, frameMat, 0.03);
    box.position.y = 0.98;
    g.add(box);
    const inner = rbox(1.3, 1.8, 0.3, M.darkWood, 0.01);
    inner.position.set(0, 0.98, 0.05);
    g.add(inner);
    for (let s = 0; s < 4; s++) {
      const shelf = cube(1.3, 0.035, 0.33, M.wood);
      shelf.position.set(0, 0.28 + s * 0.44, 0.06);
      g.add(shelf);
      let x = -0.58;
      const count = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const w = 0.045 + Math.random() * 0.04;
        const h = 0.24 + Math.random() * 0.1;
        const depth = 0.2 + Math.random() * 0.05;
        const b = rbox(w, h, depth, M.book[Math.floor(Math.random() * M.book.length)], 0.006);
        b.position.set(x + w / 2, 0.3 + s * 0.44 + h / 2, 0.07);
        if (Math.random() > 0.9) b.rotation.z = 0.12;
        g.add(b);
        x += w + 0.012;
        if (x > 0.6) break;
      }
      if (s === 2) {
        const orb = sph(0.09, M.ceramicRust, 12);
        orb.position.set(0.42, 0.3 + s * 0.44 + 0.09, 0.08);
        g.add(orb);
      }
    }
    g.position.set(1.55, 0, -0.58);
    register('bookshelf', g, {
      x: 1.55, z: -0.58,
      standSlots: [{ x: 1.55, z: 0.3, yaw: Math.PI }],
      blocks: [{ x1: 0.8, z1: -0.78, x2: 2.3, z2: -0.38 }],
    });
  }

  // radyo konsolu
  {
    const g = new THREE.Group();
    const console3 = rbox(1.0, 0.7, 0.36, M.wood, 0.03);
    console3.position.y = 0.36;
    g.add(console3);
    for (const x of [-0.24, 0.24]) {
      const leg = cyl(0.025, 0.02, 0.2, M.darkWood, 8);
      leg.position.set(x, 0.1, 0.1);
      g.add(leg);
    }
    const radio = new THREE.Group();
    const body = rbox(0.42, 0.26, 0.16, M.darkWood, 0.03);
    radio.add(body);
    const speaker = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), M.darkMetal);
    speaker.position.set(-0.1, 0.01, 0.085);
    radio.add(speaker);
    for (let i = 0; i < 3; i++) {
      const line = cube(0.11, 0.006, 0.005, M.wood);
      line.position.set(-0.1, 0.06 - i * 0.05, 0.087);
      radio.add(line);
    }
    for (let i = 0; i < 2; i++) {
      const knob = cyl(0.022, 0.022, 0.02, M.brass, 10);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.1 + i * 0.075, 0.04, 0.09);
      radio.add(knob);
    }
    const antenna = cyl(0.004, 0.004, 0.34, M.metal, 5);
    antenna.position.set(0.13, 0.28, 0);
    antenna.rotation.z = -0.3;
    radio.add(antenna);
    radio.position.set(0, 0.84, 0);
    g.add(radio);
    // plaklar
    const sleeve = rbox(0.28, 0.005, 0.28, M.paper, 0.005);
    sleeve.position.set(0.27, 0.72, 0.02);
    sleeve.rotation.y = 0.3;
    g.add(sleeve);
    const lampBase = cyl(0.06, 0.09, 0.3, M.ceramicSage, 12);
    lampBase.position.set(-0.36, 0.86, 0);
    g.add(lampBase);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 16, 1, true), M.lampShade);
    lampShade.position.set(-0.36, 1.06, 0);
    lampShade.rotation.x = Math.PI;
    g.add(lampShade);

    g.position.set(5.72, 0, 0.15);
    g.rotation.y = -Math.PI / 2;
    register('radio', g, {
      x: 5.72, z: 0.15,
      standSlots: [
        { x: 4.95, z: 0.15, yaw: -Math.PI / 2 },
        { x: 4.95, z: -0.55, yaw: -Math.PI / 2 },
      ],
      blocks: [{ x1: 5.5, z1: -0.4, x2: 5.99, z2: 0.7 }],
    });
  }

  // gitar
  {
    const g = new THREE.Group();
    const bodyG = new THREE.Group();
    const lower = sph(0.25, M.honey, 16);
    lower.scale.set(1, 1.12, 0.22);
    lower.position.y = 0.32;
    bodyG.add(lower);
    const upper = sph(0.18, M.honey, 16);
    upper.scale.set(0.85, 1, 0.2);
    upper.position.y = 0.52;
    bodyG.add(upper);
    const soundHole = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), M.black);
    soundHole.position.set(0, 0.44, 0.058);
    bodyG.add(soundHole);
    const neck = cube(0.07, 0.6, 0.045, M.darkWood);
    neck.position.y = 0.92;
    bodyG.add(neck);
    const head = cube(0.1, 0.16, 0.05, M.black);
    head.position.y = 1.27;
    bodyG.add(head);
    const bridge = cube(0.16, 0.02, 0.05, M.darkWood);
    bridge.position.set(0, 0.33, 0.05);
    bodyG.add(bridge);
    // tel
    const strings = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.9, 0.006), M.metal);
    strings.position.set(0, 0.82, 0.06);
    bodyG.add(strings);
    bodyG.rotation.x = -0.18;
    bodyG.rotation.z = 0.12;
    g.add(bodyG);
    const stand = new THREE.Group();
    const standPole = cyl(0.015, 0.02, 0.5, M.darkMetal, 6);
    standPole.position.y = 0.25;
    stand.add(standPole);
    for (let i = 0; i < 3; i++) {
      const leg = cyl(0.012, 0.012, 0.3, M.darkMetal, 6);
      leg.position.set(Math.cos(i * 2.1) * 0.1, 0.14, Math.sin(i * 2.1) * 0.1);
      leg.rotation.z = Math.cos(i * 2.1) * 0.4;
      leg.rotation.x = -Math.sin(i * 2.1) * 0.4;
      stand.add(leg);
    }
    g.add(stand);

    g.position.set(2.55, 0, -0.35);
    g.rotation.y = -0.4;
    register('guitar', g, {
      x: 2.55, z: -0.35,
      standSlots: [{ x: 2.65, z: 0.42, yaw: Math.PI }],
      blocks: [{ x1: 2.25, z1: -0.6, x2: 2.85, z2: -0.1 }],
    });
  }

  // koltuk
  {
    const g = new THREE.Group();
    const seat = rbox(0.78, 0.24, 0.78, M.sofaRust, 0.08);
    seat.position.y = 0.38;
    g.add(seat);
    const back = rbox(0.8, 0.66, 0.2, M.sofaRust, 0.08);
    back.position.set(0, 0.65, -0.3);
    back.rotation.x = -0.12;
    g.add(back);
    for (const side of [-1, 1]) {
      const arm = rbox(0.16, 0.38, 0.74, M.sofaRust, 0.07);
      arm.position.set(side * 0.36, 0.55, 0.02);
      g.add(arm);
    }
    const cushion = rbox(0.66, 0.12, 0.62, M.cream, 0.06);
    cushion.position.set(0, 0.53, 0.04);
    g.add(cushion);
    for (const [x, z] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.3], [0.3, 0.3]]) {
      const leg = cyl(0.03, 0.023, 0.2, M.darkWood, 8);
      leg.position.set(x, 0.18, z);
      g.add(leg);
    }
    const throwPillow = rbox(0.3, 0.3, 0.12, M.sofaSage, 0.05);
    throwPillow.position.set(0.05, 0.66, -0.17);
    throwPillow.rotation.z = 0.18;
    g.add(throwPillow);

    g.position.set(1.85, 0, 3.62);
    g.rotation.y = 1.95;
    register('chair', g, {
      x: 1.85, z: 3.62,
      seats: [localSeat(1.85, 3.62, 1.95, 0.03, 0.05, 0.52, 0, { approach: { x: 1.85 + Math.sin(1.95) * 0.7, z: 3.62 + Math.cos(1.95) * 0.7 } })],
      blocks: [{ x1: 1.35, z1: 3.12, x2: 2.35, z2: 4.12 }],
    });
  }

  // zemin lambası
  {
    const g = new THREE.Group();
    const base = cyl(0.18, 0.22, 0.05, M.darkMetal, 16);
    base.position.y = 0.03;
    g.add(base);
    const pole = cyl(0.018, 0.018, 1.5, M.brass, 8);
    pole.position.y = 0.78;
    g.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.28, 20, 1, true), M.lampShade);
    shade.position.y = 1.55;
    g.add(shade);
    const bulb = sph(0.07, M.bulb, 10);
    bulb.position.y = 1.48;
    g.add(bulb);
    const light = addPointLight(0, 1.45, 0, '#ffd7a3', 9, 6);
    g.add(light);
    g.position.set(2.9, 0, 3.95);
    const obj = register('lamp', g, {
      x: 2.9, z: 3.95,
      standSlots: [{ x: 2.95, z: 3.3, yaw: Math.PI }],
      blocks: [{ x1: 2.68, z1: 3.73, x2: 3.12, z2: 4.17 }],
    });
    obj.light = light;
    lights.push({ light, kind: 'indoorBase', base: 9 });
  }

  // saksılar
  function makePlant(scale, potMat = M.terracotta) {
    const g = new THREE.Group();
    const pot = cyl(0.26 * scale, 0.2 * scale, 0.42 * scale, potMat, 16);
    pot.position.y = 0.21 * scale;
    g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26 * scale, 0.025 * scale, 6, 20), potMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.42 * scale;
    g.add(rim);
    const soil = cyl(0.23 * scale, 0.23 * scale, 0.03, M.soil, 14);
    soil.position.y = 0.41 * scale;
    g.add(soil);
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.3;
      const stem = cyl(0.012 * scale, 0.014 * scale, 0.55 * scale, M.leafDark, 5);
      stem.position.set(Math.cos(a) * 0.08 * scale, 0.65 * scale, Math.sin(a) * 0.08 * scale);
      stem.rotation.z = Math.cos(a) * 0.3;
      stem.rotation.x = -Math.sin(a) * 0.3;
      g.add(stem);
      const leaf = sph(0.2 * scale, i % 2 ? M.leaf : M.leafLight, 10);
      leaf.scale.set(1, 0.35, 0.7);
      leaf.position.set(Math.cos(a) * 0.33 * scale, (0.9 + (i % 3) * 0.12) * scale, Math.sin(a) * 0.33 * scale);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.2;
      g.add(leaf);
    }
    return g;
  }

  {
    const g = makePlant(1.0);
    g.position.set(5.55, 0, 4.05);
    register('plant', g, {
      x: 5.55, z: 4.05,
      standSlots: [{ x: 4.9, z: 4.05, yaw: -Math.PI / 2 }],
      blocks: [{ x1: 5.25, z1: 3.75, x2: 5.9, z2: 4.35 }],
    });
  }
  {
    const g = makePlant(0.85, M.ceramicSage);
    g.position.set(2.35, 0, 4.08);
    register('plant', g, {
      x: 2.35, z: 4.08,
      standSlots: [{ x: 2.35, z: 3.4, yaw: Math.PI }],
      blocks: [{ x1: 2.1, z1: 3.83, x2: 2.6, z2: 4.33 }],
    });
  }

  // tablo (salon)
  {
    const g = new THREE.Group();
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 0.05), M.picture1);
    g.add(canvas);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.83, 0.035), M.darkWood);
    frame.position.z = -0.02;
    g.add(frame);
    g.position.set(3.1, 1.62, -0.72);
    const obj = register('painting', g, {
      x: 3.1, z: -0.72,
      standSlots: [{ x: 3.1, z: 0.05, yaw: Math.PI }],
    });
    void obj;
  }

  // =========================================================================
  // YATAK ODASI
  // =========================================================================
  {
    const g = new THREE.Group();
    // çerçeve
    const frame = rbox(2.1, 0.28, 1.85, M.wood, 0.05);
    frame.position.y = 0.24;
    g.add(frame);
    for (const [x, z] of [[-0.95, -0.82], [0.95, -0.82], [-0.95, 0.82], [0.95, 0.82]]) {
      const leg = cyl(0.045, 0.035, 0.16, M.darkWood, 8);
      leg.position.set(x, 0.08, z);
      g.add(leg);
    }
    // karyola
    const mattress = rbox(1.98, 0.24, 1.74, M.linen, 0.07);
    mattress.position.y = 0.48;
    g.add(mattress);
    // yorgan
    const duvet = rbox(1.42, 0.16, 1.8, M.duvet, 0.09);
    duvet.position.set(0.24, 0.62, 0);
    g.add(duvet);
    const duvetFold = rbox(0.22, 0.1, 1.8, M.linen, 0.04);
    duvetFold.position.set(-0.5, 0.64, 0);
    g.add(duvetFold);
    // yastıklar
    for (const z of [-0.42, 0.42]) {
      const pillow = rbox(0.44, 0.16, 0.64, M.pillow, 0.08);
      pillow.position.set(-0.66, 0.66, z);
      pillow.rotation.z = 0.06;
      g.add(pillow);
      const pillow2 = rbox(0.34, 0.13, 0.5, M.cream, 0.06);
      pillow2.position.set(-0.62, 0.74, z * 1.02);
      pillow2.rotation.z = 0.1;
      g.add(pillow2);
    }
    // başlık
    const headboard = rbox(0.13, 1.05, 1.95, M.wood, 0.06);
    headboard.position.set(-1.02, 0.72, 0);
    g.add(headboard);
    for (let i = 0; i < 5; i++) {
      const tuft = sph(0.032, M.brass, 8);
      tuft.position.set(-0.95, 0.68 + (i % 2) * 0.3, -0.6 + Math.floor(i / 2) * 0.3);
      g.add(tuft);
    }
    // battaniye ucu
    const throwBlanket = rbox(0.7, 0.07, 1.79, M.sofaSage, 0.03);
    throwBlanket.position.set(0.85, 0.68, 0);
    g.add(throwBlanket);

    g.position.set(-4.85, 0, -2.65);
    const seats = [];
    for (const z of [-2.2, -3.1]) {
      seats.push({
        x: -4.76, z, yaw: Math.PI / 2, y: 0.6, pose: 'lie',
        approach: { x: -3.5, z },
      });
    }
    register('bed', g, {
      x: -4.85, z: -2.65,
      lieSlots: seats,
      standSlots: [{ x: -3.7, z: -1.35, yaw: Math.PI * 0.9 }],
      blocks: [{ x1: -5.95, z1: -3.62, x2: -3.72, z2: -1.68 }],
    });
  }

  // komodinler ve lambalar
  for (const z of [-1.35, -3.95]) {
    const g = new THREE.Group();
    const body = rbox(0.52, 0.46, 0.44, M.wood, 0.04);
    body.position.y = 0.29;
    g.add(body);
    const drawer = rbox(0.44, 0.16, 0.02, M.darkWood, 0.01);
    drawer.position.set(0, 0.33, 0.225);
    g.add(drawer);
    const knob = sph(0.025, M.brass, 8);
    knob.position.set(0, 0.33, 0.24);
    g.add(knob);
    for (const [x, zz] of [[-0.19, -0.15], [0.19, -0.15], [-0.19, 0.15], [0.19, 0.15]]) {
      const leg = cyl(0.022, 0.017, 0.12, M.darkWood, 6);
      leg.position.set(x, 0.06, zz);
      g.add(leg);
    }
    const lampBase = cyl(0.07, 0.09, 0.06, M.brass, 12);
    lampBase.position.y = 0.55;
    g.add(lampBase);
    const lampPole = cyl(0.014, 0.014, 0.3, M.brass, 6);
    lampPole.position.y = 0.72;
    g.add(lampPole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.2, 18, 1, true), M.lampShade);
    shade.position.y = 0.93;
    g.add(shade);
    const bulb = sph(0.05, M.bulb, 8);
    bulb.position.y = 0.9;
    g.add(bulb);
    const light = addPointLight(0, 0.85, 0, '#ffd7a3', 4, 4);
    g.add(light);
    g.position.set(-5.62, 0, z);
    scene.add(shadow(g));
    nav.blockRect(-5.9, z - 0.24, -5.34, z + 0.24);
    lights.push({ light, kind: 'indoorBase', base: 4 });
  }

  // gardırop
  {
    const g = new THREE.Group();
    const body = rbox(1.7, 2.15, 0.58, M.wood, 0.04);
    body.position.y = 1.1;
    g.add(body);
    for (const side of [-1, 1]) {
      const door = rbox(0.78, 1.95, 0.03, M.darkWood, 0.02);
      door.position.set(side * 0.4, 1.12, 0.3);
      g.add(door);
      const handle = cyl(0.014, 0.014, 0.34, M.brass, 6);
      handle.position.set(side * 0.1, 1.15, 0.33);
      g.add(handle);
      // ayna yansıması
      const glare = cube(0.02, 1.7, 0.02, M.glass);
      glare.position.set(side * 0.62, 1.15, 0.315);
      g.add(glare);
    }
    const top = rbox(1.78, 0.08, 0.64, M.darkWood, 0.02);
    top.position.y = 2.21;
    g.add(top);
    for (const [x, z] of [[-0.75, -0.2], [0.75, -0.2], [-0.75, 0.2], [0.75, 0.2]]) {
      const leg = cyl(0.03, 0.024, 0.12, M.darkWood, 6);
      leg.position.set(x, 0.06, z);
      g.add(leg);
    }

    g.position.set(-1.36, 0, -3.15);
    g.rotation.y = -Math.PI / 2;
    register('wardrobe', g, {
      x: -1.36, z: -3.15,
      standSlots: [{ x: -2.1, z: -3.15, yaw: Math.PI / 2 }],
      blocks: [{ x1: -1.68, z1: -4.0, x2: -1.05, z2: -2.3 }],
    });
  }

  // şifonyer + ayna
  {
    const g = new THREE.Group();
    const body = rbox(1.15, 0.78, 0.44, M.wood, 0.04);
    body.position.y = 0.44;
    g.add(body);
    for (let i = 0; i < 3; i++) {
      const drawer = rbox(1.02, 0.17, 0.02, M.darkWood, 0.01);
      drawer.position.set(0, 0.62 - i * 0.22, 0.225);
      g.add(drawer);
      const handle = cyl(0.012, 0.012, 0.2, M.brass, 6);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 0.62 - i * 0.22, 0.24);
      g.add(handle);
    }
    const mirror = new THREE.Group();
    const mirrorFrame = rbox(0.75, 0.95, 0.05, M.wood, 0.03);
    mirror.add(mirrorFrame);
    const gloss = cube(0.62, 0.8, 0.02, M.mirror);
    gloss.position.z = 0.03;
    mirror.add(gloss);
    mirror.position.set(0, 1.45, -0.14);
    mirror.rotation.x = -0.08;
    g.add(mirror);
    const perfume = cyl(0.035, 0.03, 0.1, M.ceramicRust, 8);
    perfume.position.set(0.38, 0.88, 0.05);
    g.add(perfume);
    const brush = cyl(0.02, 0.02, 0.16, M.wood, 6);
    brush.position.set(-0.35, 0.9, 0.02);
    brush.rotation.z = 0.2;
    g.add(brush);
    const frameArt = rbox(0.3, 0.22, 0.03, M.darkWood, 0.01);
    frameArt.position.set(-0.15, 1.0, -0.12);
    frameArt.rotation.x = -0.1;
    g.add(frameArt);

    g.position.set(-2.0, 0, -1.03);
    g.rotation.y = Math.PI;
    register('dresser', g, {
      x: -2.0, z: -1.03,
      standSlots: [{ x: -2.0, z: -1.85, yaw: 0 }],
      blocks: [{ x1: -2.62, z1: -1.28, x2: -1.38, z2: -0.8 }],
    });
  }

  // yatak odası halısı
  {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.02, 2.3), M.rug);
    rug.position.set(-4.5, 0.012, -2.65);
    rug.receiveShadow = true;
    scene.add(rug);
  }

  // yatak odası tablosu
  {
    const g = new THREE.Group();
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), M.picture2);
    g.add(canvas);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.68, 0.03), M.darkWood);
    frame.position.z = -0.02;
    g.add(frame);
    g.position.set(-5.94, 1.75, -2.65);
    g.rotation.y = Math.PI / 2;
    register('painting', g, {
      x: -5.94, z: -2.65,
      standSlots: [{ x: -4.4, z: -2.65, yaw: Math.PI / 2 }],
    });
  }

  // yatak odası saksısı
  {
    const g = makePlant(0.8);
    g.position.set(-2.2, 0, -4.12);
    register('plant', g, {
      x: -2.2, z: -4.12,
      standSlots: [{ x: -2.75, z: -4.12, yaw: Math.PI / 2 }],
      blocks: [{ x1: -2.42, z1: -4.34, x2: -1.98, z2: -3.9 }],
    });
  }

  // =========================================================================
  // BANYO
  // =========================================================================

  // duş
  {
    const g = new THREE.Group();
    const tray = rbox(1.0, 0.12, 1.0, M.ceramic, 0.03);
    tray.position.y = 0.06;
    g.add(tray);
    const drain = cyl(0.045, 0.045, 0.02, M.metal, 10);
    drain.position.y = 0.13;
    g.add(drain);
    // fayans arka panel
    const backWall = cube(0.06, 2.2, 1.0, M.sageTile);
    backWall.position.set(-0.47, 1.1, 0);
    g.add(backWall);
    const sideWall = cube(1.0, 2.2, 0.06, M.sageTile);
    sideWall.position.set(0, 1.1, -0.47);
    g.add(sideWall);
    // cam (güney tarafı girişe açık)
    const glass1 = cube(0.02, 1.9, 0.95, M.glass);
    glass1.position.set(0.47, 1.05, 0.02);
    g.add(glass1);
    const glass2 = cube(0.3, 1.9, 0.02, M.glass);
    glass2.position.set(-0.3, 1.05, 0.47);
    g.add(glass2);
    // duş başlığı
    const pipe = cyl(0.02, 0.02, 1.0, M.metal, 8);
    pipe.position.set(-0.35, 1.75, -0.35);
    g.add(pipe);
    const arm = cyl(0.018, 0.018, 0.4, M.metal, 8);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-0.18, 2.22, -0.35);
    g.add(arm);
    const head = cyl(0.13, 0.1, 0.05, M.metal, 16);
    head.position.set(0.0, 2.17, -0.35);
    g.add(head);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.16, 1.7, 10, 1, true), new THREE.MeshStandardMaterial({
      color: '#cfe6ea', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false,
    }));
    water.position.set(0.0, 1.3, -0.35);
    water.visible = false;
    g.add(water);
    g.userData.water = water;
    // şişeler
    for (let i = 0; i < 2; i++) {
      const bottle = cyl(0.035, 0.035, 0.18, M.ceramicSage, 8);
      bottle.position.set(-0.38, 0.2, 0.2 + i * 0.12);
      g.add(bottle);
    }

    g.position.set(-0.5, 0, -3.95);
    const obj = register('shower', g, {
      x: -0.5, z: -3.95,
      standSlots: [{ x: -0.5, z: -3.95, yaw: 0 }],
      blocks: [],
    });
    obj.water = water;
  }

  // tuvalet
  {
    const g = new THREE.Group();
    const base = rbox(0.3, 0.3, 0.4, M.ceramic, 0.06);
    base.position.y = 0.15;
    g.add(base);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), M.ceramic);
    bowl.scale.set(1, 0.62, 1.25);
    bowl.position.set(0, 0.4, 0.06);
    g.add(bowl);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 20), M.ceramic);
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1, 1.25, 1);
    seat.position.set(0, 0.5, 0.04);
    g.add(seat);
    const tank = rbox(0.36, 0.45, 0.18, M.ceramic, 0.05);
    tank.position.set(0, 0.62, -0.3);
    g.add(tank);
    const flush = rbox(0.1, 0.02, 0.05, M.metal, 0.01);
    flush.position.set(0, 0.85, -0.24);
    g.add(flush);
    const lid = rbox(0.37, 0.05, 0.2, M.ceramic, 0.03);
    lid.position.set(0, 0.86, -0.3);
    g.add(lid);

    g.position.set(1.35, 0, -4.02);
    register('toilet', g, {
      x: 1.35, z: -4.02,
      seats: [{ x: 1.35, z: -3.84, yaw: 0, y: 0.46, pose: 'sit', approach: { x: 1.35, z: -3.12 } }],
      blocks: [{ x1: 1.05, z1: -4.34, x2: 1.65, z2: -3.86 }],
    });
  }

  // banyo lavabosu
  {
    const g = new THREE.Group();
    const cabinet = rbox(0.9, 0.7, 0.48, M.cream, 0.03);
    cabinet.position.y = 0.38;
    g.add(cabinet);
    const drawer = rbox(0.78, 0.18, 0.02, M.darkWood, 0.01);
    drawer.position.set(0, 0.5, 0.25);
    g.add(drawer);
    const knob = cyl(0.012, 0.012, 0.18, M.brass, 6);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0, 0.5, 0.27);
    g.add(knob);
    const counterTop = rbox(0.96, 0.06, 0.54, M.counter, 0.02);
    counterTop.position.y = 0.76;
    g.add(counterTop);
    const basin = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), M.ceramic);
    basin.scale.set(1.2, 0.7, 1);
    basin.position.set(0, 0.82, 0.02);
    g.add(basin);
    const tap = cyl(0.018, 0.018, 0.24, M.metal, 8);
    tap.position.set(0, 0.9, -0.17);
    g.add(tap);
    const tapArm = cyl(0.015, 0.015, 0.14, M.metal, 8);
    tapArm.rotation.x = Math.PI / 2;
    tapArm.position.set(0, 1.01, -0.1);
    g.add(tapArm);
    const mirror = new THREE.Group();
    const mirrorFrame = rbox(0.66, 0.72, 0.04, M.white, 0.02);
    mirror.add(mirrorFrame);
    const gloss = cube(0.58, 0.64, 0.02, M.mirror);
    gloss.position.z = 0.03;
    mirror.add(gloss);
    mirror.position.set(0, 1.55, -0.26);
    g.add(mirror);
    const towel = rbox(0.26, 0.36, 0.03, M.cream, 0.02);
    towel.position.set(0.55, 1.12, -0.14);
    g.add(towel);
    const towelBar = cyl(0.01, 0.01, 0.28, M.metal, 6);
    towelBar.rotation.z = Math.PI / 2;
    towelBar.position.set(0.55, 1.31, -0.15);
    g.add(towelBar);
    const soap = cyl(0.035, 0.035, 0.09, M.ceramicSage, 8);
    soap.position.set(-0.3, 0.845, -0.05);
    g.add(soap);
    const plant = cyl(0.06, 0.05, 0.1, M.terracotta, 8);
    plant.position.set(0.33, 0.83, -0.1);
    g.add(plant);
    for (let i = 0; i < 3; i++) {
      const leaf = sph(0.05, M.leaf, 6);
      leaf.scale.set(1, 0.3, 1.3);
      leaf.position.set(0.33, 0.9, -0.1 + (i - 1) * 0.02);
      leaf.rotation.y = i * 1.1;
      g.add(leaf);
    }

    g.position.set(1.54, 0, -1.55);
    g.rotation.y = -Math.PI / 2;
    register('bathroom_sink', g, {
      x: 1.54, z: -1.55,
      standSlots: [{ x: 0.92, z: -1.55, yaw: Math.PI / 2 }],
      blocks: [{ x1: 1.24, z1: -2.05, x2: 1.8, z2: -1.05 }],
    });
  }

  // banyo halısı + havlu askıları
  {
    const matMesh = cube(0.9, 0.015, 0.6, M.sofaSage);
    matMesh.position.set(0.4, 0.013, -2.9);
    matMesh.receiveShadow = true;
    scene.add(matMesh);
    const rail = cyl(0.018, 0.018, 0.7, M.metal, 8);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-0.9, 1.35, -1.5);
    scene.add(rail);
    for (let i = 0; i < 2; i++) {
      const towel = rbox(0.26, 0.5, 0.03, i ? M.cream : M.sofaSage, 0.02);
      towel.position.set(-0.95 + i * 0.26, 1.1, -1.5);
      scene.add(towel);
    }
    const towelHooks = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12), M.metal);
    towelHooks.position.set(-0.97, 1.6, -1.5);
    scene.add(towelHooks);
  }

  // =========================================================================
  // ÇALIŞMA ODASI
  // =========================================================================
  {
    const g = new THREE.Group();
    const top = rbox(1.65, 0.06, 0.68, M.wood, 0.03);
    top.position.y = 0.74;
    g.add(top);
    const legs = [[-0.72, -0.25], [0.72, -0.25], [-0.72, 0.25], [0.72, 0.25]];
    for (const [x, z] of legs) {
      const leg = cyl(0.035, 0.028, 0.72, M.darkWood, 8);
      leg.position.set(x, 0.36, z);
      g.add(leg);
    }
    // monitör
    const monitor = new THREE.Group();
    const screenFrame = rbox(0.85, 0.52, 0.045, M.black, 0.02);
    monitor.add(screenFrame);
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.44), M.screen);
    screenMesh.position.z = 0.03;
    monitor.add(screenMesh);
    const neck = cyl(0.03, 0.03, 0.18, M.darkMetal, 8);
    neck.position.y = -0.33;
    monitor.add(neck);
    const foot = rbox(0.3, 0.03, 0.18, M.darkMetal, 0.01);
    foot.position.y = -0.43;
    foot.position.z = 0.02;
    monitor.add(foot);
    monitor.position.set(0.05, 1.08, -0.16);
    monitor.rotation.y = 0.06;
    g.add(monitor);
    const keyboard = rbox(0.55, 0.03, 0.16, M.darkMetal, 0.01);
    keyboard.position.set(0.02, 0.8, 0.12);
    g.add(keyboard);
    const mouse = rbox(0.09, 0.03, 0.13, M.darkMetal, 0.02);
    mouse.position.set(0.38, 0.8, 0.12);
    g.add(mouse);
    const mug = cyl(0.055, 0.045, 0.11, M.ceramicRust, 12);
    mug.position.set(-0.55, 0.83, 0.1);
    g.add(mug);
    const notebook = rbox(0.26, 0.025, 0.32, M.paper, 0.008);
    notebook.position.set(0.52, 0.795, -0.1);
    notebook.rotation.y = 0.2;
    g.add(notebook);
    const pen = cyl(0.006, 0.006, 0.16, M.brass, 5);
    pen.position.set(0.58, 0.815, -0.02);
    pen.rotation.z = 1.2;
    pen.rotation.y = 0.3;
    g.add(pen);
    const lampArm = cyl(0.015, 0.015, 0.42, M.darkMetal, 6);
    lampArm.position.set(-0.72, 1.0, -0.18);
    lampArm.rotation.z = 0.7;
    g.add(lampArm);
    const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 14, 1, true), M.darkMetal);
    lampHead.position.set(-0.82, 1.12, -0.1);
    lampHead.rotation.x = Math.PI * 0.75;
    g.add(lampHead);
    const bulb = sph(0.04, M.bulb, 8);
    bulb.position.set(-0.8, 1.08, -0.08);
    g.add(bulb);
    // kitaplar
    for (let i = 0; i < 4; i++) {
      const b = rbox(0.05, 0.22 + i * 0.02, 0.18, M.book[(i * 2) % M.book.length], 0.005);
      b.position.set(0.32 + i * 0.06, 0.89, -0.22);
      g.add(b);
    }
    // sandalye
    const chair = new THREE.Group();
    const seat = rbox(0.48, 0.07, 0.46, M.sofaSageDark, 0.03);
    seat.position.y = 0.46;
    chair.add(seat);
    const back = rbox(0.46, 0.52, 0.08, M.sofaSageDark, 0.03);
    back.position.set(0, 0.77, -0.2);
    back.rotation.x = -0.1;
    chair.add(back);
    const pole = cyl(0.035, 0.045, 0.3, M.darkMetal, 10);
    pole.position.y = 0.2;
    chair.add(pole);
    for (let i = 0; i < 5; i++) {
      const leg = cyl(0.018, 0.018, 0.32, M.darkMetal, 6);
      leg.position.set(Math.cos(i * 1.26) * 0.16, 0.06, Math.sin(i * 1.26) * 0.16);
      leg.rotation.z = 1.2;
      leg.rotation.y = -i * 1.26;
      chair.add(leg);
    }
    chair.position.set(0, 0, 0.85);
    g.add(chair);

    g.position.set(4.2, 0, -4.02);
    const obj = register('desk', g, {
      x: 4.2, z: -4.02,
      seats: [{ x: 4.2, z: -3.2, yaw: Math.PI, y: 0.5, pose: 'sit', approach: { x: 4.2, z: -2.4 } }],
      standSlots: [{ x: 5.1, z: -3.5, yaw: Math.PI * 0.8 }],
      blocks: [
        { x1: 3.35, z1: -4.38, x2: 5.05, z2: -3.64 },
        { x1: 3.9, z1: -3.6, x2: 4.5, z2: -3.0 },
      ],
      screen: screenMesh,
    });
    obj.screen = screenMesh;
  }

  // çalışma odası kitaplığı
  {
    const g = new THREE.Group();
    const body = rbox(1.6, 1.85, 0.36, M.wood, 0.03);
    body.position.y = 0.94;
    g.add(body);
    for (let s = 0; s < 4; s++) {
      const y = 0.25 + s * 0.43;
      const shelf = cube(1.48, 0.035, 0.34, M.darkWood);
      shelf.position.set(0, y, 0.02);
      g.add(shelf);
      let x = -0.66;
      for (let i = 0; i < 9; i++) {
        const w = 0.05 + Math.random() * 0.035;
        const h = 0.26 + Math.random() * 0.1;
        const b = rbox(w, h, 0.2, M.book[Math.floor(Math.random() * M.book.length)], 0.006);
        b.position.set(x + w / 2, y + 0.03 + h / 2, 0.06);
        g.add(b);
        x += w + 0.012;
        if (x > 0.66) break;
      }
      if (s === 1) {
        const pot = cyl(0.07, 0.06, 0.12, M.ceramicSage, 10);
        pot.position.set(0.5, y + 0.08, 0.06);
        g.add(pot);
      }
    }
    g.position.set(5.82, 0, -2.0);
    g.rotation.y = -Math.PI / 2;
    register('bookshelf', g, {
      x: 5.82, z: -2.0,
      standSlots: [{ x: 5.1, z: -2.0, yaw: Math.PI / 2 }],
      blocks: [{ x1: 5.6, z1: -2.85, x2: 6.0, z2: -1.15 }],
    });
  }

  // çalışma odası koltuk
  {
    const g = new THREE.Group();
    const seat = rbox(0.75, 0.22, 0.72, M.sofaSage, 0.08);
    seat.position.y = 0.38;
    g.add(seat);
    const back = rbox(0.77, 0.6, 0.18, M.sofaSage, 0.07);
    back.position.set(0, 0.64, -0.29);
    back.rotation.x = -0.1;
    g.add(back);
    for (const side of [-1, 1]) {
      const arm = rbox(0.14, 0.34, 0.7, M.sofaSage, 0.06);
      arm.position.set(side * 0.34, 0.54, 0.01);
      g.add(arm);
    }
    const cushion = rbox(0.62, 0.1, 0.58, M.cream, 0.05);
    cushion.position.set(0, 0.51, 0.03);
    g.add(cushion);
    for (const [x, z] of [[-0.28, -0.26], [0.28, -0.26], [-0.28, 0.26], [0.28, 0.26]]) {
      const leg = cyl(0.027, 0.02, 0.18, M.darkWood, 6);
      leg.position.set(x, 0.17, z);
      g.add(leg);
    }
    g.position.set(2.5, 0, -1.75);
    g.rotation.y = 2.55;
    register('chair', g, {
      x: 2.5, z: -1.75,
      seats: [localSeat(2.5, -1.75, 2.55, 0.03, 0.04, 0.5, 0, {
        approach: { x: 2.5 + Math.sin(2.55) * 0.68, z: -1.75 + Math.cos(2.55) * 0.68 },
      })],
      blocks: [{ x1: 2.05, z1: -2.2, x2: 2.95, z2: -1.3 }],
    });
  }

  // çalışma odası halısı + saksı + tablo
  {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 2.0), M.rug);
    rug.position.set(4.15, 0.012, -2.3);
    rug.receiveShadow = true;
    scene.add(rug);
    const plant = makePlant(0.75);
    plant.position.set(2.3, 0, -4.1);
    register('plant', plant, {
      x: 2.3, z: -4.1,
      standSlots: [{ x: 2.9, z: -4.1, yaw: -Math.PI / 2 }],
      blocks: [{ x1: 2.1, z1: -4.3, x2: 2.5, z2: -3.9 }],
    });
    const art = new THREE.Group();
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.05), M.picture1);
    art.add(canvas);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.03), M.darkWood);
    frame.position.z = -0.02;
    art.add(frame);
    art.position.set(-0.72, 1.6, 1.2);
    art.rotation.y = Math.PI / 2;
    // banyo duvarına değil, çalışma odasının batı duvarına dönük
    art.position.set(1.75, 1.6, -2.6);
    register('painting', art, {
      x: 1.75, z: -2.6,
      standSlots: [{ x: 2.45, z: -2.6, yaw: -Math.PI / 2 }],
    });
  }

  // =========================================================================
  // GİRİŞ + KORİDOR DETAYLARI
  // =========================================================================
  {
    // paspas
    const matMesh = cube(1.2, 0.012, 0.7, M.sofaRust);
    matMesh.position.set(0.1, 0.012, 3.95);
    matMesh.receiveShadow = true;
    scene.add(matMesh);
    // portmanto
    const rack = new THREE.Group();
    const pole = cyl(0.025, 0.025, 1.8, M.darkMetal, 8);
    pole.position.y = 0.9;
    rack.add(pole);
    for (let i = 0; i < 3; i++) {
      const leg = cyl(0.018, 0.018, 0.4, M.darkMetal, 6);
      leg.position.set(Math.cos(i * 2.1) * 0.16, 0.12, Math.sin(i * 2.1) * 0.16);
      leg.rotation.z = Math.cos(i * 2.1) * 0.7;
      leg.rotation.x = -Math.sin(i * 2.1) * 0.7;
      rack.add(leg);
    }
    const coat = rbox(0.42, 0.8, 0.12, M.olive, 0.05);
    coat.position.set(0.02, 1.12, 0.09);
    rack.add(coat);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.02, 16), M.cream);
    hat.position.set(0.03, 1.62, 0.05);
    rack.add(hat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 16), M.cream);
    crown.position.set(0.03, 1.68, 0.05);
    rack.add(crown);
    rack.position.set(1.2, 0, 4.15);
    scene.add(shadow(rack));
    nav.blockRect(1.02, 4.0, 1.38, 4.3);

    // ayakkabılık
    const shoeRack = rbox(1.0, 0.42, 0.3, M.wood, 0.03);
    shoeRack.position.set(-1.1, 0.24, 4.2);
    scene.add(shadow(shoeRack));
    for (let i = 0; i < 3; i++) {
      const shoe = rbox(0.14, 0.1, 0.26, i === 1 ? M.sofaRust : M.sofaSageDark, 0.04);
      shoe.position.set(-1.4 + i * 0.28, 0.5, 4.15);
      scene.add(shoe);
    }
    nav.blockRect(-1.62, 4.04, -0.58, 4.36);
  }

  // =========================================================================
  // TERAS
  // =========================================================================
  {
    // bank
    const g = new THREE.Group();
    const seat = rbox(1.7, 0.08, 0.5, M.wood, 0.03);
    seat.position.y = 0.46;
    g.add(seat);
    const back = rbox(1.7, 0.52, 0.07, M.wood, 0.03);
    back.position.set(0, 0.78, -0.22);
    back.rotation.x = -0.12;
    g.add(back);
    for (let i = 0; i < 3; i++) {
      const slat = rbox(1.66, 0.09, 0.05, M.wood, 0.02);
      slat.position.set(0, 0.62 + i * 0.14, -0.245 + i * 0.02);
      g.add(slat);
    }
    for (const x of [-0.72, 0.72]) {
      const leg = rbox(0.08, 0.46, 0.44, M.darkWood, 0.02);
      leg.position.set(x, 0.23, 0);
      g.add(leg);
      const arm = rbox(0.07, 0.52, 0.5, M.darkWood, 0.02);
      arm.position.set(x, 0.66, 0.02);
      g.add(arm);
    }
    const cushion1 = rbox(0.72, 0.09, 0.42, M.cream, 0.04);
    cushion1.position.set(-0.4, 0.54, 0.01);
    g.add(cushion1);
    const cushion2 = cushion1.clone();
    cushion2.position.x = 0.4;
    g.add(cushion2);

    g.position.set(0.8, 0.06, 7.1);
    register('bench', g, {
      x: 0.8, z: 7.1,
      seats: [
        { x: 0.38, z: 7.18, yaw: 0, y: 0.56, pose: 'sit', approach: { x: 0.38, z: 7.78 } },
        { x: 1.22, z: 7.18, yaw: 0, y: 0.56, pose: 'sit', approach: { x: 1.22, z: 7.78 } },
      ],
      standSlots: [{ x: 0.8, z: 6.35, yaw: Math.PI }],
      blocks: [{ x1: -0.15, z1: 6.78, x2: 1.75, z2: 7.45 }],
    });
  }

  // teras yan sehpa + fenerler + saksılar
  {
    const table = new THREE.Group();
    const top = cyl(0.34, 0.34, 0.05, M.wood, 20);
    top.position.y = 0.42;
    table.add(top);
    const pole = cyl(0.04, 0.05, 0.4, M.darkWood, 8);
    pole.position.y = 0.21;
    table.add(pole);
    const foot = cyl(0.2, 0.22, 0.04, M.darkWood, 16);
    foot.position.y = 0.02;
    table.add(foot);
    const lantern = new THREE.Group();
    const lb = rbox(0.16, 0.24, 0.16, M.glass, 0.02);
    lantern.add(lb);
    const lf = sph(0.04, new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb35c', emissiveIntensity: 2.2 }), 8);
    lf.position.y = 0.02;
    lantern.add(lf);
    const lc = cyl(0.09, 0.09, 0.03, M.darkMetal, 10);
    lc.position.y = 0.14;
    lantern.add(lc);
    lantern.position.set(0, 0.56, 0);
    table.add(lantern);
    const mug = cyl(0.05, 0.045, 0.09, M.ceramicRust, 10);
    mug.position.set(0.13, 0.49, 0.08);
    table.add(mug);
    table.position.set(0.8, 0.06, 6.3);
    scene.add(shadow(table));
    nav.blockRect(0.44, 5.96, 1.16, 6.64);
    const lanternLight = addPointLight(0.8, 0.75, 6.3, '#ffc07a', 2.2, 3.5);
    lights.push({ light: lanternLight, kind: 'outdoor', base: 2.2 });

    // teras saksıları
    for (const [x, z, s] of [[-1.6, 6.9, 0.85], [3.25, 6.9, 0.75], [3.2, 5.15, 0.7], [-1.7, 5.15, 0.6]]) {
      const p = makePlant(s);
      p.position.set(x, 0.06, z);
      scene.add(shadow(p));
      nav.blockRect(x - 0.24 * s, z - 0.24 * s, x + 0.24 * s, z + 0.24 * s);
    }

    // dış mekan halısı
    const outdoorRug = cube(2.4, 0.015, 1.8, M.sofaRust);
    outdoorRug.position.set(0.8, 0.07, 6.35);
    outdoorRug.rotation.y = 0.02;
    outdoorRug.receiveShadow = true;
    scene.add(outdoorRug);
  }

  // teras direkleri + ışık zinciri
  {
    const posts = [[-2.05, 5.0], [3.65, 5.0], [-2.05, 7.85], [3.65, 7.85]];
    for (const [x, z] of posts) {
      const post = cyl(0.06, 0.07, 2.2, M.wood, 10);
      post.position.set(x, 1.1, z);
      scene.add(shadow(post));
      nav.blockRect(x - 0.09, z - 0.09, x + 0.09, z + 0.09);
      const cap = sph(0.09, M.brass, 10);
      cap.position.set(x, 2.2, z);
      scene.add(cap);
    }
    // kirişler
    for (const z of [5.0, 7.85]) {
      const beam = cube(5.85, 0.07, 0.07, M.darkWood);
      beam.position.set(0.8, 2.18, z);
      scene.add(shadow(beam));
    }
    for (const x of [-2.05, 3.65]) {
      const beam = cube(0.07, 0.07, 2.95, M.darkWood);
      beam.position.set(x, 2.18, 6.42);
      scene.add(shadow(beam));
    }
    // ampuller
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe9bd', emissive: '#ffc06a', emissiveIntensity: 2.2, roughness: 0.4 });
    const wireMat = new THREE.LineBasicMaterial({ color: '#4b4036' });
    const strands = [
      [[-2.05, 2.16, 5.0], [3.65, 2.16, 5.0], 14],
      [[-2.05, 2.16, 7.85], [3.65, 2.16, 7.85], 14],
      [[-2.05, 2.16, 5.0], [-2.05, 2.16, 7.85], 8],
    ];
    for (const [a, b, count] of strands) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const sag = Math.sin(t * Math.PI) * 0.22;
        pts.push(new THREE.Vector3(x, 2.16 - sag, z));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
      scene.add(line);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const sag = Math.sin(t * Math.PI) * 0.22;
        const bulb = sph(0.045, bulbMat, 8);
        bulb.position.set(x, 2.14 - sag, z);
        scene.add(bulb);
        const cap = cyl(0.025, 0.025, 0.04, M.darkMetal, 6);
        cap.position.set(x, 2.18 - sag, z);
        scene.add(cap);
      }
    }
    const terasLight = addPointLight(0.8, 1.95, 6.4, '#ffc98b', 5, 6);
    lights.push({ light: terasLight, kind: 'outdoor', base: 5 });
  }

  // =========================================================================
  // BAHÇE
  // =========================================================================
  function makeTree(x, z, scale = 1, seed = 1) {
    const g = new THREE.Group();
    const trunk = cyl(0.14 * scale, 0.22 * scale, 1.6 * scale, M.darkWood, 10);
    trunk.position.y = 0.8 * scale;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const branch = cyl(0.05 * scale, 0.08 * scale, 0.8 * scale, M.darkWood, 6);
      branch.position.set(Math.cos(i * 2.1 + seed) * 0.3 * scale, 1.5 * scale, Math.sin(i * 2.1 + seed) * 0.3 * scale);
      branch.rotation.z = Math.cos(i * 2.1) * 0.5;
      branch.rotation.x = -Math.sin(i * 2.1) * 0.5;
      g.add(branch);
    }
    const rnd = (n) => {
      const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let i = 0; i < 6; i++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((0.55 + rnd(i) * 0.3) * scale, 1), i % 3 === 0 ? M.leafLight : i % 3 === 1 ? M.leaf : M.leafDark);
      blob.position.set(
        (rnd(i + 1) - 0.5) * 1.3 * scale,
        (1.9 + rnd(i + 2) * 0.9) * scale,
        (rnd(i + 3) - 0.5) * 1.3 * scale,
      );
      blob.rotation.set(rnd(i + 4) * 3, rnd(i + 5) * 3, rnd(i + 6) * 3);
      blob.castShadow = true;
      blob.receiveShadow = true;
      g.add(blob);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  makeTree(-4.6, 6.6, 1.25, 1);
  makeTree(5.9, 6.0, 1.1, 2);
  makeTree(-8.4, -1.8, 1.15, 3);
  makeTree(8.8, -4.2, 1.0, 4);
  makeTree(-8.0, 2.4, 0.85, 7);
  makeTree(9.2, 2.2, 0.9, 8);
  makeTree(2.8, -7.4, 1.15, 5);
  makeTree(-4.0, -6.8, 0.95, 6);

  // çalılar
  const bushMat = [M.leaf, M.leafDark, M.leafLight];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 8.5 + Math.sin(i * 3) * 0.7;
    const x = Math.cos(a) * r * 1.15;
    const z = 1.2 + Math.sin(a) * r;
    if (z > 4.2 && z < 8.5 && x > -2.6 && x < 4.2) continue;
    const bush = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 + (i % 3) * 0.1, 1), bushMat[i % 3]));
    bush.scale.set(1.25, 0.8, 1.1);
    bush.position.set(x, 0.22, z);
    bush.rotation.y = i;
    scene.add(bush);
  }

  // taş yol
  for (let i = 0; i < 12; i++) {
    const stone = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.06, 7), M.counter));
    stone.position.set(0.8 + Math.sin(i * 0.9) * 0.16, 0.015, 8.5 + i * 0.62);
    stone.rotation.y = i * 0.7;
    stone.scale.set(1, 1, 1.3);
    scene.add(stone);
  }

  // çit
  for (let x = -11; x <= 11; x += 2.2) {
    const post = cyl(0.06, 0.07, 1.1, M.wood, 6);
    post.position.set(x, 0.55, 9.6);
    scene.add(shadow(post));
  }
  for (let i = 0; i < 9; i++) {
    const rail = cube(2.3, 0.07, 0.04, M.wood);
    rail.position.set(-11 + i * 2.4 + 1.2, 0.82, 9.6);
    scene.add(shadow(rail));
    const rail2 = rail.clone();
    rail2.position.y = 0.45;
    scene.add(rail2);
  }

  // kuş evi
  {
    const birdhouse = new THREE.Group();
    const body = rbox(0.26, 0.3, 0.24, M.wood, 0.02);
    body.position.y = 0.15;
    birdhouse.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.18, 4), M.darkWood);
    roof.position.y = 0.38;
    roof.rotation.y = Math.PI / 4;
    birdhouse.add(roof);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), M.black);
    hole.position.set(0, 0.16, 0.125);
    birdhouse.add(hole);
    const perch = cyl(0.012, 0.012, 0.12, M.wood, 6);
    perch.rotation.x = Math.PI / 2;
    perch.position.set(0, 0.08, 0.16);
    birdhouse.add(perch);
    birdhouse.position.set(-3.4, 1.9, 6.0);
    scene.add(birdhouse);
    const pole = cyl(0.03, 0.04, 2.0, M.darkWood, 6);
    pole.position.set(-3.4, 1.0, 6.0);
    scene.add(shadow(pole));
  }

  // =========================================================================
  // KEDİ
  // =========================================================================
  const catBed = new THREE.Group();
  const catBedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.12, 20), M.sofaRust);
  catBedBase.position.y = 0.06;
  catBed.add(catBedBase);
  const catBedInner = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20), M.cream);
  catBedInner.position.y = 0.12;
  catBed.add(catBedInner);
  const bedPillow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 18), M.pillow);
  bedPillow.rotation.x = Math.PI / 2;
  bedPillow.position.y = 0.15;
  catBed.add(bedPillow);
  catBed.position.set(4.75, 0, 3.85);
  scene.add(shadow(catBed));
  nav.blockRect(4.4, 3.5, 5.1, 4.2);

  return {
    nav,
    objects,
    fadeWalls,
    lights,
    stars,
    starMat,
    sky,
    catBedPos: { x: 4.75, z: 3.85 },
    onUpdate,
    ground,
    makePlant,
    addPointLight,
  };
}
