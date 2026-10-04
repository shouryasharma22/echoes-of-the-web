import { FIXED_STEP, moveBody, distance } from './physics.js';
import { createPlayer, updatePlayer } from './player.js';
import { createWorld, getSolids, surfaceAt, updateCamera, updateCrates, WORLD_HEIGHT, WORLD_WIDTH } from './world.js';
import { createTether, fireTether, releaseTether, updateTether } from './tether.js';
import { objectiveFor, updateQuests } from './quests.js';
import { clearSave, defaultSave, loadSave, writeSave } from './save.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const ui = createUI();
const canvas = ui.elements.canvas;
const ctx = canvas.getContext('2d');
let save = loadSave();
let world = createWorld(save);
let player = createPlayer(save.checkpoint);
let tether = createTether();
const audio = createAudio(save.settings);
const input = { left: false, right: false, jumpPressed: false, jumpReleased: false, ropeIn: false, ropeOut: false, aim: { x: 1, y: 0 }, pointer: { x: 0, y: 0 }, pointerActive: false, pointerHeld: false, webPressedThisFrame: false, webReleasePressed: false, sound: (name) => audio.play(name) };
let width = 960, height = 640, dpr = 1, accumulator = 0, previous = 0, simulationTime = 0, active = save.started, paused = false, debug = false, shake = 0;
let particles = [];

function persist() { writeSave(save); }
function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  width = rect.width; height = rect.height;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  updateCamera(world, player, width, height, 1, true);
}
window.addEventListener('resize', resize);
resize();

function startGame() {
  active = true;
  save.started = true;
  ui.elements.dialogue.hidden = true;
  persist();
  canvas.focus();
}
if (active) ui.elements.dialogue.hidden = true;
document.querySelector('#begin-button').addEventListener('click', startGame);
document.querySelector('#menu-button').addEventListener('click', openMenu);
document.querySelector('#close-panel').addEventListener('click', () => { paused = false; ui.closePanel(); });
document.querySelector('#ending-menu').addEventListener('click', () => { ui.elements.ending.hidden = true; paused = false; });

function openMenu() {
  paused = true;
  ui.menu(save, {
    close: () => { paused = false; ui.closePanel(); },
    setting: (key, value) => { save.settings[key] = value; persist(); ui.update(save, objectiveFor(world, save, player), zoneAt(player.x)); },
    reset: () => {
      clearSave(); save = defaultSave(); world = createWorld(save); player = createPlayer(); tether = createTether(); particles = [];
      active = false; paused = false; ui.elements.ending.hidden = true; ui.closePanel(); ui.elements.dialogue.hidden = false; resize(); persist();
    },
  });
}
function openJournal() { paused = true; ui.journal(save); }

function zoneAt(x) { return x < 1690 ? 'NEON DOCKS' : x < 2820 ? 'FROZEN ROOFTOPS' : 'FOUNDRY HEIGHTS'; }
function pointerWorld() { return { x: input.pointer.x + world.camera.x, y: input.pointer.y + world.camera.y }; }
function aimTarget() {
  if (input.pointerActive) return pointerWorld();
  const center = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
  return { x: center.x + input.aim.x * 620, y: center.y + input.aim.y * 620 };
}
function setAimFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  input.pointer.x = event.clientX - rect.left;
  input.pointer.y = event.clientY - rect.top;
  input.pointerActive = true;
}
canvas.addEventListener('pointermove', setAimFromPointer);
canvas.addEventListener('pointerdown', (event) => {
  if (!active || paused || event.button !== 0 || !event.isPrimary || input.pointerHeld) return;
  input.pointerHeld = true;
  setAimFromPointer(event);
  input.webPressedThisFrame = true;
});
window.addEventListener('pointerup', () => { input.pointerHeld = false; });

const keyMap = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', s: 'ropeOut', control: 'ropeOut', w: 'ropeIn', shift: 'ropeIn' };
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (key === 'escape') { if (paused) { paused = false; ui.closePanel(); } else if (active) openMenu(); return; }
  if (key === 'j' && active) { paused ? (paused = false, ui.closePanel()) : openJournal(); return; }
  if (key === 'f1') { debug = !debug; return; }
  if (key === 'r' && active) { respawn(); return; }
  if (key === 'e' && active && !paused && !event.repeat) {
    input.webPressedThisFrame = true;
  }
  if ((key === ' ' || key === 'w' || key === 'arrowup') && !event.repeat) {
  if (tether.state === 'ATTACHED' && key === ' ') input.webReleasePressed = true;
  else if (tether.state !== 'ATTACHED' || key === ' ') {
    input.jumpPressed = true;
  }
}
  if (key in keyMap) input[keyMap[key]] = true;
  if (['i', 'k', 'l'].includes(key)) {
    if (key === 'i') input.aim.y = -1;
    if (key === 'k') input.aim.y = 1;
    if (key === 'l') input.aim.x = 1;
    const length = Math.hypot(input.aim.x, input.aim.y) || 1;
    input.aim.x /= length; input.aim.y /= length;
    input.pointerActive = false;
  }
  if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
    input.aim.x = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : input.aim.x;
    input.aim.y = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : input.aim.y;
    const length = Math.hypot(input.aim.x, input.aim.y) || 1;
    input.aim.x /= length; input.aim.y /= length;
    input.pointerActive = false;
  }
});
window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key in keyMap) input[keyMap[key]] = false;
  if (key === ' ' || key === 'w' || key === 'arrowup') input.jumpReleased = true;
});
window.addEventListener('blur', () => { input.left = input.right = input.ropeIn = input.ropeOut = false; });

function respawn() {
  const start = world.playerStarts[player.checkpoint] || world.playerStarts[0];
  Object.assign(player, { x: start.x, y: start.y, vx: 0, vy: 0, grounded: true, coyote: 0.105, jumpBuffer: 0 });
  input.jumpPressed = false;
  input.jumpReleased = false;
  input.webPressedThisFrame = false;
  input.webReleasePressed = false;
  releaseTether(tether, simulationTime); tether.state = 'IDLE'; tether.attached = false; shake = 0; updateCamera(world, player, width, height, 1, true);
  ui.toast('BACK TO THE LAST CHECKPOINT');
}

function checkpointAndHazards() {
  for (let i = 1; i < world.checkpoints.length; i += 1) {
    if (player.x + player.w / 2 > world.checkpoints[i] && i > player.checkpoint) {
      player.checkpoint = i; save.checkpoint = i; persist(); audio.play('checkpoint'); ui.toast(`${zoneAt(player.x)} CHECKPOINT`);
    }
  }
  if (player.y > WORLD_HEIGHT + 100) respawn();
}

function feedback() {
  return {
    toast: (message) => ui.toast(message),
    complete: (id, message) => { audio.play('quest'); shake = 7; persist(); ui.toast(message); },
    unlocked: () => { persist(); ui.toast('ALL SYSTEMS RESTORED · THE CORE IS AWAKE'); },
    collect: (id) => {
      audio.play('pickup'); shake = 4;
      const item = world.fragments.find((fragment) => fragment.id === id);
      if (!save.settings.reducedMotion) {
        for (let i = 0; i < 14; i += 1) particles.push({ x: item.x, y: item.y, vx: (Math.random() - .5) * 190, vy: (Math.random() - .6) * 180, life: .7, color: '#f4d36d' });
      }
      persist(); ui.toast(`AETHER FRAGMENT ${save.fragments.length}/6`);
    },
    ending: () => { paused = true; ui.showEnding(); audio.play('quest'); },
  };
}

function fixedUpdate(dt) {
  if (!active || paused) return;
  simulationTime += dt;
  if (input.webReleasePressed) releaseTether(tether, simulationTime);
  input.webReleasePressed = false;
  if (input.webPressedThisFrame) {
    fireTether(tether, player, world, aimTarget(), simulationTime, audio.play);
  }
  input.webPressedThisFrame = false;
  updatePlayer(player, input, dt, { surfaceAt: (x, y) => surfaceAt(world, x, y) });
  updateTether(tether, player, world, input, dt, simulationTime);
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > 1800) { player.vx *= 1800 / speed; player.vy *= 1800 / speed; }
  updateCrates(world, player, dt);
  const solids = getSolids(world);
  moveBody(player, dt, solids);
  const resolvedSpeed = Math.hypot(player.vx, player.vy);
  if (resolvedSpeed > 1800) { player.vx *= 1800 / resolvedSpeed; player.vy *= 1800 / resolvedSpeed; }
  const under = surfaceAt(world, player.x + player.w / 2, player.y + player.h + 3);
  if (under?.kind === 'ice' && player.grounded) player.vx *= Math.exp(-.16 * dt);
  checkpointAndHazards();
  updateQuests(world, player, save, feedback());
  updateCamera(world, player, width, height, dt);
  if (save.settings.reducedMotion) particles = [];
  else {
    for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 350 * dt; particle.life -= dt; }
    particles = particles.filter((particle) => particle.life > 0);
  }
  shake *= Math.exp(-12 * dt);
  ui.update(save, objectiveFor(world, save, player), zoneAt(player.x));
}

function drawBackground() {
  const x = world.camera.x;
  const zones = [
    { x: 0, w: 1690, top: '#0b3036', bottom: '#10252c', accent: '#27727a' },
    { x: 1690, w: 1130, top: '#203d50', bottom: '#142c39', accent: '#8ac8dc' },
    { x: 2820, w: 1980, top: '#492d27', bottom: '#201f27', accent: '#f08b56' },
  ];
  for (const zone of zones) {
    const left = zone.x - x;
    if (left > width || left + zone.w < 0) continue;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, zone.top); gradient.addColorStop(1, zone.bottom);
    ctx.fillStyle = gradient; ctx.fillRect(left, 0, zone.w, height);
    ctx.fillStyle = `${zone.accent}12`;
    for (let i = 0; i < 15; i += 1) {
      const buildingX = left + i * 150 + ((i * 67) % 80);
      const buildingH = 110 + ((i * 97) % 200);
      ctx.fillRect(buildingX, height * .6 - buildingH, 74 + (i % 3) * 20, buildingH);
      ctx.fillStyle = `${zone.accent}48`;
      for (let wy = 0; wy < buildingH - 24; wy += 28) ctx.fillRect(buildingX + 12, height * .6 - buildingH + 13 + wy, 4, 9);
      ctx.fillStyle = `${zone.accent}12`;
    }
  }
}

function drawLandmarks() {
  for (const landmark of world.decorations) {
    const sx = landmark.x - world.camera.x;
    const sy = landmark.y - world.camera.y;
    ctx.save(); ctx.translate(sx, sy);
    if (landmark.type === 'lighthouse') {
      ctx.fillStyle = '#193b42'; ctx.fillRect(0, 0, 58, 300); ctx.fillStyle = '#8df3c3'; ctx.fillRect(-4, -14, 66, 22);
      ctx.fillStyle = '#f4d36d'; ctx.globalAlpha = .12; ctx.beginPath(); ctx.moveTo(28, -4); ctx.lineTo(240, -95); ctx.lineTo(240, 90); ctx.closePath(); ctx.fill();
    } else if (landmark.type === 'clock') {
      ctx.fillStyle = '#304d5b'; ctx.fillRect(0, 0, 90, 310); ctx.beginPath(); ctx.arc(45, 65, 31, 0, Math.PI * 2); ctx.fillStyle = '#b8e5e5'; ctx.fill();
      ctx.strokeStyle = '#304d5b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(45, 65); ctx.lineTo(45, 43); ctx.moveTo(45, 65); ctx.lineTo(62, 72); ctx.stroke();
    } else {
      ctx.fillStyle = '#432a2a'; ctx.fillRect(0, 35, 75, 290); ctx.fillStyle = '#e96544'; ctx.fillRect(17, 0, 42, 38); ctx.fillStyle = '#ff9b52'; ctx.globalAlpha = .45; ctx.fillRect(20, 155, 35, 75);
    }
    ctx.restore();
  }
}

function drawWorld(now) {
  ctx.save();
  if (!save.settings.reducedMotion && shake > .5) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawBackground(); drawLandmarks();
  ctx.save(); ctx.translate(-world.camera.x, -world.camera.y);
  for (const item of [...world.platforms, ...world.staticBlocks]) {
    if (item.kind === 'wood') {
      ctx.fillStyle = '#865536'; ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.fillStyle = '#b47a48'; ctx.fillRect(item.x + 5, item.y + 5, item.w - 10, 7);
      ctx.fillStyle = '#533a2c'; ctx.fillRect(item.x + 8, item.y + 19, item.w - 16, 3);
      ctx.fillRect(item.x + 8, item.y + 40, item.w - 16, 3);
      ctx.strokeStyle = '#d0a16b'; ctx.lineWidth = 2; ctx.strokeRect(item.x + 2, item.y + 2, item.w - 4, item.h - 4);
      continue;
    }
    const contrast = save.settings.highContrast;
    const color = contrast ? '#ffffff' : item.kind === 'ice' ? '#7eb9cf' : item.kind === 'foundry' ? '#b85f3f' : item.kind === 'dock' ? '#2e7b77' : '#64787b';
    ctx.fillStyle = color; ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = save.settings.highContrast ? '#07151d' : 'rgba(240,255,250,.22)'; ctx.fillRect(item.x, item.y, item.w, 4);
    ctx.fillStyle = 'rgba(2,13,18,.28)'; ctx.fillRect(item.x, item.y + item.h - 8, item.w, 8);
  }
  if (world.bridge) { ctx.fillStyle = '#8df3c3'; ctx.fillRect(1260, 1030, 430, 50); ctx.fillStyle = '#d9ffed'; for (let x = 1270; x < 1690; x += 38) ctx.fillRect(x, 1030, 23, 5); }
  drawSwitch(world.generator, world.switches.generator, '#8df3c3', 'GEN');
  drawSwitch(world.iceSwitch, world.switches.ice, '#85d8f0', 'ICE');
  ctx.fillStyle = world.gateOpen ? '#477967' : '#d56a49'; ctx.fillRect(world.gate.x, world.gate.y, world.gate.w, world.gate.h);
  ctx.fillStyle = world.platePressed ? '#8df3c3' : '#d5a655'; ctx.fillRect(world.plate.x, world.plate.y, world.plate.w, world.plate.h);
  ctx.fillStyle = save.finalUnlocked ? '#f4d36d' : '#607177'; ctx.fillRect(world.core.x, world.core.y + 38, world.core.w, 40); ctx.beginPath(); ctx.arc(world.core.x + 32, world.core.y + 28, 25, 0, Math.PI * 2); ctx.fill();
  if (save.finalUnlocked) { ctx.globalAlpha = .25 + Math.sin(now * .004) * .1; ctx.fillStyle = '#f4d36d'; ctx.beginPath(); ctx.arc(world.core.x + 32, world.core.y + 28, 53, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  drawAnchors(now);
  for (const fragment of world.fragments) if (!save.fragments.includes(fragment.id)) drawFragment(fragment, now);
  for (const crate of world.crates) drawCrate(crate);
  drawTether(now);
  drawPlayer();
  for (const particle of particles) { ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 5, 5); }
  ctx.globalAlpha = 1;
  if (debug) drawDebug();
  ctx.restore();
  drawAim(now);
  ctx.restore();
}
function drawSwitch(item, on, color, label) {
  ctx.fillStyle = '#14262a'; ctx.fillRect(item.x, item.y, item.w, item.h);
  ctx.fillStyle = on ? color : '#d66c50'; ctx.fillRect(item.x + 10, item.y + 12, item.w - 20, item.h - 24);
  ctx.fillStyle = '#d9ece3'; ctx.font = '10px "DM Mono"'; ctx.fillText(label, item.x + 4, item.y - 8);
}
function drawAnchors(now) {
  const target = aimTarget();
  for (const anchor of world.anchors) {
    const screenX = anchor.x - world.camera.x, screenY = anchor.y - world.camera.y;
    if (screenX < -10 || screenX > width + 10 || screenY < -10 || screenY > height + 10) continue;
    const nearCursor = distance(anchor, target) < 38 && distance(anchor, { x: player.x + 16, y: player.y + 28 }) < 820;
    ctx.globalAlpha = nearCursor ? 1 : .48 + Math.sin(now * .003 + anchor.x) * .1;
    ctx.strokeStyle = save.settings.highContrast ? '#ffffff' : nearCursor ? '#fff2a9' : '#a8f9d7'; ctx.lineWidth = nearCursor ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y, nearCursor ? 9 : 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = nearCursor ? '#fff2a9' : '#8df3c3'; ctx.fillRect(anchor.x - 2, anchor.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}
function drawFragment(fragment, now) {
  const bob = Math.sin(now * .003 + fragment.id) * 6;
  ctx.save(); ctx.translate(fragment.x, fragment.y + bob); ctx.rotate(now * .0007 + fragment.id);
  ctx.shadowColor = '#f4d36d'; ctx.shadowBlur = 18; ctx.fillStyle = '#f4d36d';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 0); ctx.lineTo(0, 14); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawCrate(crate) {
  // Pushable counterweight: metal casing with a yellow-black hazard stripe.
  ctx.fillStyle = '#5b6b70'; ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
  ctx.save(); ctx.beginPath(); ctx.rect(crate.x + 5, crate.y + 5, crate.w - 10, 9); ctx.clip();
  ctx.fillStyle = '#f4d36d'; ctx.fillRect(crate.x + 5, crate.y + 5, crate.w - 10, 9);
  ctx.strokeStyle = '#202b2e'; ctx.lineWidth = 6;
  for (let x = crate.x - 4; x < crate.x + crate.w + 8; x += 14) { ctx.beginPath(); ctx.moveTo(x, crate.y + 16); ctx.lineTo(x + 13, crate.y + 3); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#f4d36d'; ctx.lineWidth = 3; ctx.strokeRect(crate.x + 3, crate.y + 3, crate.w - 6, crate.h - 6);
  ctx.beginPath(); ctx.moveTo(crate.x + 8, crate.y + 8); ctx.lineTo(crate.x + crate.w - 8, crate.y + crate.h - 8);
  ctx.moveTo(crate.x + crate.w - 8, crate.y + 8); ctx.lineTo(crate.x + 8, crate.y + crate.h - 8); ctx.stroke();
}
function drawPlayer() {
  ctx.save(); ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.fillStyle = '#e8f3e7'; ctx.fillRect(-11, -19, 22, 25);
  ctx.fillStyle = '#18323a'; ctx.fillRect(-8, -13, 16, 6); ctx.fillStyle = '#8df3c3'; ctx.fillRect(player.facing > 0 ? 1 : -7, -11, 6, 3);
  ctx.fillStyle = '#ff896e'; ctx.fillRect(-9, 7, 7, 17); ctx.fillRect(2, 7, 7, 17);
  ctx.strokeStyle = '#e8f3e7'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-17, 5); ctx.moveTo(9, -8); ctx.lineTo(17, 1); ctx.stroke();
  ctx.restore();
}
function drawTether() {
  if (tether.state !== 'ATTACHED' && simulationTime - tether.failedAt > .24) return;
  const from = tether.state === 'ATTACHED' ? { x: player.x + 16, y: player.y + 12 } : tether.ray?.from || { x: player.x + 16, y: player.y + 12 };
  const to = tether.state === 'ATTACHED' ? tether.target : tether.fizzleEnd;
  if (!to) return;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
  const tension = tether.state === 'ATTACHED' ? Math.max(0, distance(from, to) - tether.restLength) : 0;
  ctx.strokeStyle = tether.state === 'ATTACHED' ? (tension > 30 ? '#ffbd69' : '#b5ffdf') : '#ff6d63'; ctx.lineWidth = 2.3; ctx.stroke();
}
function drawAim(now) {
  if (!input.pointerActive || !active || paused) return;
  const target = pointerWorld();
  const nearest = world.anchors.some((anchor) => distance(anchor, target) < 38 && distance(anchor, { x: player.x + 16, y: player.y + 28 }) < 820);
  ctx.strokeStyle = nearest ? '#fff2a9' : '#d0e3da'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(input.pointer.x, input.pointer.y, 8, 0, Math.PI * 2); ctx.moveTo(input.pointer.x - 12, input.pointer.y); ctx.lineTo(input.pointer.x + 12, input.pointer.y); ctx.moveTo(input.pointer.x, input.pointer.y - 12); ctx.lineTo(input.pointer.x, input.pointer.y + 12); ctx.stroke();
}
function drawDebug() {
  ctx.strokeStyle = '#ffea80'; ctx.lineWidth = 1;
  for (const body of [player, ...world.crates]) ctx.strokeRect(body.x, body.y, body.w, body.h);
  ctx.beginPath(); ctx.moveTo(player.x + 16, player.y + 28); ctx.lineTo(player.x + 16 + player.vx * .18, player.y + 28 + player.vy * .18); ctx.stroke();
  if (tether.attached) { ctx.strokeStyle = '#ff856a'; ctx.beginPath(); ctx.moveTo(tether.target.x, tether.target.y); ctx.lineTo(player.x + 16, player.y + 28); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '12px "DM Mono"'; ctx.fillText(`L ${Math.round(distance(tether.target, { x: player.x + 16, y: player.y + 28 }))} / ${Math.round(tether.restLength)}`, player.x + 22, player.y); }
  if (tether.ray) {
    ctx.strokeStyle = tether.ray.blocked ? '#ff5c59' : '#fff2a9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tether.ray.from.x, tether.ray.from.y); ctx.lineTo(tether.ray.to.x, tether.ray.to.y); ctx.stroke();
    if (tether.ray.hit) { ctx.fillStyle = '#ff5c59'; ctx.beginPath(); ctx.arc(tether.ray.hit.x, tether.ray.hit.y, 7, 0, Math.PI * 2); ctx.fill(); }
  }
}

function render(now) {
  ctx.clearRect(0, 0, width, height);
  drawWorld(now);
  const nearPushable = world.crates.some((crate) => crate.movable && distance({ x: player.x + 16, y: player.y + 28 }, { x: crate.x + crate.w / 2, y: crate.y + crate.h / 2 }) < 105);
  const prompt = nearPushable ? 'PUSHABLE  ·  WALK INTO THE METAL CRATE TO MOVE IT' : tether.attached ? 'CLICK ANCHOR TO RETARGET  ·  SPACE TO RELEASE' : 'CLICK / E  FIRE WEB';
  ui.elements.prompt.textContent = active && !paused ? prompt : '';
}
function frame(now) {
  if (!previous) previous = now;
  const frameTime = Math.min(.05, (now - previous) / 1000);
  previous = now;
  accumulator += frameTime;
  while (accumulator >= FIXED_STEP) { fixedUpdate(FIXED_STEP); accumulator -= FIXED_STEP; }
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);