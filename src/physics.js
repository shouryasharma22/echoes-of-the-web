export const FIXED_STEP = 1 / 120;
export const GRAVITY = 1900;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function resolveAxis(body, amount, axis, solids) {
  if (!amount) return false;
  body[axis] += amount;
  let collided = false;
  for (const solid of solids) {
    if (!overlaps(body, solid)) continue;
    collided = true;
    if (axis === 'x') {
      body.x = amount > 0 ? solid.x - body.w : solid.x + solid.w;
      body.vx = 0;
    } else {
      body.y = amount > 0 ? solid.y - body.h : solid.y + solid.h;
      body.vy = 0;
      if (amount > 0) body.grounded = true;
    }
  }
  return collided;
}

export function moveBody(body, dt, solids) {
  body.grounded = false;
  resolveAxis(body, body.vx * dt, 'x', solids);
  resolveAxis(body, body.vy * dt, 'y', solids);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

// Liang–Barsky segment vs rectangle. Returns entry fraction t (0..1) or null.
export function segmentRectHit(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.h - a.y]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0;
}

export function firstSolidHit(a, b, solids) {
  let best = null;
  for (const s of solids) {
    const t = segmentRectHit(a, b, s);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}