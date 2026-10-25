// ---------------------------------------------------------------------------
// Basit ızgara tabanlı A* yol bulma
// ---------------------------------------------------------------------------

class MinHeap {
  constructor() {
    this.items = [];
  }
  push(node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

export class NavGrid {
  constructor(minX, maxX, minZ, maxZ, cell = 0.25) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  idx(cx, cz) {
    return cz * this.cols + cx;
  }

  toCell(x, z) {
    return {
      cx: Math.floor((x - this.minX) / this.cell),
      cz: Math.floor((z - this.minZ) / this.cell),
    };
  }

  toWorld(cx, cz) {
    return {
      x: this.minX + (cx + 0.5) * this.cell,
      z: this.minZ + (cz + 0.5) * this.cell,
    };
  }

  inBounds(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  blockRect(x1, z1, x2, z2, expand = 0) {
    const a = this.toCell(Math.min(x1, x2) - expand, Math.min(z1, z2) - expand);
    const b = this.toCell(Math.max(x1, x2) + expand, Math.max(z1, z2) + expand);
    for (let cz = Math.max(0, a.cz); cz <= Math.min(this.rows - 1, b.cz); cz++) {
      for (let cx = Math.max(0, a.cx); cx <= Math.min(this.cols - 1, b.cx); cx++) {
        this.blocked[this.idx(cx, cz)] = 1;
      }
    }
  }

  isBlockedWorld(x, z) {
    const { cx, cz } = this.toCell(x, z);
    if (!this.inBounds(cx, cz)) return true;
    return this.blocked[this.idx(cx, cz)] === 1;
  }

  /** Verilen dünya noktasına en yakın yürünebilir hücre merkezi */
  nearestFree(x, z, radius = 6) {
    const start = this.toCell(x, z);
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r <= radius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = start.cx + dx;
          const cz = start.cz + dz;
          if (!this.inBounds(cx, cz)) continue;
          if (this.blocked[this.idx(cx, cz)]) continue;
          const p = this.toWorld(cx, cz);
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best) return best;
    }
    return { x, z };
  }

  findPath(sx, sz, tx, tz) {
    const start = this.nearestFree(sx, sz);
    const goal = this.nearestFree(tx, tz);
    const s = this.toCell(start.x, start.z);
    const g = this.toCell(goal.x, goal.z);
    if (!this.inBounds(s.cx, s.cz) || !this.inBounds(g.cx, g.cz)) return null;
    if (s.cx === g.cx && s.cz === g.cz) return [{ x: goal.x, z: goal.z }];

    const size = this.cols * this.rows;
    const gScore = new Float32Array(size).fill(Infinity);
    const came = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const startIdx = this.idx(s.cx, s.cz);
    const goalIdx = this.idx(g.cx, g.cz);
    const h = (cx, cz) => {
      const dx = Math.abs(cx - g.cx);
      const dz = Math.abs(cz - g.cz);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };

    const open = new MinHeap();
    gScore[startIdx] = 0;
    open.push({ cx: s.cx, cz: s.cz, f: h(s.cx, s.cz) });

    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];

    let found = false;
    let guard = 0;
    while (open.size && guard++ < 20000) {
      const cur = open.pop();
      const ci = this.idx(cur.cx, cur.cz);
      if (closed[ci]) continue;
      closed[ci] = 1;
      if (ci === goalIdx) {
        found = true;
        break;
      }
      for (const [dx, dz, cost] of dirs) {
        const nx = cur.cx + dx;
        const nz = cur.cz + dz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (this.blocked[ni] || closed[ni]) continue;
        // çaprazda köşe kesmeyi engelle
        if (dx !== 0 && dz !== 0) {
          if (this.blocked[this.idx(cur.cx + dx, cur.cz)] || this.blocked[this.idx(cur.cx, cur.cz + dz)]) continue;
        }
        const tentative = gScore[ci] + cost;
        if (tentative < gScore[ni]) {
          gScore[ni] = tentative;
          came[ni] = ci;
          open.push({ cx: nx, cz: nz, f: tentative + h(nx, nz) });
        }
      }
    }

    if (!found) return null;
    const cells = [];
    let cur = goalIdx;
    let safety = 0;
    while (cur !== -1 && safety++ < 5000) {
      cells.push(cur);
      if (cur === startIdx) break;
      cur = came[cur];
    }
    cells.reverse();
    // ara noktaları seyrelt (düz çizgiler)
    const points = cells.map((i) => {
      const cx = i % this.cols;
      const cz = Math.floor(i / this.cols);
      return this.toWorld(cx, cz);
    });
    if (points.length) points[points.length - 1] = { x: goal.x, z: goal.z };
    const simplified = [];
    let i = 0;
    while (i < points.length) {
      simplified.push(points[i]);
      let j = points.length - 1;
      for (; j > i + 1; j--) {
        if (this.lineClear(points[i].x, points[i].z, points[j].x, points[j].z)) break;
      }
      i = Math.max(j, i + 1);
    }
    return simplified;
  }

  lineClear(x1, z1, x2, z2) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(2, Math.ceil(dist / (this.cell * 0.6)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.isBlockedWorld(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  }
}
