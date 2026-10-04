export function createAudio(settings) {
  let context;
  function play(type) {
    if (settings.muted) return;
    try {
      context ||= new AudioContext();
      if (context.state === 'suspended') context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const presets = { jump: [360, 560, .09], attach: [520, 740, .12], fizzle: [170, 90, .16], pickup: [690, 1040, .2], quest: [440, 880, .34], checkpoint: [260, 420, .2] };
      const [from, to, duration] = presets[type] || presets.attach;
      oscillator.type = type === 'fizzle' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(Math.max(.001, settings.volume * .14), now);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch { /* Audio is an enhancement; gameplay stays available. */ }
  }
  return { play };
}