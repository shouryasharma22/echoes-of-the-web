const STORAGE_KEY = 'silicon-maze-save';
const VERSION = 1;

export function defaultSave() {
  return {
    version: VERSION,
    fragments: [],
    quests: { bridge: false, ice: false, gate: false },
    finalUnlocked: false,
    checkpoint: 0,
    settings: { muted: false, volume: 0.35, reducedMotion: false, highContrast: false },
    started: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Array.isArray(parsed.fragments) || !parsed.quests || !parsed.settings) return defaultSave();
    const fresh = defaultSave();
    fresh.fragments = [...new Set(parsed.fragments.filter((id) => Number.isInteger(id) && id >= 0 && id < 6))];
    for (const key of Object.keys(fresh.quests)) fresh.quests[key] = parsed.quests[key] === true;
    fresh.finalUnlocked = parsed.finalUnlocked === true;
    fresh.checkpoint = Number.isInteger(parsed.checkpoint) && parsed.checkpoint >= 0 && parsed.checkpoint <= 2 ? parsed.checkpoint : 0;
    fresh.started = parsed.started === true;
    fresh.settings.muted = parsed.settings.muted === true;
    fresh.settings.volume = Number.isFinite(parsed.settings.volume) ? Math.max(0, Math.min(1, parsed.settings.volume)) : fresh.settings.volume;
    fresh.settings.reducedMotion = parsed.settings.reducedMotion === true;
    fresh.settings.highContrast = parsed.settings.highContrast === true;
    return fresh;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* Storage may be disabled or full. */ }
}

export function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* A fresh in-memory game still works. */ }
}