import { QUESTS } from './quests.js';

export function createUI() {
  const elements = {
    shell: document.querySelector('#game-shell'), canvas: document.querySelector('#game'),
    fragments: document.querySelector('#fragment-count'), objective: document.querySelector('#objective-text'),
    zone: document.querySelector('#zone-label'), prompt: document.querySelector('#prompt'), toast: document.querySelector('#toast'),
    dialogue: document.querySelector('#dialogue'), panel: document.querySelector('#panel'), panelTitle: document.querySelector('#panel-title'),
    panelKicker: document.querySelector('#panel-kicker'), panelContent: document.querySelector('#panel-content'), ending: document.querySelector('#ending'),
  };
  let toastTimer;
  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2100);
  }
  function showPanel(title, content, kicker = 'CITY SYSTEMS') {
    elements.panelTitle.textContent = title;
    elements.panelKicker.textContent = kicker;
    elements.panelContent.replaceChildren(content);
    elements.panel.hidden = false;
  }
  function journal(save) {
    const list = document.createElement('div');
    list.className = 'panel-content';
    for (const quest of QUESTS) {
      const row = document.createElement('article');
      row.className = `quest-row${save.quests[quest.id] ? ' done' : ''}`;
      const state = document.createElement('span');
      state.className = 'quest-state';
      state.textContent = save.quests[quest.id] ? 'COMPLETE' : 'ACTIVE';
      const title = document.createElement('strong');
      title.textContent = quest.title;
      const text = document.createElement('p');
      text.textContent = quest.text;
      row.append(state, title, text);
      list.append(row);
    }
    const fragments = document.createElement('p');
    fragments.className = 'settings-row';
    fragments.textContent = `Aether Fragments  ${save.fragments.length}/6`;
    list.append(fragments);
    showPanel('Field Journal', list, 'MISSION LOG');
  }
  function menu(save, actions) {
    const content = document.createElement('div');
    content.className = 'panel-content';
    const setting = (label, type, key) => {
      const row = document.createElement('label');
      row.className = 'settings-row';
      const text = document.createElement('span'); text.textContent = label;
      const control = document.createElement('input'); control.type = type;
      if (type === 'range') { control.min = '0'; control.max = '1'; control.step = '.05'; control.value = String(save.settings[key]); }
      else control.checked = save.settings[key];
      control.addEventListener('input', () => actions.setting(key, type === 'range' ? Number(control.value) : control.checked));
      row.append(text, control); content.append(row);
    };
    setting('Mute sound', 'checkbox', 'muted');
    setting('Volume', 'range', 'volume');
    setting('Reduced motion', 'checkbox', 'reducedMotion');
    setting('High contrast', 'checkbox', 'highContrast');
    const buttons = document.createElement('div'); buttons.className = 'menu-actions';
    const resume = document.createElement('button'); resume.className = 'secondary-button'; resume.textContent = 'RESUME'; resume.addEventListener('click', actions.close);
    const newGame = document.createElement('button'); newGame.className = 'secondary-button'; newGame.textContent = 'NEW GAME / RESET PROGRESS'; newGame.addEventListener('click', actions.reset);
    buttons.append(resume, newGame); content.append(buttons);
    showPanel('Paused', content, 'CITY SYSTEMS');
  }
  function update(save, objective, zone) {
    elements.fragments.textContent = `FRAGMENTS ${save.fragments.length}/6`;
    elements.objective.textContent = objective;
    elements.zone.textContent = zone;
    elements.shell.classList.toggle('reduced-motion', save.settings.reducedMotion);
    elements.shell.classList.toggle('high-contrast', save.settings.highContrast);
  }
  return { elements, toast, showPanel, journal, menu, update, closePanel: () => { elements.panel.hidden = true; }, showEnding: () => { elements.ending.hidden = false; } };
}