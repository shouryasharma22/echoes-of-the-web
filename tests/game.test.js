import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, firstSolidHit } from '../src/physics.js';
import { createPlayer, updatePlayer } from '../src/player.js';
import { createWorld, getSolids, updateCrates } from '../src/world.js';
import { createTether, fireTether, releaseTether, updateTether } from '../src/tether.js';
import { updateQuests } from '../src/quests.js';
import { defaultSave, loadSave, writeSave } from '../src/save.js';

function feedback() {
  return { complete() {}, collect() {}, toast() {}, unlocked() {}, ending() {} };
}

test('world retains three distinguishable zone surfaces and connected geometry', () => {
  const world = createWorld(defaultSave());
  const kinds = new Set(world.platforms.map((item) => item.kind));
  assert.deepEqual([...kinds].sort(), ['dock', 'foundry', 'ice']);
  assert.ok(world.platforms.some((item) => item.x < 1690 && item.x + item.w >= 1260));
  assert.ok(world.platforms.some((item) => item.x < 2820 && item.x + item.w >= 2820));
});

test('axis collision stops a body at a solid platform', () => {
  const body = { x: 0, y: 70, w: 20, h: 20, vx: 100, vy: 100, grounded: false };
  moveBody(body, 0.2, [{ x: 30, y: 0, w: 20, h: 200 }]);
  assert.equal(body.x, 10);
  assert.equal(body.vx, 0);
});

test('segment raycast detects terrain between the player and target', () => {
  assert.equal(firstSolidHit({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 40, y: -5, w: 10, h: 10 }]), 0.4);
});

test('spawned player can jump immediately and has exactly one jump', () => {
  const player = createPlayer();
  const input = { jumpPressed: true, jumpReleased: false, left: false, right: false };
  updatePlayer(player, input, 1 / 120, { surfaceAt: () => null });
  assert.equal(player.vy, -820);
  player.grounded = false;
  player.coyote = 0;
  input.jumpPressed = true;
  updatePlayer(player, input, 1 / 120, { surfaceAt: () => null });
  assert.ok(player.vy > -820, 'midair press must not retrigger the jump impulse');
});

test('tether retargets midair without changing momentum and respects release cooldown', () => {
  const world = createWorld(defaultSave());
  const player = { x: 500, y: 600, w: 32, h: 58, vx: 355, vy: -280 };
  const tether = createTether();
  Object.assign(tether, { state: 'ATTACHED', attached: true, target: { x: 300, y: 580 }, kind: 'anchor', restLength: 200 });
  assert.equal(fireTether(tether, player, world, { x: 640, y: 470 }, 1, () => {}), true);
  assert.deepEqual(tether.target, { x: 640, y: 470 });
  assert.deepEqual([player.vx, player.vy], [355, -280]);
  releaseTether(tether, 1.01);
  assert.equal(fireTether(tether, player, world, { x: 640, y: 470 }, 1.1, () => {}), false);
});

test('tether refuses targets behind static terrain', () => {
  const world = createWorld(defaultSave());
  world.staticBlocks.push({ x: 175, y: 740, w: 100, h: 24 });
  const tether = createTether();
  assert.equal(fireTether(tether, { x: 110, y: 980, w: 32, h: 58 }, world, { x: 300, y: 580 }, 1, () => {}), false);
  assert.equal(tether.ray.blocked, true);
});

test('static wooden blocks collide but are not simulated as movable crates', () => {
  const world = createWorld(defaultSave());
  assert.equal(world.crates.length, 1);
  assert.equal(world.crates[0].movable, true);
  assert.ok(getSolids(world).includes(world.staticBlocks[0]));
  const fixedX = world.staticBlocks[0].x;
  updateCrates(world, { x: 1000, y: 980, w: 32, h: 58, vx: 0, vy: 0 }, 1 / 120);
  assert.equal(world.staticBlocks[0].x, fixedX);
});

test('bridge, ice, and gate quests can each complete independently', () => {
  const cases = [
    ['bridge', { x: 1760, y: 1010, w: 32, h: 58, vx: 0, vy: 0 }, () => {}],
    ['ice', { x: 2720, y: 1010, w: 32, h: 58, vx: 300, vy: 0 }, () => {}],
    ['gate', { x: 0, y: 0, w: 32, h: 58, vx: 0, vy: 0 }, (world) => { world.platePressed = true; }],
  ];
  for (const [questId, player, setup] of cases) {
    const save = defaultSave();
    const world = createWorld(save);
    setup(world);
    updateQuests(world, player, save, feedback());
    assert.equal(save.quests[questId], true, `${questId} should not depend on other quests`);
  }
});

test('final unlock callback runs after the flag is set so it can be saved', () => {
  const save = defaultSave();
  save.quests = { bridge: true, ice: true, gate: true };
  const world = createWorld(save);
  let unlockedSnapshot = false;
  const hooks = feedback();
  hooks.unlocked = () => { unlockedSnapshot = save.finalUnlocked; };
  updateQuests(world, { x: 0, y: 0, w: 32, h: 58, vx: 0, vy: 0 }, save, hooks);
  assert.equal(unlockedSnapshot, true);
});

test('collectibles persist through validated local save data', () => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    value: null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
    removeItem() { this.value = null; },
  };
  try {
    const save = defaultSave();
    const world = createWorld(save);
    const player = { x: 458, y: 685, w: 34, h: 58, vx: 0, vy: 0 };
    updateQuests(world, player, save, feedback());
    assert.ok(save.fragments.includes(0));
    writeSave(save);
    assert.ok(loadSave().fragments.includes(0));
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});