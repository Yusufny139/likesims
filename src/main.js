import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

import { buildWorld } from './house.js';
import { Character, Cat } from './character.js';
import { Sim } from './sims.js';
import { getMaterials } from './materials.js';
import {
  NEEDS, NEED_KEYS, SIMS, SIM_INTERACTIONS, GOALS, FURNITURE, GAME, SHOP_ITEMS,
} from './data.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

// ---------------------------------------------------------------------------
// Ses efektleri (küçük sentezleyici)
// ---------------------------------------------------------------------------
const Sfx = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type = 'sine', gain = 0.06, when = 0) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },
  pop() { this.tone(520, 0.08, 'triangle', 0.045); },
  click() { this.tone(660, 0.06, 'sine', 0.03); },
  good() { this.tone(660, 0.12, 'sine', 0.05); this.tone(880, 0.16, 'sine', 0.045, 0.09); },
  chime() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.05, i * 0.11)); },
  heart() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.04, i * 0.08)); },
  purr() { this.tone(90, 0.3, 'sawtooth', 0.03); this.tone(120, 0.24, 'sine', 0.03, 0.1); },
  money() { [784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.04, i * 0.06)); },
};

// ---------------------------------------------------------------------------
// Sahne
// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(12.5, 10.5, 16.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0.3, 0.7, 0.4);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 7;
controls.maxDistance = 30;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.34;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.zoomSpeed = 0.85;
controls.update();

// ışıklar
const hemi = new THREE.HemisphereLight('#d7ecf5', '#b49b7a', 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff2dc', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -17;
sun.shadow.camera.right = 17;
sun.shadow.camera.top = 17;
sun.shadow.camera.bottom = -17;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
sun.target.position.set(0, 0, 0);
scene.add(sun);
scene.add(sun.target);

const moonLight = new THREE.DirectionalLight('#a9c6ea', 0.0);
moonLight.position.set(-18, 22, -14);
scene.add(moonLight);

const fillLight = new THREE.DirectionalLight('#ffd9b5', 0.35);
fillLight.position.set(-10, 8, 12);
scene.add(fillLight);

// ---------------------------------------------------------------------------
// Ev
// ---------------------------------------------------------------------------
const house = buildWorld(scene);
const { nav, objects, fadeWalls, lights, stars, starMat, catBedPos } = house;

// Çok küçük parçaların gölgesini kapat: gölge geçişini hafifletir.
scene.traverse((o) => {
  if (!o.isMesh || !o.castShadow) return;
  if (o.userData.keepShadow) return;
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  if (g.boundingSphere && g.boundingSphere.radius < 0.11) o.castShadow = false;
});

// gökyüzü shader'ı
const skyUniforms = {
  topColor: { value: new THREE.Color('#7fb4d9') },
  midColor: { value: new THREE.Color('#cfe4e8') },
  bottomColor: { value: new THREE.Color('#f6e7cd') },
  sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4) },
  sunColor: { value: new THREE.Color('#fff0cf') },
  nightAmount: { value: 0 },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 bottomColor;
    uniform vec3 sunDir;
    uniform vec3 sunColor;
    uniform float nightAmount;
    varying vec3 vWorldPosition;
    void main() {
      vec3 dir = normalize(vWorldPosition - cameraPosition);
      float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(bottomColor, midColor, smoothstep(0.35, 0.56, h));
      col = mix(col, topColor, smoothstep(0.5, 0.85, h));
      float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
      col += sunColor * pow(sunDot, 220.0) * 1.5 * (1.0 - nightAmount * 0.7);
      col += sunColor * pow(sunDot, 8.0) * 0.12 * (1.0 - nightAmount);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
house.sky.material = skyMat;

// ay
const moonGroup = new THREE.Group();
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(2.1, 24, 18),
  new THREE.MeshBasicMaterial({ color: '#fff6da', fog: false }),
);
moonGroup.add(moon);
const moonGlow = new THREE.Mesh(
  new THREE.SphereGeometry(3.4, 20, 16),
  new THREE.MeshBasicMaterial({ color: '#ffeec0', transparent: true, opacity: 0.12, depthWrite: false, fog: false }),
);
moonGroup.add(moonGlow);
moonGroup.position.set(-40, 34, -48);
scene.add(moonGroup);

// seçim halkaları
const ringGeo = new THREE.RingGeometry(0.3, 0.38, 40);
const selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
  color: '#ffd27a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
}));
selRing.rotation.x = -Math.PI / 2;
selRing.position.y = 0.03;
selRing.visible = false;
scene.add(selRing);

const destRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({
  color: '#9fd6b0', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
}));
destRing.rotation.x = -Math.PI / 2;
destRing.position.y = 0.04;
destRing.visible = false;
scene.add(destRing);
let destUntil = 0;

// ---------------------------------------------------------------------------
// Oyun durumu
// ---------------------------------------------------------------------------
const state = {
  money: GAME.startMoney,
  friendship: GAME.friendships.friendship,
  romance: GAME.friendships.romance,
  freeWill: true,
  sound: true,
  speed: 1,
  paused: false,
  selected: null,
  started: false,
  flags: {},
  goalsDone: new Set(),
  owned: new Set(),
};

const clock = { total: GAME.startMinute };

const world = {
  nav,
  objects,
  sims: [],
  state,
  time: 0,
  wanderSpots: [
    { x: -3.3, z: 3.5 },
    { x: -1.6, z: 0.6 },
    { x: 0.6, z: -0.1 },
    { x: 2.9, z: 0.4 },
    { x: 4.6, z: 4.0 },
    { x: 1.0, z: 6.4 },
    { x: 0.4, z: 2.2 },
    { x: 3.2, z: -2.2 },
    { x: -2.3, z: -2.6 },
    { x: 4.8, z: -4.0 },
  ],
  get totalMinutes() { return clock.total; },
  get minuteOfDay() { return ((clock.total % 1440) + 1440) % 1440; },
  get day() { return 1 + Math.floor(clock.total / 1440); },
  get freeWill() { return state.freeWill; },
  get money() { return state.money; },
  canAfford(n) { return state.money >= n; },
  spendMoney(n) {
    if (state.money < n) return false;
    state.money -= n;
    Sfx.money();
    return true;
  },
  addMoney(n) {
    state.money += n;
    Sfx.money();
  },
  other(sim) { return world.sims.find((s) => s !== sim); },
  isNight() {
    const h = world.minuteOfDay / 60;
    return h < 6.2 || h >= 19.8;
  },
  notify(text, type = 'info') { toast(text, type); },
  bubble(sim, icon) { addBubble(sim, icon, 2.2); },
  startJoin(leader, action, slot) {
    const follower = action.partnerSim;
    if (!follower) return;
    if (follower.join) follower.join = null;
    follower.startJoin(leader, action, slot);
  },
  partnerReady(leader, action, follower) {
    action.waiting = false;
    action.partnerArrived = true;
    addBubble(follower, action.def.icon || '✨', 1.6);
  },
  endJoin(follower, action) {
    if (!follower) return;
    if (follower.join && follower.join.action === action) follower.finishJoinAction();
  },
  cancelCouple(leader, action) {
    if (!action) return;
    action.waiting = false;
    if (leader.current === action) {
      leader.releaseSlots(action);
      leader.current = null;
      leader.path = null;
      leader.sitTarget = 0;
      leader.lieTarget = 0;
      leader.gettingUp = 0.35;
    }
    const f = action.partnerSim;
    if (f && f.join && f.join.action === action) f.finishJoinAction();
  },
  completeAction(sim, action) {
    completeAction(sim, action);
  },
};

// ---------------------------------------------------------------------------
// Simler
// ---------------------------------------------------------------------------
const cats = [];
const sims = [];
const starts = {
  ferhanim: { x: -3.15, z: 0.35, yaw: 0.2, hunger: 58, energy: 82, bladder: 74, hygiene: 72, fun: 58, social: 52 },
  yusuf: { x: 4.25, z: 0.75, yaw: -0.7, hunger: 44, energy: 66, bladder: 62, hygiene: 58, fun: 70, social: 48 },
};
for (const def of SIMS) {
  const character = new Character(def);
  scene.add(character.group);
  const sim = new Sim(def, character, world, starts[def.id]);
  character.group.traverse((o) => {
    if (o.isMesh) o.userData.pick = { type: 'sim', ref: sim };
  });
  sims.push(sim);
  world.sims.push(sim);
}
state.selected = sims[0];

// Pamuk
const cat = new Cat();
cat.group.position.set(catBedPos.x - 0.12, 0.13, catBedPos.z - 0.22);
cat.group.rotation.y = -2.2;
cat.group.traverse((o) => {
  if (o.isMesh) o.castShadow = true;
});
scene.add(cat.group);
cats.push(cat);
const catObj = {
  id: 'cat-pamuk',
  type: 'cat',
  def: FURNITURE.cat,
  label: 'Pamuk',
  icon: '🐈',
  group: cat.group,
  x: catBedPos.x - 0.12,
  z: catBedPos.z - 0.22,
  seats: [],
  lieSlots: [],
  standSlots: [{ x: 4.15, z: 3.45, yaw: 2.4 }],
};
const catPick = { type: 'object', ref: catObj };
cat.group.userData.pick = catPick;
cat.group.traverse((o) => {
  if (o.isMesh) o.userData.pick = catPick;
});
catObj.group = cat.group;
objects.push(catObj);

// ---------------------------------------------------------------------------
// Etkileşim tamamlama
// ---------------------------------------------------------------------------
function applyNeedEffects(sim, effects) {
  if (!sim || !effects) return;
  for (const k of NEED_KEYS) {
    if (typeof effects[k] === 'number') {
      sim.needs[k] = clamp(sim.needs[k] + effects[k], 0, 100);
    }
  }
}

function completeAction(sim, action) {
  const def = action.def;
  if (!def || action.kind === 'move') return;
  applyNeedEffects(sim, def.effects);
  if (def.bothEffects && action.partnerSim) applyNeedEffects(action.partnerSim, def.effects);

  const e = def.effects || {};
  if (e.romance) {
    state.romance = clamp(state.romance + e.romance, 0, 100);
    if (e.romance >= 8) addBubble(sim, '❤️', 2.2);
  }
  if (e.friendship) state.friendship = clamp(state.friendship + e.friendship, 0, 100);

  if (def.moodlet) {
    sim.addMoodlet(def.moodlet);
    if (def.bothEffects && action.partnerSim) action.partnerSim.addMoodlet(def.moodlet);
  }

  if (def.money) {
    world.addMoney(def.money);
    toast(`${sim.def.name} ₺${def.money} kazandı 💼`, 'good');
  }

  if (def.tags) {
    for (const tag of def.tags) state.flags[tag] = (state.flags[tag] || 0) + 1;
  }

  // eşya tepkileri
  if (action.obj) {
    if (action.obj.screen && def.tags?.includes('tv')) {
      action.obj.screen.material.emissiveIntensity = 0.9;
    }
    if (action.obj.type === 'lamp') {
      toggleLamp(action.obj);
      return;
    }
    if (action.obj.type === 'cat') {
      Sfx.purr();
      addBubble(catObj, '💗', 1.6);
      cat.group.rotation.y += 0.4;
    }
  }

  if (['sim_chat', 'sim_joke', 'sim_compliment', 'sim_hug', 'sim_kiss', 'sim_hands', 'sim_dance'].includes(def.id)) {
    addBubble(sim, def.icon, 2.2);
    if (action.partnerSim) addBubble(action.partnerSim, def.id === 'sim_kiss' ? '😘' : def.icon, 2.2);
    if (def.id === 'sim_kiss' || def.id === 'sim_hug') Sfx.heart();
  }

  Sfx.pop();
  checkRelationshipMilestones();
  checkGoals();
}

// ---------------------------------------------------------------------------
// Dekorasyon mağazası
// ---------------------------------------------------------------------------
const M = getMaterials();
const SHOP_SPOTS = {
  plant2: { x: -4.85, z: 3.35, yaw: 0.35, block: 0.62 },
  lamp2: { x: -2.05, z: 3.9, yaw: 0, block: 0.42 },
  art2: { x: -4.55, z: -0.15, yaw: 0.5, block: 0.5 },
  rug2: { x: 1.45, z: 2.55, yaw: 0, block: 0 },
};

function buildDecor(item) {
  const g = new THREE.Group();
  if (item.id === 'shop_plant') {
    const plant = house.makePlant(1.2);
    plant.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(plant);
  } else if (item.id === 'shop_lamp') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.05, 20), M.darkMetal);
    base.position.y = 0.025;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.36, 8), M.brass);
    pole.position.y = 0.72;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.28, 22, 1, true), M.lampShade);
    shade.position.y = 1.42;
    g.add(base, pole, shade);
    const light = house.addPointLight(0, 1.4, 0, '#ffd7a3', 5, 4.5);
    scene.add(light);
    g.userData.light = light;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  } else if (item.id === 'shop_art') {
    const legs = new THREE.Group();
    for (const [dx, dz] of [[-0.24, 0.06], [0.24, 0.06], [0, -0.24]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.32, 0.045), M.wood);
      leg.position.set(dx, 0.66, dz * 1.6);
      leg.rotation.x = dz < 0 ? 0.16 : 0;
      legs.add(leg);
    }
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.04), M.cream);
    canvas.position.set(0, 1.02, 0.04);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.72), M.picture2);
    art.position.set(0, 1.02, 0.065);
    g.add(legs, canvas, art);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  } else if (item.id === 'shop_rug') {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 1.8), M.rug);
    rug.position.y = 0.016;
    rug.receiveShadow = true;
    g.add(rug);
  }
  return g;
}

function buyShopItem(item) {
  if (state.owned.has(item.id)) {
    toast('Bu dekorasyon zaten evinizde 🙂', 'info');
    return;
  }
  if (state.money < item.price) {
    toast(`Yeterli para yok (₺${item.price})`, 'warn');
    return;
  }
  const spot = SHOP_SPOTS[item.spot];
  if (!spot) return;
  state.money -= item.price;
  state.owned.add(item.id);
  const g = buildDecor(item);
  g.position.set(spot.x, 0, spot.z);
  g.rotation.y = spot.yaw;
  scene.add(g);
  if (spot.block > 0) nav.blockRect(spot.x - spot.block / 2, spot.z - spot.block / 2, spot.x + spot.block / 2, spot.z + spot.block / 2);
  Sfx.chime();
  spawnConfetti();
  toast(`${item.icon} ${item.name} alındı!`, 'good');
  renderShop();
  renderSimPanel();
}

function renderShop() {
  const list = $('shopList');
  if (!list) return;
  $('shopHint').textContent = `Kasa: ₺${state.money}`;
  list.innerHTML = SHOP_ITEMS.map((item) => {
    const owned = state.owned.has(item.id);
    const poor = state.money < item.price;
    return `<div class="goal ${owned ? 'done' : ''}">
      <div class="goal-icon">${owned ? '✓' : item.icon}</div>
      <div class="goal-copy"><b>${item.name}</b><p>${item.desc}</p></div>
      <button class="shop-buy ${owned ? 'owned' : ''}" data-id="${item.id}" ${owned || poor ? 'disabled' : ''}>
        ${owned ? 'Evde' : poor ? 'Pahalı' : `₺${item.price}`}
      </button>
    </div>`;
  }).join('');
  list.querySelectorAll('.shop-buy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = SHOP_ITEMS.find((i) => i.id === btn.dataset.id);
      if (item) { buyShopItem(item); Sfx.click(); }
    });
  });
}

function toggleLamp(obj) {
  if (!obj.light) return;
  obj.light.userData.on = !(obj.light.userData.on ?? true);
  applyLampState();
  toast(obj.light.userData.on ? 'Lamba açıldı 💡' : 'Lamba kapatıldı 🌙', 'info');
}

function checkRelationshipMilestones() {
  const marks = [50, 70, 85, 100];
  state.romanceMarks = state.romanceMarks || new Set();
  for (const m of marks) {
    if (state.romance >= m && !state.romanceMarks.has(m)) {
      state.romanceMarks.add(m);
      toast(m === 100 ? 'Aşk puanı 100! Birbiriniz için yaratılmışsınız 💞' : `Aşk puanı ${m}! Kalpler ısınıyor 💞`, 'heart');
      Sfx.heart();
    }
  }
}

function checkGoals() {
  if (!state.started) return;
  const ctx = { flags: state.flags, sims, state };
  for (const goal of GOALS) {
    if (state.goalsDone.has(goal.id)) continue;
    let ok = false;
    try {
      ok = goal.test(ctx);
    } catch (err) {
      ok = false;
    }
    if (ok) {
      state.goalsDone.add(goal.id);
      state.money += goal.reward;
      toast(`Görev tamam: ${goal.title} · +₺${goal.reward} 🏆`, 'good');
      Sfx.chime();
      renderGoals();
      spawnConfetti();
    }
  }
}

// ---------------------------------------------------------------------------
// UI yardımcıları
// ---------------------------------------------------------------------------
const overlay = $('worldOverlay');
const toastsEl = $('toasts');
const bubbleList = [];
let nameLabels = [];

function toast(text, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = text;
  toastsEl.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 400);
  }, 3800);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}

function addBubble(target, text, dur = 2) {
  const sim = target && target.char ? target : null;
  const isSim = !!sim;
  const obj = isSim ? null : target;
  const el = document.createElement('div');
  el.className = isSim ? 'world-bubble' : 'world-bubble object-bubble';
  el.textContent = text;
  overlay.appendChild(el);
  bubbleList.push({
    el,
    sim: isSim ? sim : null,
    obj: isSim ? null : obj,
    until: performance.now() + dur * 1000,
    born: performance.now(),
  });
}

function spawnConfetti() {
  const colors = ['#e58a6f', '#7fa892', '#e8c46a', '#a97bd6', '#6d9bbf'];
  for (let i = 0; i < 26; i++) {
    const bit = document.createElement('i');
    bit.className = 'confetti';
    bit.style.left = `${45 + Math.random() * 10}%`;
    bit.style.top = `${45 + Math.random() * 10}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 380}px`);
    bit.style.setProperty('--dy', `${-80 - Math.random() * 260}px`);
    bit.style.animationDelay = `${Math.random() * 0.2}s`;
    document.body.appendChild(bit);
    setTimeout(() => bit.remove(), 2000);
  }
}

// --- ihtiyaç panelleri
const needRefs = new Map();
function buildNeeds(sim) {
  const list = $('needsList');
  list.innerHTML = '';
  needRefs.clear();
  const refs = {};
  for (const k of NEED_KEYS) {
    const info = NEEDS[k];
    const row = document.createElement('div');
    row.className = 'need-row';
    row.innerHTML = `
      <span class="need-icon" title="${info.label}">${info.icon}</span>
      <div class="need-main">
        <div class="need-top"><span>${info.label}</span><b>80</b></div>
        <div class="need-track"><i style="background:${info.color}"></i></div>
      </div>`;
    list.appendChild(row);
    refs[k] = {
      fill: row.querySelector('.need-track i'),
      value: row.querySelector('.need-top b'),
      row,
    };
  }
  needRefs.set(sim.id, refs);
  const moodRow = document.createElement('div');
  moodRow.className = 'moodlets';
  moodRow.id = 'moodletsRow';
  list.appendChild(moodRow);
}

function renderSimPanel() {
  const sim = state.selected;
  if (!sim || !state.started) {
    $('simPanel').classList.add('hidden');
    return;
  }
  $('simPanel').classList.remove('hidden');
  $('simAvatar').textContent = sim.def.short;
  $('simAvatar').className = `avatar ${sim.id}`;
  $('simName').textContent = sim.def.name;
  const mood = sim.moodInfo();
  $('simMood').innerHTML = `Ruh hali: <strong style="color:${mood.color}">${mood.icon} ${mood.label}</strong>`;
  $('simTraits').innerHTML = sim.def.traits.map((t, i) => `<span>${sim.def.traitsIcon[i]} ${t}</span>`).join('');
  buildNeeds(sim);
}

function updateSimPanel() {
  const sim = state.selected;
  if (!sim) return;
  const refs = needRefs.get(sim.id);
  if (!refs) return;
  for (const k of NEED_KEYS) {
    const v = Math.round(sim.needs[k]);
    const r = refs[k];
    if (!r) continue;
    r.fill.style.width = `${v}%`;
    r.value.textContent = v;
    r.row.classList.toggle('critical', v < 22);
    r.row.classList.toggle('low', v >= 22 && v < 40);
  }
  const moodletsRow = $('moodletsRow');
  if (moodletsRow) {
    const chips = sim.moodlets.slice(0, 4).map((m) => `<span class="moodlet" title="${m.label}">${m.icon} ${m.label}</span>`).join('');
    moodletsRow.innerHTML = chips;
  }
  const mood = sim.moodInfo();
  $('simMood').innerHTML = `Ruh hali: <strong style="color:${mood.color}">${mood.icon} ${mood.label}</strong>`;
}

function updateRelPanel() {
  const f = Math.round(state.friendship);
  const r = Math.round(state.romance);
  $('friendshipBar').style.width = `${f}%`;
  $('romanceBar').style.width = `${r}%`;
  $('friendshipValue').textContent = f;
  $('romanceValue').textContent = r;
  $('relHint').textContent = r >= 85 ? 'Birbirinize aşıksınız 💞'
    : r >= 70 ? 'Aşk büyüyor ✨'
      : r >= 45 ? 'Kelebekler uçuşuyor 🦋'
        : r >= 20 ? 'Yeni başlayan bir kıvılcım 💛'
          : 'Biraz daha yakınlaşın 💫';
}

let queueSignature = '';
function updateQueue() {
  const sim = state.selected;
  const wrap = $('queueWrap');
  if (!sim) {
    wrap.classList.add('hidden');
    return;
  }
  const items = [];
  if (sim.current) items.push({ action: sim.current, current: true, progress: sim.current.phase === 'act' ? Math.min(1, sim.current.elapsed / Math.max(1, sim.current.duration)) : 0 });
  for (const q of sim.queue) items.push({ action: q, current: false, progress: 0 });
  if (!items.length) {
    wrap.classList.add('hidden');
    queueSignature = '';
    return;
  }
  wrap.classList.remove('hidden');
  $('queueOwner').textContent = sim.def.name;
  const sig = items.map((i) => `${i.action.uid}:${i.current ? Math.floor(i.progress * 20) : ''}`).join('|');
  if (sig !== queueSignature) {
    queueSignature = sig;
    $('queueList').innerHTML = items.map((i) => `
      <div class="queue-chip ${i.current ? 'current' : ''}">
        <span class="q-icon">${i.action.def.icon || '•'}</span>
        <span class="q-label">${i.action.def.label}</span>
        ${i.current ? `<i class="q-progress" style="width:${i.progress * 100}%"></i>` : ''}
      </div>`).join('');
  } else {
    const cur = $('queueList').querySelector('.q-progress');
    if (cur && items[0]) cur.style.width = `${items[0].progress * 100}%`;
  }
}

function updateClockUI() {
  const m = world.minuteOfDay;
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  $('clockTime').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('clockDay').textContent = `Gün ${world.day}`;
  $('dayIcon').textContent = world.isNight() ? '🌙' : h < 9 ? '🌅' : h > 18 ? '🌇' : '☀️';
  $('moneyValue').textContent = Math.floor(state.money).toLocaleString('tr-TR');
}

// --- pasta menüsü
let pieTarget = null;
function closePie() {
  $('pieMenu').classList.add('hidden');
  pieTarget = null;
}
function openPie(kind, target, x, y) {
  const sim = state.selected;
  if (!sim) {
    toast('Önce bir sim seç 👆', 'warn');
    return;
  }
  pieTarget = target;
  const isSim = kind === 'sim';
  const otherSim = isSim ? target : null;
  const obj = isSim ? null : target;
  const def = isSim ? { label: otherSim.def.name, interactions: SIM_INTERACTIONS } : obj.def;
  if (!def || !def.interactions || !def.interactions.length) {
    toast(isSim ? 'Şu an bir şey yapamazsın' : 'Burayla etkileşime girilemez', 'warn');
    return;
  }
  const list = isSim ? SIM_INTERACTIONS : def.interactions;
  $('pieIcon').textContent = isSim ? otherSim.def.short : obj.icon;
  $('pieTitle').textContent = isSim ? otherSim.def.name : obj.label;
  $('pieSub').textContent = isSim ? 'Ne yapmak istersin?' : 'Bir eylem seç';
  const actions = $('pieActions');
  actions.innerHTML = '';
  for (const a of list) {
    const locked = a.requireRomance && state.romance < a.requireRomance;
    const poor = a.cost && state.money < a.cost;
    const btn = document.createElement('button');
    btn.className = `pie-action ${locked || poor ? 'locked' : ''}`;
    btn.type = 'button';
    const meta = [];
    if (a.dur) meta.push(`${Math.max(1, Math.round(a.dur / 60))} dk`);
    if (a.cost) meta.push(`₺${a.cost}`);
    if (a.requireRomance) meta.push(`♥ ${a.requireRomance}`);
    if (locked) meta.push('kilitli');
    if (poor) meta.push('para yok');
    btn.innerHTML = `
      <span class="pa-icon">${locked ? '🔒' : a.icon}</span>
      <span class="pa-copy"><b>${a.label}</b><small>${meta.join(' · ')}</small></span>`;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (locked) {
        toast(`Aşk puanı ${a.requireRomance} olmalı 💔`, 'warn');
        return;
      }
      if (poor) {
        toast(`Yeterli para yok (₺${a.cost})`, 'warn');
        return;
      }
      closePie();
      Sfx.click();
      const action = isSim ? sim.makeSimAction(otherSim, a) : sim.makeObjectAction(obj, a);
      if (action) {
        if (sim.isSleeping) {
          sim.cancelCurrent();
          toast(`${sim.def.name} uyandı 😴`, 'info');
        }
        if (action.kind === 'object' && action.obj?.type === 'sofa') {
          action.seatPreference = 'sofa';
        }
        sim.enqueue(action);
        if (sim.current || sim.queue.length > 1) toast(`${a.icon} ${a.label} sıraya eklendi`, 'info');
        focusCamera(obj ? { x: obj.x, z: obj.z } : { x: otherSim.pos.x, z: otherSim.pos.z });
      }
    });
    actions.appendChild(btn);
  }
  const pie = $('pieMenu');
  pie.classList.remove('hidden');
  const pad = 16;
  const w = 336;
  const h = pie.offsetHeight || 300;
  const left = clamp(x, w / 2 + pad, window.innerWidth - w / 2 - pad);
  const top = clamp(y, h / 2 + pad, window.innerHeight - h / 2 - pad);
  pie.style.left = `${left}px`;
  pie.style.top = `${top}px`;
  pie.style.transform = 'translate(-50%, -50%)';
  Sfx.click();
}

// --- görevler
function renderGoals() {
  const list = $('goalsList');
  list.innerHTML = GOALS.map((g) => {
    const done = state.goalsDone.has(g.id);
    return `<div class="goal ${done ? 'done' : ''}">
      <div class="goal-icon">${done ? '✓' : g.icon}</div>
      <div class="goal-copy"><b>${g.title}</b><p>${g.desc}</p></div>
      <div class="goal-reward">${done ? 'Alındı' : `₺${g.reward}`}</div>
    </div>`;
  }).join('');
  $('goalProgress').textContent = `${state.goalsDone.size} / ${GOALS.length} tamamlandı`;
}

function openDrawer(id) {
  $(id).classList.remove('hidden');
  if (id === 'goalsPanel') renderGoals();
  if (id === 'shopPanel') renderShop();
  Sfx.click();
}
function closeDrawer(id) {
  $(id).classList.add('hidden');
}

function setSpeed(v) {
  state.speed = v;
  state.paused = v === 0;
  document.querySelectorAll('.speed-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.speed) === v);
  });
  if (v === 0) {
    $('pauseScreen').classList.remove('hidden');
  } else {
    $('pauseScreen').classList.add('hidden');
  }
}

function setFreeWill(v) {
  state.freeWill = v;
  $('freeWillToggle2').checked = v;
  const btn = $('freeWillBtn');
  if (btn) btn.classList.toggle('off', !v);
  toast(v ? 'Serbest irade açık 🧠' : 'Serbest irade kapalı · kontrol sende 🎮', 'info');
}

function focusCamera(point) {
  if (!point) return;
  const y = point.isVector3 ? point.y : 0.8;
  cameraGoal = new THREE.Vector3(point.x, y, point.z);
}

// ---------------------------------------------------------------------------
// Kamera odak animasyonu
// ---------------------------------------------------------------------------
let cameraGoal = null;
let introFly = null;

function updateCamera(dt) {
  if (introFly) {
    introFly.t += dt / introFly.dur;
    const e = clamp(introFly.t, 0, 1);
    const k = e * e * (3 - 2 * e);
    camera.position.lerpVectors(introFly.fromPos, introFly.toPos, k);
    controls.target.lerpVectors(introFly.fromTarget, introFly.toTarget, k);
    if (e >= 1) {
      introFly = null;
      controls.enabled = true;
      controls.autoRotate = false;
    }
    return;
  }
  if (cameraGoal) {
    controls.target.lerp(cameraGoal, Math.min(1, dt * 3.2));
    if (controls.target.distanceTo(cameraGoal) < 0.05) cameraGoal = null;
  }
  controls.update();
  // hedefi evin sınırlarında tut
  controls.target.x = clamp(controls.target.x, -8, 8);
  controls.target.z = clamp(controls.target.z, -6, 8);
  controls.target.y = clamp(controls.target.y, 0.2, 3);
}

// ---------------------------------------------------------------------------
// Gökyüzü / gün döngüsü
// ---------------------------------------------------------------------------
const cDayTop = new THREE.Color('#7fb4d9');
const cDayMid = new THREE.Color('#cfe4e8');
const cDayBottom = new THREE.Color('#f6e7cd');
const cNightTop = new THREE.Color('#0a1428');
const cNightMid = new THREE.Color('#1b2b45');
const cNightBottom = new THREE.Color('#3a4a60');
const cDuskTop = new THREE.Color('#6b7aa8');
const cDuskMid = new THREE.Color('#e8a48a');
const cDuskBottom = new THREE.Color('#f6cfa0');
const cSunHigh = new THREE.Color('#fff4e2');
const cSunLow = new THREE.Color('#ff9d63');

let nightFactor = 0;

function updateSky(dt) {
  const hour = world.minuteOfDay / 60;
  const t = clamp((hour - 6) / 12, -0.4, 1.4);
  const ang = t * Math.PI;
  const elev = Math.sin(ang);
  const dayAmt = clamp(elev * 2.2 + 0.25, 0, 1);
  nightFactor = clamp(1 - dayAmt * 1.6, 0, 1);
  const duskAmt = clamp(1 - Math.abs(elev) * 4, 0, 1);

  sun.position.set(Math.cos(ang) * 26, Math.max(-8, elev * 24), 13 - t * 4);
  sun.intensity = Math.max(0, elev) * 3.2;
  sun.color.copy(cSunHigh).lerp(cSunLow, clamp(1 - elev * 1.8, 0, 1));
  fillLight.intensity = 0.12 + Math.max(0, elev) * 0.3;
  moonLight.intensity = nightFactor * 0.55;
  hemi.intensity = 0.18 + dayAmt * 0.8;
  hemi.color.set('#d7ecf5');
  hemi.groundColor.set('#8d7a63');

  const top = new THREE.Color().copy(cDayTop).lerp(cNightTop, nightFactor);
  const mid = new THREE.Color().copy(cDayMid).lerp(cNightMid, nightFactor);
  const bottom = new THREE.Color().copy(cDayBottom).lerp(cNightBottom, nightFactor);
  if (duskAmt > 0.01 && nightFactor < 0.95) {
    top.lerp(cDuskTop, duskAmt * 0.5);
    mid.lerp(cDuskMid, duskAmt * 0.55);
    bottom.lerp(cDuskBottom, duskAmt * 0.6);
  }
  skyUniforms.topColor.value.copy(top);
  skyUniforms.midColor.value.copy(mid);
  skyUniforms.bottomColor.value.copy(bottom);
  skyUniforms.sunDir.value.copy(sun.position).normalize();
  skyUniforms.sunColor.value.copy(sun.color);
  skyUniforms.nightAmount.value = nightFactor;

  starMat.opacity = clamp(nightFactor * 1.3 - 0.15, 0, 0.95);
  stars.visible = starMat.opacity > 0.02;
  moonGroup.visible = nightFactor > 0.15;
  moonGroup.position.y = 20 + Math.sin(world.totalMinutes * 0.0005) * 6;
  moonGlow.material.opacity = nightFactor * 0.14;

  // yapay ışıklar
  applyLampState();
}

function applyLampState() {
  for (const l of lights) {
    const on = l.light.userData.on ?? true;
    let factor;
    if (l.kind === 'outdoor') factor = nightFactor;
    else factor = 0.35 + nightFactor * 0.9;
    l.light.intensity = on ? l.base * factor * 1.4 : 0;
  }
}

// ---------------------------------------------------------------------------
// Duvarların kamera ile şeffaflaşması
// ---------------------------------------------------------------------------
function updateWalls(dt) {
  const cp = camera.position;
  for (const w of fadeWalls) {
    let show = true;
    if (w.interiorFade === 'south') {
      show = cp.z <= -0.62;
    } else if (w.fadeNormal) {
      const m = w.meshes[0];
      if (m) {
        const plane = m.position.x * w.fadeNormal.x + m.position.z * w.fadeNormal.z;
        const dist = cp.x * w.fadeNormal.x + cp.z * w.fadeNormal.z - plane;
        show = dist <= 0.35;
      }
    }
    const target = show ? 1 : 0;
    w.opacity = damp(w.opacity, target, 7, dt);
    const op = w.opacity;
    // tamamen solmuş duvarı gizle (beyaz pus bırakmasın)
    const visible = op > 0.06;
    if (w.group.visible !== visible) w.group.visible = visible;
    for (const mat of w.mats) {
      mat.opacity = op;
      mat.depthWrite = op > 0.9;
      mat.transparent = op < 0.999;
    }
    for (const m of w.meshes) {
      m.castShadow = op > 0.8;
      m.receiveShadow = op > 0.5;
    }
  }
}

// ---------------------------------------------------------------------------
// Girdi
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let downPos = null;
let downTime = 0;
let hoverCheck = 0;

canvas.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  downTime = performance.now();
  Sfx.ensure();
});
canvas.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  const dt = performance.now() - downTime;
  downPos = null;
  if (moved > 7 || dt > 650) return;
  if (!state.started) return;
  handleClick(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - hoverCheck < 90) return;
  hoverCheck = now;
  if (!state.started) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickableGroups(), true);
  const hit = hits.find((h) => h.object.userData.pick || findPickAncestor(h.object));
  canvas.style.cursor = hit ? 'pointer' : 'grab';
});

function findPickAncestor(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.pick) return o.userData.pick;
    o = o.parent;
  }
  return null;
}

function pickableGroups() {
  const groups = objects.map((o) => o.group);
  for (const s of sims) groups.push(s.char.group);
  return groups;
}

function handleClick(clientX, clientY) {
  if (!$('pieMenu').classList.contains('hidden')) {
    closePie();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickableGroups(), true);
  if (hits.length) {
    const pick = findPickAncestor(hits[0].object);
    if (pick?.type === 'sim') {
      const clicked = pick.ref;
      if (!state.selected) {
        selectSim(clicked);
        Sfx.click();
      } else if (state.selected === clicked) {
        selectSim(clicked);
        focusCamera({ x: clicked.pos.x, z: clicked.pos.z });
      } else {
        openPie('sim', clicked, clientX, clientY);
      }
      return;
    }
    if (pick?.type === 'object') {
      if (!state.selected) {
        state.selected = sims[0];
        renderSimPanel();
      }
      openPie('object', pick.ref, clientX, clientY);
      return;
    }
  }
  // boş zemin: seçili simi yürüt
  if (!state.selected) return;
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, point)) {
    const free = nav.nearestFree(point.x, point.z, 8);
    const action = state.selected.makeMoveAction(free.x, free.z);
    if (state.selected.isSleeping) state.selected.cancelCurrent();
    state.selected.enqueue(action);
    destRing.position.set(free.x, 0.04, free.z);
    destRing.visible = true;
    destUntil = performance.now() + 1600;
    Sfx.click();
    void rect;
  }
  closePie();
}

function selectSim(sim) {
  state.selected = sim;
  renderSimPanel();
  updateQueue();
  queueSignature = '';
  selRing.visible = true;
}

// klavye
window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  Sfx.ensure();
  if (e.code === 'Space') {
    e.preventDefault();
    setSpeed(state.speed === 0 ? 1 : 0);
  } else if (e.key === '1') setSpeed(1);
  else if (e.key === '2') setSpeed(2);
  else if (e.key === '3') setSpeed(4);
  else if (e.key === 'Tab') {
    e.preventDefault();
    if (!state.started) return;
    const idx = sims.indexOf(state.selected);
    selectSim(sims[(idx + 1) % sims.length]);
  } else if (e.key === 'Escape') {
    closePie();
    closeDrawer('goalsPanel');
    closeDrawer('shopPanel');
    closeDrawer('helpPanel');
    if (state.speed === 0) setSpeed(1);
  }
});

// ---------------------------------------------------------------------------
// Arayüz olayları
// ---------------------------------------------------------------------------
$('startBtn').addEventListener('click', () => {
  Sfx.ensure();
  Sfx.chime();
  state.started = true;
  $('startScreen').classList.add('gone');
  document.querySelectorAll('.hidden-when-playing').forEach((el) => el.classList.remove('hidden-when-playing'));
  for (const id of ['topbar', 'simPanel', 'relPanel', 'hintBar']) $(id).classList.remove('hidden');
  $('freeWillBtn')?.classList.remove('hidden');
  setTimeout(() => $('startScreen').remove(), 900);
  renderSimPanel();
  updateQueue();
  $('loading')?.classList.add('hidden');
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const toPos = new THREE.Vector3(9.6, 9.2, 14.2);
  const toTarget = new THREE.Vector3(0.5, 0.7, 0.6);
  controls.enabled = false;
  controls.autoRotate = false;
  introFly = { fromPos, toPos, fromTarget, toTarget, t: 0, dur: 1.8 };
  setTimeout(() => {
    toast('Hoş geldiniz! 🏡 Ferhanım ve Yusuf Niyazi sizi bekliyordu.', 'good');
  }, 900);
  setTimeout(() => {
    toast('İpucu: Bir eşyaya tıklayın, pasta menüden bir eylem seçin.', 'info');
  }, 3400);
  setTimeout(() => {
    toast('Görevleri açmayı unutmayın 🏆', 'info');
  }, 6200);
});
$('startHelpBtn').addEventListener('click', () => {
  $('helpPanel').classList.remove('hidden');
  Sfx.click();
});
$('helpBtn').addEventListener('click', () => { openDrawer('helpPanel'); });
$('helpClose').addEventListener('click', () => closeDrawer('helpPanel'));
$('helpDone').addEventListener('click', () => closeDrawer('helpPanel'));
$('goalsBtn').addEventListener('click', () => openDrawer('goalsPanel'));
$('shopBtn').addEventListener('click', () => openDrawer('shopPanel'));
$('shopClose').addEventListener('click', () => closeDrawer('shopPanel'));
$('goalsClose').addEventListener('click', () => closeDrawer('goalsPanel'));
$('pieClose').addEventListener('click', closePie);
$('focusBtn').addEventListener('click', () => {
  if (state.selected) {
    cameraGoal = new THREE.Vector3(state.selected.pos.x, 0.8, state.selected.pos.z);
    Sfx.click();
  }
});
$('cancelBtn').addEventListener('click', () => {
  if (!state.selected) return;
  state.selected.clearQueue();
  toast(`${state.selected.def.name} durdu ✋`, 'info');
  Sfx.click();
});
$('resumeBtn').addEventListener('click', () => setSpeed(1));
$('pauseHelpBtn').addEventListener('click', () => { openDrawer('helpPanel'); });
$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  Sfx.enabled = state.sound;
  $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
  $('soundToggle2').checked = state.sound;
  if (state.sound) Sfx.good();
});
$('soundToggle2').addEventListener('change', (e) => {
  state.sound = e.target.checked;
  Sfx.enabled = state.sound;
  $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
});
$('freeWillToggle2').addEventListener('change', (e) => setFreeWill(e.target.checked));
for (const btn of document.querySelectorAll('.speed-btn')) {
  btn.addEventListener('click', () => { setSpeed(Number(btn.dataset.speed)); Sfx.click(); });
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// serbest irade düğmesi
{
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.id = 'freeWillBtn';
  btn.title = 'Serbest irade';
  btn.setAttribute('aria-label', 'Serbest irade');
  btn.textContent = '🧠';
  const actions = document.querySelector('.top-actions');
  actions.insertBefore(btn, $('soundBtn'));
  btn.addEventListener('click', () => setFreeWill(!state.freeWill));
}

// ---------------------------------------------------------------------------
// Etiketler ve baloncuklar
// ---------------------------------------------------------------------------
const labelLayer = document.createElement('div');
labelLayer.className = 'label-layer';
overlay.appendChild(labelLayer);
for (const sim of sims) {
  const el = document.createElement('div');
  el.className = 'name-label';
  el.innerHTML = `<i class="dot ${sim.id}"></i>${sim.def.name}`;
  labelLayer.appendChild(el);
  nameLabels.push({ sim, el });
}

const tmpVec = new THREE.Vector3();
const tmpProj = new THREE.Vector3();

function projectToScreen(worldPos) {
  tmpProj.copy(worldPos).project(camera);
  return {
    x: (tmpProj.x * 0.5 + 0.5) * window.innerWidth,
    y: (-tmpProj.y * 0.5 + 0.5) * window.innerHeight,
    visible: tmpProj.z < 1,
  };
}

function updateOverlay(dt) {
  const now = performance.now();
  // isim etiketleri
  for (const { sim, el } of nameLabels) {
    if (!state.started) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = 'flex';
    const head = sim.char.getHeadWorld(tmpVec);
    const p = projectToScreen(head);
    el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y - 46}px)`;
    el.style.opacity = p.visible ? '1' : '0';
    el.classList.toggle('active', state.selected === sim);
  }
  // baloncuklar
  for (let i = bubbleList.length - 1; i >= 0; i--) {
    const b = bubbleList[i];
    if (now > b.until) {
      b.el.remove();
      bubbleList.splice(i, 1);
      continue;
    }
    let pos;
    if (b.sim) pos = b.sim.char.getHeadWorld(tmpVec);
    else if (b.obj) {
      pos = tmpVec.set(b.obj.group.position.x, 0.9, b.obj.group.position.z);
    }
    if (!pos) continue;
    const p = projectToScreen(pos);
    const age = (now - b.born) / 1000;
    const rise = Math.min(1, age * 2.4) * 18;
    b.el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y - 64 - rise}px) scale(${0.85 + Math.min(1, age * 4) * 0.15})`;
    b.el.style.opacity = p.visible ? String(Math.min(1, (b.until - now) / 350)) : '0';
  }
  // seçim halkası
  if (state.selected && state.started) {
    selRing.visible = true;
    selRing.position.x = state.selected.pos.x;
    selRing.position.z = state.selected.pos.z;
    const s = 1 + Math.sin(now * 0.004) * 0.06;
    selRing.scale.setScalar(s);
    if (state.selected.current?.def?.pose === 'lie') selRing.visible = false;
  } else {
    selRing.visible = false;
  }
  if (destRing.visible && now > destUntil) destRing.visible = false;
  if (destRing.visible) {
    const k = 1 + Math.sin(now * 0.008) * 0.1;
    destRing.scale.setScalar(k);
  }
  // ekran parlama
  if (state.started) {
    const tvOn = sims.some((s) => s.current?.def?.tags?.includes('tv'));
    for (const obj of objects) {
      if (obj.screen) {
        const target = tvOn ? 0.85 : 0.3;
        obj.screen.material.emissiveIntensity = damp(obj.screen.material.emissiveIntensity, target, 3, dt);
      }
      if (obj.water) {
        obj.water.visible = sims.some((s) => s.current?.obj === obj && s.current?.def?.id === 'shower_shower');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HUD güncellemesi
// ---------------------------------------------------------------------------
let hudTimer = 0;
function updateHUD(dt) {
  updateClockUI();
  hudTimer -= dt;
  if (hudTimer > 0) return;
  hudTimer = 0.12;
  updateSimPanel();
  updateRelPanel();
  updateQueue();
}

// ---------------------------------------------------------------------------
// Serbest irade / otomatik uyku uyarısı
// ---------------------------------------------------------------------------
let ambientTimer = 0;
function ambientLife(dt) {
  ambientTimer -= dt;
  if (ambientTimer > 0) return;
  ambientTimer = 2.5 + Math.random() * 2;
  for (const sim of sims) {
    if (sim.isSleeping && Math.random() < 0.6) addBubble(sim, '💤', 2.4);
    if (sim.moodlets.length && Math.random() < 0.2) addBubble(sim, sim.moodlets[0].icon, 2);
  }
}

// ---------------------------------------------------------------------------
// Başlangıç
// ---------------------------------------------------------------------------
renderGoals();
$('simPanel').classList.add('hidden');
$('relPanel').classList.add('hidden');
updateRelPanel();
updateClockUI();

// başlangıçta karakterleri canlı tut
let lastTime = performance.now();
let gameTime = 0;
let startedAt = performance.now();
let autoStartTimer = 0;

function stepGame(dt) {
  gameTime += dt;
  world.time = gameTime;
  if (state.started && state.speed > 0) {
    const moveScale = Math.min(2, Math.max(0.6, state.speed * 0.75));
    const dtSim = dt * moveScale;
    const dtMin = dt * GAME.minutesPerSecond * state.speed;
    clock.total += dtMin;
    for (const sim of sims) sim.update(dtSim, dtMin, world);
    ambientLife(dt);
    checkGoals();
  } else {
    for (const sim of sims) {
      sim.char.state.mode = 'idle';
      sim.char.update(dt, gameTime);
      sim.updateMood(world);
    }
  }
  cat.update(dt);
}

function frame(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.06, rawDt);

  updateSky(dt);
  updateWalls(dt);
  updateCamera(dt);
  stepGame(dt);
  updateOverlay(dt);
  updateHUD(dt);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(frame);

// yükleme ekranı
setTimeout(() => {
  const el = $('loading');
  if (el) {
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 700);
  }
}, 900);

// geliştirici/test kancası
window.__likesims = {
  THREE, scene, camera, controls, renderer, sims, state, world, objects, house,
  selectSim, openPie, closePie, setSpeed, focusCamera, toast, checkGoals,
  buyShopItem, renderShop, SHOP_ITEMS,
  resetView(pos, target) {
    introFly = null;
    cameraGoal = null;
    controls.enabled = true;
    controls.autoRotate = false;
    if (pos) camera.position.set(pos[0], pos[1], pos[2]);
    if (target) controls.target.set(target[0], target[1], target[2]);
    controls.update();
  },
  // test/otomasyon: oyunu hızlı ileri sar (gerçek zamanda bekletmeden)
  advance(minutes, chunk = 0.5) {
    const step = chunk / (GAME.minutesPerSecond * Math.max(1, state.speed));
    let left = minutes;
    let guard = 0;
    while (left > 0.0001 && guard++ < 200000) {
      const d = Math.min(step, left / (GAME.minutesPerSecond * Math.max(1, state.speed)));
      stepGame(d);
      left -= d * GAME.minutesPerSecond * Math.max(1, state.speed);
    }
    updateClockUI();
    updateQueue();
    updateOverlay(0.016);
    return clock.total;
  },
  setClock(minutes) {
    clock.total = minutes;
    updateClockUI();
  },
  skipIntro() {
    introFly = null;
    cameraGoal = null;
    controls.enabled = true;
    controls.autoRotate = false;
    camera.position.set(9.6, 9.2, 14.2);
    controls.target.set(0.5, 0.7, 0.6);
    controls.update();
  },
};

window.addEventListener('beforeunload', () => {});
