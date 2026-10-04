import { GRAVITY } from './physics.js';

export function createPlayer(checkpoint = 0) {
  const starts = [{ x: 110, y: 1022 }, { x: 1830, y: 1022 }, { x: 3420, y: 1022 }];
  return { x: starts[checkpoint].x, y: starts[checkpoint].y, w: 32, h: 58, vx: 0, vy: 0, grounded: true, coyote: 0.105, jumpBuffer: 0, facing: 1, checkpoint };
}

export function updatePlayer(player, input, dt, world) {
  const jumpPressed = input.jumpPressed;
  input.jumpPressed = false;
  const direction = Number(input.right) - Number(input.left);
  if (direction) {
    player.facing = direction;
    player.vx += direction * (player.grounded ? 2600 : 1250) * dt;
  }
  const maxSpeed = player.grounded ? 390 : 420;
  player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
  if (!direction) player.vx *= Math.exp(-(player.grounded ? 8.5 : 0.85) * dt);
  player.vy += GRAVITY * dt;
  player.vy = Math.min(player.vy, 1100);
  player.coyote = player.grounded ? 0.105 : Math.max(0, player.coyote - dt);
  player.jumpBuffer = jumpPressed ? 0.18 : Math.max(0, player.jumpBuffer - dt);
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -820;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    input.sound?.('jump');
  }
  if (input.jumpReleased && player.vy < -190) player.vy *= 0.64;
  input.jumpReleased = false;
  const floor = world.surfaceAt(player.x + player.w / 2, player.y + player.h + 2);
  const friction = floor?.ice ? 0.6 : 1;
  if (player.grounded) player.vx *= 1 - (1 - friction) * dt;
}