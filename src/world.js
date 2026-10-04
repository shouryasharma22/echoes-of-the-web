import { GRAVITY, moveBody, overlaps } from './physics.js';

export const WORLD_WIDTH = 4800;
export const WORLD_HEIGHT = 1200;

const platform = (x, y, w, h, kind = 'stone') => ({ x, y, w, h, kind });

export function createWorld(save) {
  return {
    platforms: [
      platform(0, 1080, 1260, 120, 'dock'), platform(1690, 1080, 1180, 120, 'ice'), platform(2820, 1080, 1980, 120, 'foundry'),
      platform(230, 910, 220, 26, 'dock'), platform(560, 805, 190, 24, 'dock'), platform(875, 910, 245, 28, 'dock'),
      platform(1260, 700, 160, 24, 'dock'), platform(1510, 850, 180, 26, 'dock'),
      platform(1800, 900, 250, 25, 'ice'), platform(2110, 810, 200, 24, 'ice'), platform(2415, 925, 300, 24, 'ice'),
      platform(2930, 880, 190, 24, 'foundry'), platform(3220, 790, 220, 25, 'foundry'), platform(3540, 905, 220, 26, 'foundry'),
      platform(3920, 810, 230, 26, 'foundry'), platform(4300, 890, 180, 25, 'foundry'), platform(4540, 760, 200, 28, 'foundry'),
    ],
    staticBlocks: [
      { x: 1040, y: 1018, w: 58, h: 62, kind: 'wood' },
      { x: 3100, y: 818, w: 58, h: 62, kind: 'wood' },
    ],
    anchors: [
      { x: 300, y: 580 }, { x: 640, y: 470 }, { x: 1015, y: 555 }, { x: 1330, y: 410 }, { x: 1580, y: 540 },
      { x: 1870, y: 520 }, { x: 2225, y: 420 }, { x: 2530, y: 560 }, { x: 2770, y: 410 }, { x: 3010, y: 520 },
      { x: 3360, y: 440 }, { x: 3680, y: 500 }, { x: 4040, y: 410 }, { x: 4380, y: 490 }, { x: 4650, y: 410 },
    ],
    fragments: [
      { id: 0, x: 475, y: 700 }, { id: 1, x: 1080, y: 475 }, { id: 2, x: 1475, y: 450 },
      { id: 3, x: 2010, y: 590 }, { id: 4, x: 2745, y: 650 }, { id: 5, x: 4140, y: 550 },
    ],
    crates: [
      { id: 'counterweight', movable: true, x: 3610, y: 1018, w: 62, h: 62, vx: 0, vy: 0, mass: 1.2, startX: 3610, startY: 1018 },
    ],
    bridge: save.quests.bridge,
    gateOpen: save.quests.gate,
    quests: save.quests,
    switches: { generator: save.quests.bridge, ice: save.quests.ice },
    playerStarts: [{ x: 110, y: 1022 }, { x: 1830, y: 1022 }, { x: 3420, y: 1022 }],
    checkpoints: [480, 2050, 3290],
    plate: { x: 3760, y: 1038, w: 100, h: 42 },
    gate: { x: 3890, y: 875, w: 36, h: 205 },
    generator: { x: 1765, y: 1000, w: 70, h: 80 },
    iceSwitch: { x: 2740, y: 1004, w: 50, h: 76 },
    core: { x: 4610, y: 682, w: 64, h: 78 },
    decorations: [
      { type: 'lighthouse', x: 75, y: 710 }, { type: 'clock', x: 2180, y: 520 }, { type: 'chimney', x: 4260, y: 555 },
    ],
    camera: { x: 0, y: 0 },
  };
}

export function getSolids(world) {
  const solids = [...world.platforms, ...world.staticBlocks];
  if (world.bridge) solids.push(platform(1260, 1030, 430, 50, 'bridge'));
  if (!world.gateOpen) solids.push(world.gate);
  solids.push(platform(-90, 0, 90, WORLD_HEIGHT, 'wall'), platform(WORLD_WIDTH, 0, 90, WORLD_HEIGHT, 'wall'), platform(0, -180, WORLD_WIDTH, 180, 'wall'));
  return solids;
}

export function surfaceAt(world, x, y) {
  return world.platforms.find((item) => x >= item.x && x <= item.x + item.w && y >= item.y - 1 && y <= item.y + 8) || null;
}

export function updateCrates(world, player, dt) {
  const solids = getSolids(world);
  for (const crate of world.crates) {
    if (!crate.movable) continue;
    crate.grounded = false;
    crate.vy = Math.min(1100, crate.vy + GRAVITY * dt);
    crate.vx *= Math.exp(-2.2 * dt);
    moveBody(crate, dt, solids);
    if (overlaps(crate, player)) {
      const wasPlayerLeft = player.x + player.w / 2 < crate.x + crate.w / 2;
      if (player.vy > 0 && player.y + player.h - 8 < crate.y + 12) {
        player.y = crate.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else {
        const push = wasPlayerLeft ? player.x + player.w - crate.x : player.x - (crate.x + crate.w);
        if (Math.abs(player.vx) > 0) {
          crate.vx += player.vx / crate.mass * 0.7;
          player.x -= push;
        }
      }
    }
    crate.vx = Math.max(-370, Math.min(370, crate.vx));
    if (crate.y > WORLD_HEIGHT + 120) {
      Object.assign(crate, { x: crate.startX, y: crate.startY, vx: 0, vy: 0 });
    }
  }
  const counterweight = world.crates.find((crate) => crate.id === 'counterweight');
  world.platePressed = Boolean(counterweight && overlaps(counterweight, world.plate));
  if (world.platePressed) world.gateOpen = true;
  else if (!world.quests.gate) world.gateOpen = false;
}

export function updateCamera(world, player, width, height, dt, snap = false) {
  const targetX = Math.max(0, Math.min(WORLD_WIDTH - width, player.x + player.w / 2 - width * 0.48));
  const targetY = Math.max(0, Math.min(WORLD_HEIGHT - height, player.y + player.h / 2 - height * 0.56));
  const blend = snap ? 1 : 1 - Math.exp(-5.5 * dt);
  world.camera.x += (targetX - world.camera.x) * blend;
  world.camera.y += (targetY - world.camera.y) * blend;
}