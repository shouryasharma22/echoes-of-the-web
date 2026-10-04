import { distance, overlaps } from './physics.js';

export const QUESTS = [
  { id: 'bridge', title: 'Broken Bridge', text: 'Swing across the fractured span and reach the generator.' },
  { id: 'ice', title: 'Ice Slide', text: 'Build speed on the frozen ramp, then reach the switch at its far end.' },
  { id: 'gate', title: 'Counterweight Gate', text: 'Move the heavy crate onto the pressure plate. Push it or tether-pull it.' },
];

export function updateQuests(world, player, save, feedback) {
  const center = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
  const near = (item, range = 90) => distance(center, { x: item.x + item.w / 2, y: item.y + item.h / 2 }) < range;
  if (!save.quests.bridge && near(world.generator, 125)) {
    save.quests.bridge = true;
    world.quests.bridge = true;
    world.bridge = true;
    world.switches.generator = true;
    feedback.complete('bridge', 'GENERATOR ONLINE · BRIDGE REBUILT');
  } else if (!save.quests.ice && near(world.iceSwitch, 110) && Math.abs(player.vx) > 220) {
    save.quests.ice = true;
    world.quests.ice = true;
    world.switches.ice = true;
    feedback.complete('ice', 'ICE SWITCH ENGAGED');
  } else if (!save.quests.gate && world.platePressed) {
    save.quests.gate = true;
    world.quests.gate = true;
    world.gateOpen = true;
    feedback.complete('gate', 'COUNTERWEIGHT LOCKED · GATE OPEN');
  } else if (save.finalUnlocked && save.fragments.length === 6 && near(world.core, 125)) {
    feedback.ending();
  }
  if (save.quests.bridge && save.quests.ice && save.quests.gate && !save.finalUnlocked) {
    save.finalUnlocked = true;
    feedback.unlocked();
  }
  for (const fragment of world.fragments) {
    if (!save.fragments.includes(fragment.id) && overlaps(player, { x: fragment.x - 17, y: fragment.y - 17, w: 34, h: 34 })) {
      save.fragments.push(fragment.id);
      feedback.collect(fragment.id);
    }
  }
}

export function objectiveFor(world, save, player) {
  if (save.finalUnlocked && save.fragments.length === 6) return 'Reach the Aether Core pedestal to restore the city.';
  const centerX = player.x + player.w / 2;
  if (!save.quests.bridge) return centerX > 1660 ? 'Reach the generator to rebuild the bridge.' : 'Swing across the broken bridge and reach the generator.';
  if (!save.quests.ice) return centerX > 2660 ? 'Carry your speed into the ice switch.' : 'Find the frozen ramp and build enough speed to reach its switch.';
  if (!save.quests.gate) return 'Push or tether-pull the counterweight crate onto the pressure plate.';
  return 'Find the remaining Aether Fragments and restore the Core.';
}