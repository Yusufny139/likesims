import * as THREE from 'three';
import { NEED_KEYS, NEEDS, SIM_INTERACTIONS, MOOD_LEVELS } from './data.js';

const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;

let uid = 0;
const nextId = () => ++uid;

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function slotForward(slot) {
  return { x: Math.sin(slot.yaw), z: Math.cos(slot.yaw) };
}

// ---------------------------------------------------------------------------
// Sim — ihtiyaçlar, eylem kuyruğu, yol bulma, serbest irade
// ---------------------------------------------------------------------------
export class Sim {
  constructor(def, character, world, start) {
    this.id = def.id;
    this.def = def;
    this.char = character;
    this.world = world;
    this.pos = character.group.position;
    this.pos.set(start.x, 0, start.z);
    this.yaw = start.yaw ?? 0;
    character.group.rotation.y = this.yaw;

    this.needs = {
      hunger: start.hunger ?? 72,
      energy: start.energy ?? 78,
      bladder: start.bladder ?? 76,
      hygiene: start.hygiene ?? 80,
      fun: start.fun ?? 64,
      social: start.social ?? 62,
    };
    this.moodlets = [];
    this.mood = 80;
    this.queue = [];
    this.current = null;
    this.join = null;
    this.gettingUp = 0;
    this.path = null;
    this.pathIndex = 0;
    this.walkSpeed = 2.05;
    this.walkingNow = 0;
    this.sitTarget = 0;
    this.lieTarget = 0;
    this.settle = null;
    this.thinkTimer = 3 + Math.random() * 5;
    this.idleLookTimer = 4 + Math.random() * 6;
    this.interruptedByPlayer = false;
    this.wanderCooldown = 20;
  }

  get partner() {
    return this.world.sims.find((s) => s !== this);
  }

  get isSleeping() {
    return !!(this.current && this.current.def && this.current.def.sleep);
  }

  get displayAction() {
    if (this.join) return this.join.action.def;
    return this.current ? this.current.def : null;
  }

  // --- yardımcılar --------------------------------------------------------
  toast(text, type = 'info') {
    this.world.notify(text, type);
  }

  getSeatPose() {
    return this.current?.def?.pose || this.join?.slot?.pose || 'stand';
  }

  // --- eylem kuyruğu ------------------------------------------------------
  enqueue(action) {
    if (!action) return false;
    if (this.join) this.world.cancelCouple(this.join.leader, this.join.action);
    this.queue.push(action);
    return true;
  }

  makeObjectAction(obj, def) {
    const partner = def.partner ? this.partner : null;
    if (def.requireRomance && this.world.state.romance < def.requireRomance) {
      this.toast(`Aşk puanı henüz yetersiz (${def.requireRomance} gerekli) 💔`, 'warn');
      return null;
    }
    if (def.cost && !this.world.canAfford(def.cost)) {
      this.toast(`Yeterli para yok (₺${def.cost} gerekli)`, 'warn');
      return null;
    }
    if (partner && (partner.isSleeping || partner.gettingUp > 0)) {
      this.toast(`${partner.def.name} şu an müsait değil 😴`, 'warn');
      return null;
    }
    return {
      uid: nextId(),
      kind: 'object',
      obj,
      def,
      duration: def.dur,
      elapsed: 0,
      phase: 'walk',
      slot: null,
      partnerSlot: null,
      partnerSim: partner,
      follower: null,
      waiting: false,
      waitTime: 0,
      retries: 0,
      settled: null,
      started: false,
    };
  }

  makeSimAction(other, def) {
    if (def.requireRomance && this.world.state.romance < def.requireRomance) {
      this.toast(`Aşk puanı henüz yetersiz (${def.requireRomance} gerekli) 💔`, 'warn');
      return null;
    }
    if (def.cost && !this.world.canAfford(def.cost)) {
      this.toast(`Yeterli para yok (₺${def.cost} gerekli)`, 'warn');
      return null;
    }
    if (other.isSleeping) {
      this.toast(`${other.def.name} uyuyor, onu uyandırmayalım 😴`, 'warn');
      return null;
    }
    return {
      uid: nextId(),
      kind: 'sim',
      targetSim: other,
      def,
      duration: def.dur,
      elapsed: 0,
      phase: 'walk',
      slot: null,
      partnerSim: other,
      follower: null,
      waiting: false,
      waitTime: 0,
      retries: 0,
      settled: null,
      started: false,
    };
  }

  makeMoveAction(x, z) {
    return {
      uid: nextId(),
      kind: 'move',
      def: { label: 'Yürü', icon: '👣', dur: 0, anim: null, pose: 'stand', effects: {} },
      duration: 0,
      elapsed: 0,
      phase: 'walk',
      target: { x, z },
      started: false,
    };
  }

  cancelCurrent() {
    if (this.join) {
      this.world.cancelCouple(this.join.leader, this.join.action);
      return;
    }
    if (!this.current) return;
    const a = this.current;
    if (a.follower) this.world.endJoin(a.follower, a);
    this.releaseSlots(a);
    this.current = null;
    this.sitTarget = 0;
    this.lieTarget = 0;
    this.gettingUp = 0.35;
    this.path = null;
    this.settle = null;
  }

  clearQueue() {
    this.queue.length = 0;
    this.cancelCurrent();
  }

  // --- hedef seçimi -------------------------------------------------------
  pickSlot(obj, pose, exclude = null) {
    const pool = pose === 'sit' ? obj.seats : pose === 'lie' ? obj.lieSlots : obj.standSlots;
    if (!pool || !pool.length) return null;
    let best = null;
    let bestD = Infinity;
    for (const s of pool) {
      if (s.occupiedBy) continue;
      if (exclude && s === exclude) continue;
      const d = (s.x - this.pos.x) ** 2 + (s.z - this.pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  reserveSlot(slot, sim) {
    if (slot) slot.occupiedBy = sim;
  }

  releaseSlots(action) {
    if (!action) return;
    if (action.slot) action.slot.occupiedBy = null;
    if (action.partnerSlot) action.partnerSlot.occupiedBy = null;
  }

  // --- eylem başlatma -----------------------------------------------------
  startNext() {
    if (this.current || this.join) return;
    if (this.gettingUp > 0) return;
    if (!this.queue.length) return;
    const action = this.queue.shift();
    const pose = action.def?.pose || 'stand';
    let slot = null;
    let partnerSlot = null;

    if (action.kind === 'object') {
      const obj = action.obj;
      slot = this.pickSlot(obj, pose);
      if (!slot) {
        this.toast(`${obj.label} şu an dolu 🚫`, 'warn');
        this.current = null;
        return;
      }
      if (action.partnerSim) {
        partnerSlot = this.pickSlot(obj, pose, slot);
        if (!partnerSlot && pose !== 'stand') {
          // ikinci kişi ayakta eşlik etsin
          partnerSlot = this.pickSlot(obj, 'stand');
          if (!partnerSlot) {
            this.toast('İki kişilik yer yok 🚫', 'warn');
            return;
          }
        }
        action.partnerSlot = partnerSlot;
        if (partnerSlot) partnerSlot.occupiedBy = action.partnerSim;
      }
      if (slot) slot.occupiedBy = this;
      action.slot = slot;
      const approach = slot.approach || (pose === 'stand'
        ? { x: slot.x, z: slot.z }
        : { x: slot.x - slotForward(slot).x * 0.55, z: slot.z - slotForward(slot).z * 0.55 });
      action.approach = approach;
      action.goal = approach;
    } else if (action.kind === 'sim') {
      const t = action.targetSim;
      const dx = this.pos.x - t.pos.x;
      const dz = this.pos.z - t.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      action.approach = { x: t.pos.x + (dx / len) * 0.7, z: t.pos.z + (dz / len) * 0.7 };
      action.goal = action.approach;
    } else if (action.kind === 'move') {
      action.goal = action.target;
    }

    action.started = true;
    if (action.def?.cost) this.world.spendMoney(action.def.cost);
    this.current = action;
    this.walkingNow = 0;
    this.computePath(action.goal.x, action.goal.z);
  }

  computePath(x, z) {
    const p = this.world.nav.findPath(this.pos.x, this.pos.z, x, z);
    if (p && p.length) {
      this.path = p;
      this.pathIndex = 0;
    } else {
      this.path = [{ x, z }];
      this.pathIndex = 0;
    }
  }

  followPath(dt) {
    if (!this.path || this.pathIndex >= this.path.length) return true;
    const t = this.path[this.pathIndex];
    const dx = t.x - this.pos.x;
    const dz = t.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.13) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) return true;
      return false;
    }
    const step = Math.min(dist, this.walkSpeed * dt);
    this.pos.x += (dx / dist) * step;
    this.pos.z += (dz / dist) * step;
    const desired = Math.atan2(dx, dz);
    this.yaw += shortestAngle(this.yaw, desired) * Math.min(1, dt * 9);
    this.char.group.rotation.y = this.yaw;
    this.walkingNow = Math.max(this.walkingNow, this.walkSpeed);
    return false;
  }

  beginSettle(action) {
    const slot = action.slot;
    action.phase = 'settle';
    this.walkingNow = 0;
    if (!slot) {
      this.arriveAction(action);
      return;
    }
    let final = { x: slot.x, z: slot.z };
    if (slot.pose === 'lie') {
      const f = slotForward(slot);
      final = { x: slot.x + f.x * 0.86, z: slot.z + f.z * 0.86 };
    }
    action.settled = {
      from: { x: this.pos.x, z: this.pos.z },
      to: final,
      yawFrom: this.yaw,
      yawTo: slot.yaw,
      t: 0,
    };
  }

  arriveAction(action) {
    const slot = action.slot;
    const pose = action.def?.pose || 'stand';
    if (slot) {
      if (pose === 'sit') this.sitTarget = 1;
      if (pose === 'lie') this.lieTarget = 1;
      this.sitTarget = pose === 'sit' ? 1 : 0;
      this.lieTarget = pose === 'lie' ? 1 : 0;
      if (slot.y !== undefined) this.char.state.seatY = slot.y;
      if (pose === 'lie') this.char.state.lieY = (slot.y ?? 0.55) + 0.12;
      this.yaw = slot.yaw;
      this.char.group.rotation.y = this.yaw;
    } else if (action.kind === 'sim') {
      const t = action.targetSim;
      const dx = t.pos.x - this.pos.x;
      const dz = t.pos.z - this.pos.z;
      if (Math.hypot(dx, dz) > 1.25 && action.retries < 1) {
        action.retries++;
        action.approach = { x: t.pos.x + (this.pos.x - t.pos.x) * 0.05, z: t.pos.z + (this.pos.z - t.pos.z) * 0.05 };
        action.phase = 'walk';
        this.computePath(action.approach.x, action.approach.z);
        return;
      }
      this.yaw = Math.atan2(dx, dz);
      this.char.group.rotation.y = this.yaw;
    }
    action.phase = 'act';
    action.elapsed = 0;

    if (action.partnerSim) {
      const joinSlot = this.buildJoinSlot(action);
      action.waiting = true;
      action.waitTime = 0;
      action.follower = action.partnerSim;
      this.world.startJoin(this, action, joinSlot);
    }
  }

  buildJoinSlot(action) {
    const pose = action.def?.pose || 'stand';
    if (action.partnerSlot) {
      return { ...action.partnerSlot, pose: action.partnerSlot.pose || pose };
    }
    const f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const p = { x: this.pos.x + f.x * 0.66, z: this.pos.z + f.z * 0.66 };
    const free = this.world.nav.nearestFree(p.x, p.z, 4);
    return { x: free.x, z: free.z, yaw: this.yaw + Math.PI, pose: 'stand' };
  }

  startJoin(leader, action, slot) {
    if (this.current) {
      this.releaseSlots(this.current);
      this.current = null;
    }
    this.join = { leader, action, slot, done: false };
    this.path = null;
    this.walkingNow = 0;
    this.actionDelay = 0;
    this.sitTarget = 0;
    this.lieTarget = 0;
    const target = slot.approach || { x: slot.x, z: slot.z };
    this.computePath(target.x, target.z);
  }

  finishJoinAction() {
    this.join = null;
    this.sitTarget = 0;
    this.lieTarget = 0;
    this.gettingUp = 0.4;
    this.path = null;
  }

  // --- güncelleme ---------------------------------------------------------
  update(dt, dtMin, world) {
    this.world = world;
    this.walkingNow = 0;
    this.updateNeeds(dtMin, world);

    if (this.gettingUp > 0) {
      this.gettingUp -= dt;
      this.sitTarget = 0;
      this.lieTarget = 0;
    }

    if (this.join) {
      this.updateJoin(dt, dtMin);
    } else {
      if (!this.current) this.startNext(world);
      if (this.current) this.updateAction(dt, dtMin, world);
      else this.idle(dt, dtMin, world);
    }

    this.updateMood(world);
    this.updateCharacter(dt);
  }

  updateNeeds(dtMin, world) {
    const sleeping = this.isSleeping;
    const decayMul = sleeping ? 0.45 : 1;
    for (const k of NEED_KEYS) {
      let dec = NEEDS[k].decay * dtMin * decayMul;
      if (sleeping && (k === 'fun' || k === 'social')) dec *= 0.5;
      this.needs[k] = clamp(this.needs[k] - dec, 0, 100);
    }
    if (sleeping) {
      this.needs.energy = clamp(this.needs.energy + 0.34 * dtMin, 0, 100);
    }
    // gece geç saatte enerji biraz daha hızlı düşer
    const hour = world.minuteOfDay / 60;
    if (!sleeping && (hour >= 23 || hour < 6)) {
      this.needs.energy = clamp(this.needs.energy - 0.02 * dtMin, 0, 100);
    }
    // süresi geçen moodlet'ler
    this.moodlets = this.moodlets.filter((m) => m.until > world.totalMinutes);
  }

  addMoodlet(m) {
    if (!m) return;
    const until = this.world.totalMinutes + (m.dur || 180);
    const existing = this.moodlets.find((x) => x.label === m.label);
    if (existing) {
      existing.until = Math.max(existing.until, until);
    } else {
      this.moodlets.push({ ...m, until });
    }
  }

  updateMood(world) {
    const avg = NEED_KEYS.reduce((s, k) => s + this.needs[k], 0) / NEED_KEYS.length;
    const moodletSum = this.moodlets.reduce((s, m) => s + m.mood, 0);
    let mood = avg * 0.82 + 12 + moodletSum;
    if (world.state.romance > 70) mood += 5;
    if (world.state.romance > 90) mood += 3;
    // açlık / mesane kritikse ceza
    if (this.needs.bladder < 12) mood -= 8;
    if (this.needs.hunger < 12) mood -= 6;
    this.mood = clamp(mood, 0, 100);
    this.char.state.mood = this.mood;
  }

  updateAction(dt, dtMin, world) {
    const a = this.current;
    if (!a) return;

    if (a.phase === 'walk') {
      const done = this.followPath(dt);
      if (done) {
        if (a.slot) this.beginSettle(a);
        else this.arriveAction(a);
      }
      return;
    }

    if (a.phase === 'settle') {
      const s = a.settled;
      if (!s) {
        this.arriveAction(a);
        return;
      }
      s.t = Math.min(1, s.t + dt / 0.42);
      const e = s.t * s.t * (3 - 2 * s.t);
      this.pos.x = s.from.x + (s.to.x - s.from.x) * e;
      this.pos.z = s.from.z + (s.to.z - s.from.z) * e;
      this.yaw = s.yawFrom + shortestAngle(s.yawFrom, s.yawTo) * e;
      this.char.group.rotation.y = this.yaw;
      this.sitTarget = a.def?.pose === 'sit' ? e : 0;
      this.lieTarget = a.def?.pose === 'lie' ? e : 0;
      if (s.t >= 1) {
        this.arriveAction(a);
      }
      return;
    }

    if (a.phase === 'act') {
      if (a.def?.sleep) {
        if (this.needs.energy >= 98) {
          this.finishAction(world, true);
          return;
        }
      }
      if (a.waiting) {
        a.waitTime += dt;
        const f = a.follower;
        const coming = f && f.join && f.join.action === a;
        if (!coming && a.waitTime > 1.2) {
          // eş katılmadı/iptal etti: yalnız devam et
          a.waiting = false;
          a.follower = null;
          this.toast(`${this.def.name} yalnız devam ediyor 🙃`, 'info');
        } else if (a.waitTime > 26) {
          if (f) world.endJoin(f, a);
          a.waiting = false;
          a.follower = null;
          this.toast(`${this.def.name} eşini bekledi ama gelemedi 😅`, 'warn');
        }
        if (a.waiting) return;
      } else {
        a.elapsed += dtMin;
      }
      if (a.kind === 'move') {
        this.finishAction(world, true);
        return;
      }
      if (a.elapsed >= a.duration) {
        this.finishAction(world, true);
      }
      return;
    }
  }

  finishAction(world, completed) {
    const a = this.current;
    if (!a) return;
    if (a.phase === 'walk' || a.phase === 'settle') {
      // yürürken iptal
    }
    if (completed) world.completeAction(this, a);
    if (a.follower) world.endJoin(a.follower, a);
    this.releaseSlots(a);
    this.current = null;
    this.path = null;
    this.settle = null;
    const seated = a.def?.pose === 'sit' || a.def?.pose === 'lie';
    this.sitTarget = 0;
    this.lieTarget = 0;
    if (seated) this.gettingUp = 0.45;
  }

  updateJoin(dt, dtMin) {
    const j = this.join;
    const slot = j.slot;
    if (j.done) {
      this.walkingNow = 0;
      return;
    }
    j.timeout = (j.timeout || 0) + dt;
    if (j.timeout > 30) {
      this.toast(`${this.def.name} yetişemedi 😅`, 'info');
      this.finishJoinAction();
      return;
    }
    const isLie = slot.pose === 'lie';
    const f = slotForward(slot);
    const target = isLie ? { x: slot.x + f.x * 0.86, z: slot.z + f.z * 0.86 } : { x: slot.x, z: slot.z };

    if (!j.sliding) {
      const approach = slot.approach || target;
      const dist = Math.hypot(approach.x - this.pos.x, approach.z - this.pos.z);
      if (dist > 0.18) {
        this.followPath(dt);
        if (!this.path || this.pathIndex >= this.path.length) {
          const d2 = Math.hypot(approach.x - this.pos.x, approach.z - this.pos.z);
          if (d2 > 0.18) {
            const step = Math.min(d2, this.walkSpeed * dt);
            this.pos.x += ((approach.x - this.pos.x) / d2) * step;
            this.pos.z += ((approach.z - this.pos.z) / d2) * step;
            this.yaw += shortestAngle(this.yaw, Math.atan2(approach.x - this.pos.x, approach.z - this.pos.z)) * Math.min(1, dt * 9);
            this.char.group.rotation.y = this.yaw;
            this.walkingNow = this.walkSpeed;
          }
        }
        return;
      }
      j.sliding = { from: { x: this.pos.x, z: this.pos.z }, yawFrom: this.yaw, t: 0 };
    }

    const s = j.sliding;
    s.t = Math.min(1, s.t + dt / 0.4);
    const e = s.t * s.t * (3 - 2 * s.t);
    this.pos.x = s.from.x + (target.x - s.from.x) * e;
    this.pos.z = s.from.z + (target.z - s.from.z) * e;
    this.yaw = s.yawFrom + shortestAngle(s.yawFrom, slot.yaw) * e;
    this.char.group.rotation.y = this.yaw;
    if (slot.pose === 'sit') {
      this.sitTarget = e;
      this.lieTarget = 0;
      this.char.state.seatY = slot.y ?? 0.46;
    } else if (isLie) {
      this.lieTarget = e;
      this.sitTarget = 0;
      this.char.state.lieY = (slot.y ?? 0.55) + 0.12;
    }
    if (s.t >= 1) {
      this.sitTarget = slot.pose === 'sit' ? 1 : 0;
      this.lieTarget = isLie ? 1 : 0;
      j.done = true;
      this.world.partnerReady(j.leader, j.action, this);
    }
  }

  idle(dt, dtMin, world) {
    this.walkingNow = 0;
    this.sitTarget = 0;
    this.lieTarget = 0;
    if (!world.freeWill) return;
    this.thinkTimer -= dtMin;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = 2 + Math.random() * 3.5;
    this.think(world);
  }

  think(world) {
    if (this.gettingUp > 0) return;
    const n = this.needs;
    const partner = this.partner;
    const hour = world.minuteOfDay / 60;
    const night = hour >= 22 || hour < 6;
    const pick = (type, interactionId) => {
      const objs = world.objects.filter((o) => o.type === type);
      for (const o of objs) {
        const def = o.def.interactions.find((i) => i.id === interactionId) || o.def.interactions[0];
        if (!def) continue;
        const pose = def.pose || 'stand';
        const freeSeat = this.pickSlot(o, pose);
        if (!freeSeat) continue;
        const action = this.makeObjectAction(o, def);
        if (action) {
          this.enqueue(action);
          return true;
        }
      }
      return false;
    };

    // acil ihtiyaçlar
    if (n.energy < 22 && pick('bed', 'bed_sleep')) return;
    if (n.bladder < 34 && pick('toilet', 'toilet_use')) return;
    if (n.hunger < 42) {
      if (pick('fridge', 'fridge_snack')) return;
      if (pick('stove', 'stove_cook')) return;
      if (pick('table', 'table_eat')) return;
    }
    if (n.hygiene < 30 && pick('shower', 'shower_shower')) return;
    if (night && n.energy < 55) {
      if (pick('bed', 'bed_sleep')) return;
    }
    if (n.social < 32 && partner && !partner.isSleeping && !partner.join) {
      const opts = SIM_INTERACTIONS.filter((i) => !i.requireRomance || world.state.romance >= i.requireRomance);
      const chat = opts[Math.floor(Math.random() * Math.min(3, opts.length))];
      const action = this.makeSimAction(partner, chat);
      if (action) {
        this.enqueue(action);
        return;
      }
    }
    if (n.fun < 40) {
      const options = [
        ['sofa', 'sofa_tv'],
        ['tv', 'tv_watch'],
        ['bookshelf', 'books_read'],
        ['guitar', 'guitar_play'],
        ['radio', 'radio_dance'],
        ['cat', 'cat_pet'],
        ['sofa', 'sofa_relax'],
        ['yoga', 'yoga_stretch'],
      ].sort(() => Math.random() - 0.5);
      for (const [t, i] of options) {
        if (pick(t, i)) return;
      }
    }
    if (n.hunger < 55 && Math.random() < 0.4) {
      if (pick('fridge', 'fridge_snack')) return;
    }
    if (night && n.energy < 80 && Math.random() < 0.6) {
      if (pick('bed', 'bed_sleep')) return;
    }

    // küçük hayatlar: rastgele hoş şeyler
    if (Math.random() < 0.3) {
      const chill = [
        ['plant', 'plant_water'],
        ['painting', 'painting_admire'],
        ['dresser', 'dresser_look'],
        ['stove', 'stove_kettle'],
        ['sofa', 'sofa_relax'],
        ['radio', 'radio_dance'],
        ['bench', 'bench_sit'],
        ['bookshelf', 'books_poetry'],
      ];
      const [t, i] = chill[Math.floor(Math.random() * chill.length)];
      if (pick(t, i)) return;
    }
    // kendi partneriyle vakit geçirme
    if (partner && !partner.isSleeping && !partner.join && !partner.current && Math.random() < 0.35) {
      const opts = SIM_INTERACTIONS.filter((i) => (!i.requireRomance || world.state.romance >= i.requireRomance) && i.dur <= 40);
      if (opts.length) {
        const def = opts[Math.floor(Math.random() * opts.length)];
        const action = this.makeSimAction(partner, def);
        if (action) {
          this.enqueue(action);
          return;
        }
      }
    }
    // dolaşma
    if (this.wanderCooldown > 0) {
      this.wanderCooldown -= 1;
      return;
    }
    if (Math.random() < 0.35) {
      this.wanderCooldown = 15 + Math.random() * 10;
      const spots = this.world.wanderSpots;
      const s = spots[Math.floor(Math.random() * spots.length)];
      const free = this.world.nav.nearestFree(s.x, s.z, 6);
      this.enqueue(this.makeMoveAction(free.x, free.z));
    }
  }

  // --- karakter durumu ----------------------------------------------------
  updateCharacter(dt) {
    const c = this.char;
    const action = this.join ? this.join.action : this.current;
    const def = action?.def;
    let anim = def?.anim || null;
    if (this.join && !this.join.done) anim = null;
    if (this.current && this.current.phase === 'walk') anim = null;
    c.state.act = anim;
    c.state.mode = this.walkingNow > 0.02 ? 'walk' : 'idle';
    c.state.speed = this.walkingNow;
    c.state.sit = this.sitTarget;
    c.state.lie = this.lieTarget;
    if (this.sitTarget > 0.01) c.state.sit = this.sitTarget;
    c.update(dt, this.world.time);
  }

  moodInfo() {
    for (const level of MOOD_LEVELS) {
      if (this.mood >= level.min) return level;
    }
    return MOOD_LEVELS[MOOD_LEVELS.length - 1];
  }
}

export function simInteractionById(id) {
  return SIM_INTERACTIONS.find((i) => i.id === id);
}
