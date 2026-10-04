import { distance, firstSolidHit } from './physics.js';
import { getSolids } from './world.js';

export const TETHER_RANGE = 820;
export const TETHER_COOLDOWN = 0.15;
const MAX_SPRING_FORCE = 6000;

export function createTether() {
  return { state: 'IDLE', attached: false, target: null, kind: '', restLength: 0, failedAt: 0, releasedAt: -Infinity, ray: null };
}

export function releaseTether(tether, now) {
  if (tether.state !== 'ATTACHED') return false;
  tether.state = 'RELEASED';
  tether.attached = false;
  tether.target = null;
  tether.kind = '';
  tether.releasedAt = now;
  return true;
}

export function fireTether(tether, player, world, targetPoint, now, sound) {
  const replacing = tether.state === 'ATTACHED';
  if (!replacing && now - tether.releasedAt < TETHER_COOLDOWN) return false;
  const origin = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
  const solids = getSolids(world);
  let candidate = null, kind = 'anchor', best = 38;

  const consider = (point, extra, candidateKind) => {
    const d = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);
    if (d >= best || distance(point, origin) > TETHER_RANGE) return;
    const t = firstSolidHit(origin, point, solids);
    if (t !== null && t < 0.999) return;
    candidate = { x: point.x, y: point.y, ...extra };
    kind = candidateKind;
    best = d;
  };
  for (const anchor of world.anchors) consider(anchor, {}, 'anchor');
  for (const crate of world.crates) {
    if (!crate.movable) continue;
    consider({ x: crate.x + crate.w / 2, y: crate.y + crate.h / 2 }, { crateId: crate.id }, 'crate');
  }

  if (!candidate) {
    const t = firstSolidHit(origin, targetPoint, solids);
    const end = t === null ? targetPoint : { x: origin.x + (targetPoint.x - origin.x) * t, y: origin.y + (targetPoint.y - origin.y) * t };
    if (replacing) releaseTether(tether, now);
    tether.state = 'IDLE';
    tether.attached = false;
    tether.target = null;
    tether.ray = { from: origin, to: targetPoint, hit: t === null ? null : end, blocked: t !== null };
    tether.fizzleEnd = end;
    tether.failedAt = now;
    sound?.('fizzle');
    return false;
  }
  tether.ray = { from: origin, to: candidate, hit: null, blocked: false };
  tether.fizzleEnd = null;
  tether.state = 'ATTACHED';
  tether.attached = true;
  tether.target = candidate;
  tether.kind = kind;
  tether.restLength = Math.max(85, distance(candidate, origin));
  tether.attachedAt = now;
  sound?.('attach');
  return true;
}

export function updateTether(tether, player, world, input, dt, now) {
  if (tether.state !== 'ATTACHED' || !tether.target) return;
  if (input.ropeIn) tether.restLength = Math.max(75, tether.restLength - 260 * dt);
  if (input.ropeOut) tether.restLength = Math.min(780, tether.restLength + 260 * dt);
  if (tether.kind === 'crate') {
    const crate = world.crates.find((item) => item.id === tether.target.crateId);
    if (!crate?.movable) { releaseTether(tether, now); return; }
    tether.target.x = crate.x + crate.w / 2;
    tether.target.y = crate.y + crate.h / 2;
  }
  const playerPoint = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
  const blocked = firstSolidHit(playerPoint, tether.target, getSolids(world));
  if (blocked !== null && blocked < 0.999) {
    releaseTether(tether, now);
    return;
  }
  const dx = tether.target.x - playerPoint.x;
  const dy = tether.target.y - playerPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const extension = Math.max(0, length - tether.restLength);
  if (extension <= 0) return;
  const outwardVelocity = -(player.vx * nx + player.vy * ny);
  const force = Math.max(0, Math.min(MAX_SPRING_FORCE, extension * 34 + outwardVelocity * 6));
  player.vx += nx * force * dt;
  player.vy += ny * force * dt;
  if (tether.kind === 'crate') {
    const crate = world.crates.find((item) => item.id === tether.target.crateId);
    if (crate?.movable) {
      crate.vx -= nx * force * dt / crate.mass;
      crate.vy -= ny * force * dt / crate.mass;
    }
  }
}