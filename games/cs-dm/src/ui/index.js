export const uiReady = true;

export const SHELL_PANEL_IDS = Object.freeze({
  MENU: 'menu',
  HOST: 'host',
  JOIN: 'join',
  MATCH: 'match',
});

export const setPanelVisibility = (panels, activePanelId) => {
  Object.values(panels).forEach((panel) => {
    const isActive = panel && panel.dataset.shellPanel === activePanelId;
    panel.hidden = !isActive;
    panel.setAttribute('aria-hidden', String(!isActive));
  });
};

export const setFieldError = (element, message = '') => {
  element.textContent = message;
};

export const setTextContent = (element, value = '') => {
  element.textContent = value;
};

export const setInputValue = (element, value = '') => {
  element.value = value;
};

export const createStubCode = (prefix, name, suffix = 'LOCAL') => {
  const safeName = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safePrefix = String(prefix).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return [safePrefix, safeName || 'PLAYER', suffix].join('-');
};

export * from './hudData.js';
export * from './buyMenu.js';
export * from './settings.js';

