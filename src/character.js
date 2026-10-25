import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const damp = THREE.MathUtils.damp;
const lerp = THREE.MathUtils.lerp;
const HALF_PI = Math.PI / 2;

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, ...opts });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(w, h, d, r, mat) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
}

// ---------------------------------------------------------------------------
// Karakter — sevimli, yumuşak hatlı, prosedürel animasyonlu
// ---------------------------------------------------------------------------

export class Character {
  constructor(def) {
    this.def = def;
    this.group = new THREE.Group();
    this.group.name = `sim-${def.id}`;
    this.pose = new THREE.Group();
    this.group.add(this.pose);

    this.joints = {};
    this.materials = {};
    this.state = {
      mode: 'idle',
      act: null,
      sit: 0,
      lie: 0,
      seatY: 0.46,
      lieY: 0.62,
      speed: 0,
      crouch: 0,
      mood: 80,
      talking: false,
    };

    this.walkPhase = Math.random() * 10;
    this.time = Math.random() * 10;
    this.blinkIn = 1.5 + Math.random() * 3;
    this.blink = 0;
    this.lookTarget = { yaw: 0, pitch: 0 };
    this.lookTimer = 2;
    this.mouthPhase = Math.random() * 10;
    this.sitSmoothed = 0;
    this.lieSmoothed = 0;
    this.breath = Math.random() * Math.PI * 2;

    this.build();
    this.targets = {};
  }

  build() {
    const d = this.def;
    const skin = std(d.skin, { roughness: 0.62 });
    const top = std(d.top, { roughness: 0.85 });
    const topAccent = std(d.topAccent, { roughness: 0.85 });
    const bottom = std(d.bottom, { roughness: 0.9 });
    const hair = std(d.hair, { roughness: 0.65 });
    const shoe = std(d.shoes, { roughness: 0.85 });
    const eyeWhite = std('#fffaf2', { roughness: 0.35 });
    const iris = std(d.id === 'ferhanim' ? '#5b3a2c' : '#3d5a56', { roughness: 0.3 });
    const pupil = std('#241a16', { roughness: 0.2 });
    const mouth = std('#c2726c', { roughness: 0.5 });
    const blush = new THREE.MeshStandardMaterial({ color: '#e79a8f', roughness: 0.9, transparent: true, opacity: 0.42 });
    const gold = std('#d3a95f', { roughness: 0.35, metalness: 0.6 });
    this.materials = { skin, top, bottom, hair, shoe, mouth, eyeWhite, iris, blush };

    // --- gövde -------------------------------------------------------------
    const pelvis = new THREE.Object3D();
    pelvis.position.set(0, 0.86, 0);
    this.pose.add(pelvis);
    this.joints.pelvis = pelvis;

    const hips = shadowed(box(0.34, 0.20, 0.235, 0.075, bottom));
    hips.position.y = -0.04;
    pelvis.add(hips);

    const waistBand = shadowed(box(0.345, 0.055, 0.24, 0.02, top));
    waistBand.position.y = 0.075;
    pelvis.add(waistBand);

    const spine = new THREE.Object3D();
    spine.position.y = 0.05;
    pelvis.add(spine);
    this.joints.spine = spine;

    const torso = shadowed(box(0.385, 0.47, 0.235, 0.085, top));
    torso.position.y = 0.235;
    spine.add(torso);
    this.torso = torso;

    // hafif göğüs kıvrımı (kadın/erkek farkı)
    if (d.id === 'ferhanim') {
      const chest = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), top));
      chest.scale.set(1.45, 0.62, 0.75);
      chest.position.set(0, 0.31, 0.075);
      spine.add(chest);
      const collar = box(0.2, 0.05, 0.05, 0.02, topAccent);
      collar.position.set(0, 0.45, 0.07);
      spine.add(collar);
    } else {
      const placket = shadowed(box(0.045, 0.34, 0.02, 0.008, topAccent));
      placket.position.set(0, 0.28, 0.118);
      spine.add(placket);
      for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), std('#f3e9d6', { roughness: 0.4 }));
        btn.position.set(0, 0.37 - i * 0.1, 0.131);
        spine.add(btn);
      }
    }

    // yaka
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 18), topAccent);
    collarRing.rotation.x = HALF_PI;
    collarRing.scale.set(1.2, 0.9, 1);
    collarRing.position.y = 0.465;
    spine.add(collarRing);

    // --- boyun & kafa -------------------------------------------------------
    const neck = new THREE.Object3D();
    neck.position.y = 0.50;
    spine.add(neck);
    this.joints.neck = neck;

    const neckMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.06, 4, 10), skin));
    neckMesh.position.y = 0.02;
    neck.add(neckMesh);

    const head = new THREE.Object3D();
    head.position.y = 0.16;
    neck.add(head);
    this.joints.head = head;

    const skull = shadowed(box(0.30, 0.31, 0.275, 0.105, skin));
    head.add(skull);

    const earL = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), skin));
    earL.scale.set(0.55, 0.9, 0.7);
    earL.position.set(0.152, 0.005, -0.005);
    head.add(earL);
    const earR = earL.clone();
    earR.position.x *= -1;
    head.add(earR);

    // burun
    const nose = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), std('#e3ad8f', { roughness: 0.65 })));
    nose.scale.set(1, 0.9, 0.9);
    nose.position.set(0, -0.005, 0.142);
    head.add(nose);

    // gözler
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Object3D();
      eyeGroup.position.set(side * 0.073, 0.025, 0.128);
      head.add(eyeGroup);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 14), eyeWhite);
      white.scale.set(0.94, 1.08, 0.55);
      eyeGroup.add(white);
      const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 12), iris);
      irisMesh.scale.set(1, 1, 0.55);
      irisMesh.position.z = 0.026;
      eyeGroup.add(irisMesh);
      const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), pupil);
      pupilMesh.scale.set(1, 1, 0.5);
      pupilMesh.position.z = 0.036;
      eyeGroup.add(pupilMesh);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      glint.position.set(0.008, 0.011, 0.042);
      eyeGroup.add(glint);
      this.eyes.push(eyeGroup);
      if (d.id === 'ferhanim') {
        const lash = box(0.055, 0.012, 0.015, 0.005, hair);
        lash.position.set(side * 0.01, 0.048, 0.012);
        lash.rotation.z = side * 0.16;
        eyeGroup.add(lash);
      }
    }

    // kaşlar
    this.brows = [];
    for (const side of [-1, 1]) {
      const brow = box(0.085, 0.018, 0.02, 0.006, hair);
      brow.position.set(side * 0.075, 0.092, 0.135);
      brow.rotation.z = -side * 0.08;
      head.add(brow);
      this.brows.push({ mesh: brow, side });
    }

    // ağız — gülümseme yayı ve düz çizgi
    const mouthGroup = new THREE.Object3D();
    mouthGroup.position.set(0, -0.077, 0.139);
    head.add(mouthGroup);
    this.mouthGroup = mouthGroup;
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 6, 14, Math.PI), mouth);
    this.smile.rotation.z = Math.PI;
    this.smile.position.y = 0.012;
    mouthGroup.add(this.smile);
    this.frown = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.010, 6, 12, Math.PI), mouth);
    this.frown.position.y = -0.012;
    this.frown.visible = false;
    mouthGroup.add(this.frown);

    // yanaklar
    for (const side of [-1, 1]) {
      const blushMesh = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), blush);
      blushMesh.scale.set(1, 0.6, 0.25);
      blushMesh.position.set(side * 0.107, -0.042, 0.118);
      head.add(blushMesh);
    }

    // saç
    this.buildHair(head, hair);

    // aksesuar
    if (d.id === 'ferhanim') {
      const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.006, 6, 20), gold);
      necklace.rotation.x = HALF_PI;
      necklace.position.set(0, 0.42, 0.05);
      necklace.scale.set(1.15, 1, 1);
      spine.add(necklace);
      const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), gold);
      pendant.position.set(0, 0.34, 0.115);
      spine.add(pendant);
      for (const side of [-1, 1]) {
        const earring = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), gold);
        earring.position.set(side * 0.155, -0.045, 0.0);
        head.add(earring);
      }
    } else {
      const watch = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 8, 14), std('#3d4b52', { metalness: 0.5, roughness: 0.4 }));
      watch.rotation.x = HALF_PI;
      watch.position.y = -0.015;
      this.watchJoint = watch;
    }

    // --- kollar -------------------------------------------------------------
    const sleeveMat = d.id === 'ferhanim' ? topAccent : top;
    this.arms = {};
    for (const side of [-1, 1]) {
      const key = side > 0 ? 'L' : 'R';
      const shoulder = new THREE.Object3D();
      shoulder.position.set(side * 0.228, 0.435, 0);
      spine.add(shoulder);
      this.joints[`shoulder${key}`] = shoulder;

      const sleeve = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.075, 4, 10), sleeveMat));
      sleeve.position.y = -0.075;
      shoulder.add(sleeve);
      const sleeveCuff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.045, 12), sleeveMat));
      sleeveCuff.position.y = -0.145;
      shoulder.add(sleeveCuff);

      const upper = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.057, 0.19, 4, 10), skin));
      upper.position.y = -0.16;
      shoulder.add(upper);

      const elbow = new THREE.Object3D();
      elbow.position.y = -0.30;
      shoulder.add(elbow);
      this.joints[`elbow${key}`] = elbow;

      const fore = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.16, 4, 10), skin));
      fore.position.y = -0.135;
      elbow.add(fore);

      const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), skin));
      hand.scale.set(0.85, 1.1, 0.95);
      hand.position.y = -0.28;
      elbow.add(hand);

      if (key === 'R' && this.watchJoint) {
        this.watchJoint.position.set(0, -0.235, 0);
        this.watchJoint.rotation.x = 0;
        this.watchJoint.rotation.z = HALF_PI;
        this.watchJoint.scale.set(1, 1, 1);
        elbow.add(this.watchJoint);
      }

      this.arms[key] = { shoulder, elbow, hand };
    }

    // --- bacaklar -----------------------------------------------------------
    this.legs = {};
    for (const side of [-1, 1]) {
      const key = side > 0 ? 'L' : 'R';
      const hip = new THREE.Object3D();
      hip.position.set(side * 0.098, -0.06, 0);
      pelvis.add(hip);
      this.joints[`hip${key}`] = hip;

      const thigh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.076, 0.20, 4, 10), bottom));
      thigh.position.y = -0.185;
      hip.add(thigh);

      const knee = new THREE.Object3D();
      knee.position.y = -0.365;
      hip.add(knee);
      this.joints[`knee${key}`] = knee;

      const shin = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.235, 4, 10), d.id === 'ferhanim' ? bottom : skin));
      shin.position.y = -0.155;
      knee.add(shin);

      const foot = new THREE.Object3D();
      foot.position.y = -0.335;
      knee.add(foot);
      this.joints[`foot${key}`] = foot;

      const slipper = shadowed(box(0.115, 0.07, 0.245, 0.032, shoe));
      slipper.position.set(0, -0.01, 0.045);
      foot.add(slipper);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), std(d.id === 'ferhanim' ? '#e9b7a8' : '#d8c7a9', { roughness: 1 }));
      pom.position.set(0, 0.035, 0.1);
      foot.add(pom);

      this.legs[key] = { hip, knee, foot };
    }

    this.group.scale.setScalar(0.97 + (d.id === 'yusuf' ? 0.06 : 0));
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  buildHair(head, hair) {
    const long = this.def.hairStyle === 'long';
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.172, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hair,
    );
    cap.scale.set(1.03, 1.02, 1.05);
    cap.position.y = 0.045;
    cap.rotation.x = -0.12;
    head.add(cap);

    const fringe = shadowed(box(0.29, 0.11, 0.075, 0.03, hair));
    fringe.position.set(0, 0.115, 0.108);
    fringe.rotation.x = -0.42;
    head.add(fringe);

    if (long) {
      const back = shadowed(box(0.31, 0.42, 0.14, 0.06, hair));
      back.position.set(0, -0.11, -0.095);
      head.add(back);
      for (const side of [-1, 1]) {
        const strand = shadowed(box(0.085, 0.34, 0.11, 0.04, hair));
        strand.position.set(side * 0.145, -0.08, 0.015);
        strand.rotation.z = side * 0.06;
        head.add(strand);
      }
      const bun = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), hair));
      bun.position.set(0, 0.10, -0.165);
      bun.scale.set(1.05, 0.9, 0.85);
      head.add(bun);
      // toka
      const clip = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14), std('#d9a05b', { metalness: 0.3, roughness: 0.5 }));
      clip.position.set(0.03, 0.175, -0.13);
      clip.rotation.x = 0.9;
      head.add(clip);
    } else {
      const quiff = shadowed(box(0.2, 0.09, 0.14, 0.035, hair));
      quiff.position.set(0.028, 0.175, 0.055);
      quiff.rotation.set(-0.25, 0.18, 0.12);
      head.add(quiff);
      for (const side of [-1, 1]) {
        const sideburn = shadowed(box(0.02, 0.08, 0.055, 0.008, hair));
        sideburn.position.set(side * 0.146, 0.04, -0.02);
        head.add(sideburn);
      }
      // bıyık
      const tache = shadowed(box(0.082, 0.016, 0.02, 0.007, hair));
      tache.position.set(0, -0.045, 0.145);
      head.add(tache);
      const tacheL = shadowed(box(0.022, 0.03, 0.018, 0.006, hair));
      tacheL.position.set(-0.045, -0.052, 0.143);
      tacheL.rotation.z = 0.3;
      head.add(tacheL);
      const tacheR = tacheL.clone();
      tacheR.position.x *= -1;
      tacheR.rotation.z *= -1;
      head.add(tacheR);
    }
  }

  // -------------------------------------------------------------------------
  update(dt, t) {
    const st = this.state;
    this.time += dt;
    this.breath += dt * (st.act === 'sleep' ? 0.9 : 1.9);

    // --- yumuşak oturma / yatma geçişleri
    this.sitSmoothed = damp(this.sitSmoothed, st.sit, 8, dt);
    this.lieSmoothed = damp(this.lieSmoothed, st.lie, 6, dt);
    const sit = this.sitSmoothed;
    const lie = this.lieSmoothed;

    const breathe = Math.sin(this.breath);
    const speed = st.speed || 0;
    const moving = st.mode === 'walk' && speed > 0.02;
    if (moving) this.walkPhase += dt * (2.4 + speed * 2.2) * 2.4;
    const wp = this.walkPhase;
    const walkAmt = damp(this._walkAmt || 0, moving ? 1 : 0, 9, dt);
    this._walkAmt = walkAmt;

    // bakış
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = 1.6 + Math.random() * 3.4;
      this.lookTarget.yaw = (Math.random() - 0.5) * 0.55;
      this.lookTarget.pitch = (Math.random() - 0.5) * 0.18;
      if (Math.random() > 0.72) this.lookTarget.yaw = (Math.random() - 0.5) * 0.9;
    }
    const tiredFactor = THREE.MathUtils.clamp(1 - (st.mood ?? 80) / 100, 0, 1);
    const lookYaw = this.lookTarget.yaw * (st.act === 'sleep' ? 0 : 1) * (1 - tiredFactor * 0.3);
    const lookPitch = st.act === 'sleep' ? 0 : this.lookTarget.pitch;

    // --- temel hedefler
    const T = {
      pelvis: [0, 0, 0],
      spine: [0, 0, 0],
      neck: [0, 0, 0],
      head: [lookPitch, lookYaw, 0],
      shoulderL: [0, 0, 0.075 + breathe * 0.008],
      shoulderR: [0, 0, -0.075 - breathe * 0.008],
      elbowL: [-0.16, 0, 0.02],
      elbowR: [-0.16, 0, -0.02],
      hipL: [0, 0, 0.015],
      hipR: [0, 0, -0.015],
      kneeL: [0.02, 0, 0],
      kneeR: [0.02, 0, 0],
      footL: [0, 0, 0],
      footR: [0, 0, 0],
    };

    // nefes / ağırlık kayması
    T.spine[2] = Math.sin(this.breath * 0.55) * 0.012;
    T.spine[0] += breathe * 0.006;
    T.pelvis[1] = Math.sin(this.breath * 0.4) * 0.02;
    T.head[2] = Math.sin(this.time * 0.4) * 0.02;

    // --- oturma pozu
    if (sit > 0.001) {
      T.hipL[0] = -HALF_PI * 0.84 * sit;
      T.hipR[0] = -HALF_PI * 0.84 * sit;
      T.kneeL[0] = HALF_PI * 0.84 * sit;
      T.kneeR[0] = HALF_PI * 0.84 * sit;
      T.hipL[2] = 0.1 * sit;
      T.hipR[2] = -0.1 * sit;
      T.spine[0] += -0.03 * sit;
      T.elbowL[0] = -0.32 * sit;
      T.elbowR[0] = -0.32 * sit;
      T.shoulderL[2] += 0.04 * sit;
      T.shoulderR[2] -= 0.04 * sit;
    }

    // --- yatma pozu
    if (lie > 0.001) {
      T.hipL[0] = 0.02 * lie;
      T.hipR[0] = 0.02 * lie;
      T.kneeL[0] = 0.02 + 0.04 * lie;
      T.kneeR[0] = 0.02 + 0.08 * lie;
      T.hipL[2] = 0.05 * lie;
      T.hipR[2] = -0.05 * lie;
      T.footL[0] = -0.55 * lie;
      T.footR[0] = -0.55 * lie;
      T.shoulderL[2] = 0.19 * lie;
      T.shoulderR[2] = -0.19 * lie;
      T.elbowL[0] = -0.2 * lie;
      T.elbowR[0] = -0.2 * lie;
      T.head[0] = -0.05 * lie;
      T.head[2] = 0.05 * lie;
    }

    // --- yürüyüş
    if (walkAmt > 0.001) {
      const s = Math.sin(wp);
      const c = Math.cos(wp);
      T.hipL[0] = s * 0.52 * walkAmt - HALF_PI * 0.84 * sit;
      T.hipR[0] = -s * 0.52 * walkAmt - HALF_PI * 0.84 * sit;
      T.kneeL[0] = Math.max(0, -s) * 0.7 * walkAmt + HALF_PI * 0.84 * sit;
      T.kneeR[0] = Math.max(0, s) * 0.7 * walkAmt + HALF_PI * 0.84 * sit;
      T.footL[0] = Math.max(0, -c) * 0.22 * walkAmt;
      T.footR[0] = Math.max(0, c) * 0.22 * walkAmt;
      T.shoulderL[0] = -s * 0.42 * walkAmt;
      T.shoulderR[0] = s * 0.42 * walkAmt;
      T.elbowL[0] = -0.25 - Math.max(0, -s) * 0.2;
      T.elbowR[0] = -0.25 - Math.max(0, s) * 0.2;
      T.spine[0] += 0.035 * walkAmt;
      T.pelvis[1] += Math.sin(wp * 0.5) * 0.06 * walkAmt;
      T.head[1] += Math.sin(wp * 0.5) * -0.03;
    }

    // --- eylem pozları
    const act = st.act || st.mode;
    const tp = this.time;
    this.talking = false;

    switch (act) {
      case 'eat': {
        const cycle = (Math.sin(tp * 3.2) + 1) / 2;
        T.shoulderR[0] = -0.95 - cycle * 0.55;
        T.shoulderR[2] = -0.28;
        T.elbowR[0] = -1.5 - cycle * 0.25;
        T.head[0] += 0.06;
        T.spine[0] += 0.03;
        if (sit < 0.5) {
          T.shoulderL[0] = -0.12;
          T.shoulderL[2] = 0.45;
          T.elbowL[0] = -0.9;
        }
        this.talking = Math.random() < 0.02;
        break;
      }
      case 'cook': {
        T.spine[0] += 0.12;
        T.head[0] += 0.22;
        T.shoulderL[0] = -0.65;
        T.shoulderL[2] = 0.18;
        T.elbowL[0] = -0.85;
        T.shoulderR[0] = -0.7 + Math.sin(tp * 4) * 0.09;
        T.shoulderR[2] = -0.22 + Math.cos(tp * 4) * 0.1;
        T.elbowR[0] = -1.0;
        T.pelvis[1] += Math.sin(tp * 2) * 0.02;
        break;
      }
      case 'wash': {
        T.spine[0] += 0.14;
        T.head[0] += 0.24;
        T.shoulderL[0] = -0.62 + Math.sin(tp * 6) * 0.08;
        T.shoulderR[0] = -0.62 - Math.sin(tp * 6) * 0.08;
        T.shoulderL[2] = 0.18;
        T.shoulderR[2] = -0.18;
        T.elbowL[0] = -0.6;
        T.elbowR[0] = -0.6;
        break;
      }
      case 'shower': {
        const scrub = Math.sin(tp * 3.4);
        T.shoulderR[0] = -2.0;
        T.shoulderR[2] = -0.55;
        T.elbowR[0] = -1.7 + scrub * 0.2;
        T.shoulderL[0] = -0.5 + scrub * 0.2;
        T.shoulderL[2] = 0.6;
        T.elbowL[0] = -1.5;
        T.head[0] += 0.12;
        T.spine[1] += Math.sin(tp * 1.6) * 0.05;
        break;
      }
      case 'type': {
        T.spine[0] += 0.05;
        T.shoulderL[0] = -0.82;
        T.shoulderR[0] = -0.82;
        T.shoulderL[2] = 0.13;
        T.shoulderR[2] = -0.13;
        T.elbowL[0] = -0.85 + Math.sin(tp * 11) * 0.035;
        T.elbowR[0] = -0.85 + Math.cos(tp * 10) * 0.035;
        T.head[0] += 0.12;
        T.head[1] += Math.sin(tp * 0.7) * 0.06;
        break;
      }
      case 'watch': {
        T.spine[0] += -0.05;
        T.head[0] += -0.04;
        T.shoulderL[0] = -0.3;
        T.elbowL[0] = -0.5;
        T.shoulderR[0] = -0.3;
        T.elbowR[0] = -0.5;
        T.head[1] += Math.sin(tp * 0.5) * 0.05;
        break;
      }
      case 'read': {
        T.head[0] += 0.26;
        T.shoulderL[0] = -0.92;
        T.shoulderR[0] = -0.92;
        T.shoulderL[2] = 0.24;
        T.shoulderR[2] = -0.24;
        T.elbowL[0] = -1.35;
        T.elbowR[0] = -1.35;
        T.spine[0] += 0.04;
        break;
      }
      case 'guitar': {
        T.shoulderL[0] = -0.95;
        T.shoulderL[2] = 0.5;
        T.elbowL[0] = -1.25;
        T.shoulderR[0] = -0.55 + Math.sin(tp * 7) * 0.28;
        T.shoulderR[2] = -0.5;
        T.elbowR[0] = -1.1;
        T.head[0] += 0.14;
        T.head[1] += 0.12;
        T.pelvis[1] += Math.sin(tp * 1.6) * 0.06;
        break;
      }
      case 'dance': {
        const beat = Math.sin(tp * 4.4);
        T.shoulderL[2] = 1.55 + beat * 0.35;
        T.shoulderR[2] = -1.55 - beat * 0.35;
        T.shoulderL[0] = -0.2;
        T.shoulderR[0] = -0.2;
        T.elbowL[0] = -0.95;
        T.elbowR[0] = -0.95;
        T.pelvis[1] = beat * 0.18;
        T.spine[2] = beat * 0.09;
        T.head[2] = beat * 0.08;
        T.head[1] = beat * 0.12;
        T.hipL[2] = 0.12;
        T.hipR[2] = -0.12;
        if (sit < 0.2) {
          T.kneeL[0] = Math.max(0, beat) * 0.3;
          T.kneeR[0] = Math.max(0, -beat) * 0.3;
        }
        break;
      }
      case 'yoga': {
        const sway = Math.sin(tp * 1.5);
        T.shoulderL[2] = 2.5 + sway * 0.15;
        T.shoulderR[2] = -2.5 - sway * 0.15;
        T.elbowL[0] = -0.25;
        T.elbowR[0] = -0.25;
        T.spine[2] = sway * 0.12;
        T.head[0] = -0.15;
        T.hipL[2] = 0.06;
        T.hipR[2] = -0.06;
        T.pelvis[1] = sway * 0.08;
        break;
      }
      case 'admire': {
        T.shoulderR[0] = -1.15;
        T.shoulderR[2] = -0.42;
        T.elbowR[0] = -1.9;
        T.head[0] = -0.05;
        T.head[2] = 0.14;
        T.head[1] = Math.sin(tp * 0.8) * 0.12;
        T.spine[2] = 0.03;
        break;
      }
      case 'water': {
        T.spine[0] += 0.22;
        T.head[0] += 0.3;
        T.shoulderR[0] = -0.62;
        T.shoulderR[2] = -0.3;
        T.elbowR[0] = -0.35;
        T.shoulderL[2] = 0.55;
        T.elbowL[0] = -1.1;
        break;
      }
      case 'pet': {
        T.spine[0] += 0.3;
        T.head[0] += 0.24;
        T.shoulderR[0] = -0.85 + Math.sin(tp * 4.5) * 0.18;
        T.shoulderR[2] = -0.2;
        T.elbowR[0] = -0.45;
        T.shoulderL[2] = 0.35;
        T.elbowL[0] = -0.75;
        T.kneeL[0] = 0.35;
        T.kneeR[0] = 0.35;
        T.hipL[0] = -0.2;
        T.hipR[0] = -0.2;
        T.pelvis[0] = 0.08;
        break;
      }
      case 'toilet': {
        T.spine[0] += 0.06;
        T.shoulderL[0] = -0.35;
        T.shoulderR[0] = -0.35;
        T.shoulderL[2] = 0.25;
        T.shoulderR[2] = -0.25;
        T.elbowL[0] = -0.55;
        T.elbowR[0] = -0.55;
        T.head[1] += Math.sin(tp * 0.6) * 0.2;
        break;
      }
      case 'sleep': {
        T.head[2] = 0.12;
        T.head[0] = -0.06;
        T.shoulderL[2] = 0.24;
        T.shoulderR[2] = -0.24;
        T.shoulderL[0] = 0.05;
        T.shoulderR[0] = 0.05;
        T.elbowL[0] = -0.28;
        T.elbowR[0] = -0.28;
        T.spine[2] = 0.02;
        break;
      }
      case 'chat': {
        const g = Math.sin(tp * 2.6);
        T.shoulderR[0] = -0.42 + g * 0.2;
        T.shoulderR[2] = -0.32 - g * 0.1;
        T.elbowR[0] = -0.95 + g * 0.25;
        T.shoulderL[0] = -0.1;
        T.shoulderL[2] = 0.24;
        T.elbowL[0] = -0.45;
        T.head[0] = Math.sin(tp * 1.7) * 0.05;
        T.head[1] = Math.sin(tp * 0.9) * 0.1;
        T.head[2] = Math.sin(tp * 1.2) * 0.05;
        T.spine[2] = Math.sin(tp * 1.4) * 0.02;
        this.talking = true;
        break;
      }
      case 'hug': {
        T.shoulderL[0] = -1.35;
        T.shoulderR[0] = -1.35;
        T.shoulderL[2] = 0.55;
        T.shoulderR[2] = -0.55;
        T.elbowL[0] = -1.0;
        T.elbowR[0] = -1.0;
        T.spine[0] += 0.08;
        T.head[2] = 0.12;
        break;
      }
      case 'kiss': {
        T.spine[0] += 0.12;
        T.head[0] += 0.03;
        T.head[2] = 0.1;
        T.shoulderL[0] = -0.7;
        T.shoulderR[0] = -0.7;
        T.shoulderL[2] = 0.28;
        T.shoulderR[2] = -0.28;
        T.elbowL[0] = -0.9;
        T.elbowR[0] = -0.9;
        break;
      }
      case 'hands': {
        T.shoulderR[0] = -0.55;
        T.shoulderR[2] = -0.18;
        T.elbowR[0] = -0.35;
        T.shoulderL[0] = 0.05;
        T.head[2] = -0.06;
        break;
      }
      default:
        break;
    }

    // özel: kedi sevme sırasında çömelme
    const crouchTarget = act === 'pet' ? 0.13 : 0;
    this._crouch = damp(this._crouch || 0, crouchTarget, 6, dt);

    // --- poz grubu dönüşümleri
    const standHip = 0.86;
    const sitOffset = -(standHip - (st.seatY + 0.09)) * sit;
    const targetPoseY = lerp(sitOffset, st.lieY, lie) - this._crouch;
    this.pose.position.y = damp(this.pose.position.y, targetPoseY, 10, dt);
    this.pose.rotation.x = damp(this.pose.rotation.x, -HALF_PI * lie, 7, dt);
    this.pose.rotation.z = damp(this.pose.rotation.z, (1 - lie) * 0 + 0, 7, dt);

    // --- eklem yumuşatma
    for (const name of Object.keys(T)) {
      const j = this.joints[name];
      if (!j) continue;
      const [x, y, z] = T[name];
      j.rotation.x = damp(j.rotation.x, x, 13, dt);
      j.rotation.y = damp(j.rotation.y, y, 13, dt);
      j.rotation.z = damp(j.rotation.z, z, 13, dt);
    }

    // --- ifade
    const mood = st.mood ?? 80;
    const happy = THREE.MathUtils.clamp((mood - 35) / 50, 0, 1);
    this.smile.visible = happy > 0.35;
    this.frown.visible = !this.smile.visible;
    const smileScale = 0.85 + happy * 0.35 + (st.act === 'sleep' ? -0.1 : 0);
    this.smile.scale.set(smileScale, 0.7 + happy * 0.45, 1);
    this.frown.scale.set(1, 0.55 + (1 - happy) * 0.5, 1);
    if (this.talking) {
      this.mouthPhase += dt * 9;
      const open = Math.abs(Math.sin(this.mouthPhase)) * 0.5 + 0.55;
      this.smile.scale.y = open;
    }
    for (const b of this.brows) {
      const angle = -0.5 + happy * 0.5;
      b.mesh.rotation.z = b.side * (0.06 + (1 - happy) * 0.16) * (b.side > 0 ? -1 : 1);
      b.mesh.position.y = 0.088 + (1 - happy) * 0.008 + Math.sin(this.time * 1.4 + b.side) * 0.002;
      b.mesh.rotation.x = angle * 0.02;
    }

    // --- göz kırpma
    this.blinkIn -= dt;
    const sleeping = st.act === 'sleep' || lie > 0.7;
    if (this.blinkIn <= 0 && !sleeping) {
      this.blinkIn = 1.8 + Math.random() * 3.6;
      this.blink = 0.16;
    }
    if (this.blink > 0) this.blink -= dt;
    const blinkScale = sleeping ? 0.06 : this.blink > 0 ? 0.06 : 1;
    for (const e of this.eyes) {
      e.scale.y = damp(e.scale.y, blinkScale, 30, dt);
    }
    this.headLook = { lookYaw, lookPitch };
  }

  /** Konuşma balonu için baş üstü noktası */
  getHeadWorld(target = new THREE.Vector3()) {
    return this.joints.head.getWorldPosition(target).add(new THREE.Vector3(0, 0.34, 0));
  }
}

// ---------------------------------------------------------------------------
// Pamuk — evin kedisi
// ---------------------------------------------------------------------------
export class Cat {
  constructor() {
    const fur = std('#efe3d2', { roughness: 0.98 });
    const dark = std('#d8bfa4', { roughness: 0.98 });
    const pink = std('#e6a3a1', { roughness: 0.6 });
    const eye = std('#5f7f4a', { roughness: 0.3 });

    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), fur));
    torso.scale.set(1, 0.85, 1.45);
    torso.position.y = 0.17;
    this.body.add(torso);

    const chest = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), fur));
    chest.scale.set(1, 0.95, 1);
    chest.position.set(0, 0.19, 0.16);
    this.body.add(chest);

    const head = new THREE.Group();
    head.position.set(0, 0.29, 0.24);
    this.body.add(head);
    this.head = head;
    const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), fur));
    skull.scale.set(1.05, 0.95, 1);
    head.add(skull);
    const muzzle = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), dark));
    muzzle.scale.set(1.2, 0.8, 0.8);
    muzzle.position.set(0, -0.03, 0.09);
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), pink);
    nose.position.set(0, -0.015, 0.13);
    head.add(nose);
    for (const side of [-1, 1]) {
      const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.085, 4), fur));
      ear.position.set(side * 0.062, 0.1, -0.005);
      ear.rotation.z = side * -0.22;
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.055, 4), pink);
      inner.position.set(side * 0.062, 0.098, 0.012);
      inner.rotation.z = side * -0.22;
      head.add(inner);
      const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 10), eye);
      eyeMesh.scale.set(1, 1.1, 0.5);
      eyeMesh.position.set(side * 0.045, 0.02, 0.082);
      head.add(eyeMesh);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), std('#241a16', { roughness: 0.2 }));
      pupil.scale.set(0.5, 1.2, 0.5);
      pupil.position.set(side * 0.045, 0.02, 0.094);
      head.add(pupil);
    }
    // bıyıklar
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.13, 4), std('#f4ede2'));
        whisker.position.set(side * 0.07, -0.02 + i * 0.016, 0.1);
        whisker.rotation.z = HALF_PI;
        whisker.rotation.y = side * (0.3 + i * 0.15);
        head.add(whisker);
      }
    }

    // bacaklar
    for (const [x, z] of [[-0.08, 0.14], [0.08, 0.14], [-0.08, -0.12], [0.08, -0.12]]) {
      const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.13, 8), fur));
      leg.position.set(x, 0.065, z);
      this.body.add(leg);
      const paw = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), fur));
      paw.scale.set(1, 0.6, 1.2);
      paw.position.set(x, 0.02, z + 0.01);
      this.body.add(paw);
    }

    // kuyruk
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.19, -0.2);
    this.body.add(this.tail);
    this.tailSegs = [];
    let parent = this.tail;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Object3D();
      seg.position.y = i === 0 ? 0 : 0.075;
      parent.add(seg);
      const mesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.055, 4, 8), i === 3 ? dark : fur));
      mesh.position.y = 0.04;
      seg.add(mesh);
      this.tailSegs.push(seg);
      parent = seg;
    }

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.t = Math.random() * 10;
  }

  update(dt) {
    this.t += dt;
    this.head.rotation.y = Math.sin(this.t * 0.7) * 0.3;
    this.head.rotation.x = Math.sin(this.t * 0.9) * 0.08;
    let i = 0;
    for (const seg of this.tailSegs) {
      seg.rotation.x = -0.35 + Math.sin(this.t * 1.6 - i * 0.5) * 0.22;
      seg.rotation.z = Math.sin(this.t * 0.9 - i * 0.4) * 0.16;
      i++;
    }
    this.body.position.y = Math.sin(this.t * 2.2) * 0.006;
  }
}
