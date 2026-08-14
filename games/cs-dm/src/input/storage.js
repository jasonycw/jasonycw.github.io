import { INPUT_ACTIONS } from './actions.js';
import { createDefaultBindingMap } from './bindings.js';
import { DEFAULT_MOUSE_SETTINGS, normalizeMouseSettings } from './settings.js';

export const INPUT_STORAGE_KEY = 'cs-dm.input-settings.v1';
export const INPUT_STORAGE_SCHEMA_VERSION = 1;

const getDefaultStorage = () => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizePlayerName = (playerName) => (typeof playerName === 'string' ? playerName.trim().slice(0, 20) : '');

const normalizeBindings = (bindings) => {
  const normalizedBindings = createDefaultBindingMap();

  if (!isPlainObject(bindings)) {
    return normalizedBindings;
  }

  INPUT_ACTIONS.forEach((action) => {
    const code = bindings[action];

    if (typeof code === 'string' && code.trim()) {
      normalizedBindings[action] = code.trim();
    }
  });

  return normalizedBindings;
};

const createDefaultInputSettings = () => ({
  version: INPUT_STORAGE_SCHEMA_VERSION,
  playerName: '',
  bindings: createDefaultBindingMap(),
  mouse: { ...DEFAULT_MOUSE_SETTINGS },
});

const safeGetItem = (storage, key) => {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
};

const safeSetItem = (storage, key, value) => {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
};

const parseInputSettings = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return {
      value: createDefaultInputSettings(),
      warning: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!isPlainObject(parsed) || parsed.version !== INPUT_STORAGE_SCHEMA_VERSION) {
      throw new Error('Unsupported input settings schema.');
    }

    return {
      value: {
        version: INPUT_STORAGE_SCHEMA_VERSION,
        playerName: normalizePlayerName(parsed.playerName),
        bindings: normalizeBindings(parsed.bindings),
        mouse: normalizeMouseSettings(parsed.mouse),
      },
      warning: null,
    };
  } catch {
    return {
      value: createDefaultInputSettings(),
      warning: {
        type: 'corrupt-storage',
        key: INPUT_STORAGE_KEY,
      },
    };
  }
};

export const readInputSettings = (storage = getDefaultStorage()) => parseInputSettings(safeGetItem(storage, INPUT_STORAGE_KEY));

export const writeInputSettings = (storage = getDefaultStorage(), nextSettings = createDefaultInputSettings()) => safeSetItem(
  storage,
  INPUT_STORAGE_KEY,
  JSON.stringify({
    version: INPUT_STORAGE_SCHEMA_VERSION,
    playerName: normalizePlayerName(nextSettings.playerName),
    bindings: normalizeBindings(nextSettings.bindings),
    mouse: normalizeMouseSettings(nextSettings.mouse),
  }),
);

export const readStoredPlayerName = (storage = getDefaultStorage()) => {
  const { value, warning } = readInputSettings(storage);

  return {
    value: value.playerName,
    warning,
  };
};

export const writeStoredPlayerName = (storage = getDefaultStorage(), playerName = '') => {
  const { value } = readInputSettings(storage);

  return writeInputSettings(storage, {
    ...value,
    playerName,
  });
};

export const readStoredKeybindings = (storage = getDefaultStorage()) => {
  const { value, warning } = readInputSettings(storage);

  return {
    value: value.bindings,
    warning,
  };
};

export const writeStoredKeybindings = (storage = getDefaultStorage(), bindings = createDefaultBindingMap()) => {
  const { value } = readInputSettings(storage);

  return writeInputSettings(storage, {
    ...value,
    bindings,
  });
};

export const readStoredMouseSettings = (storage = getDefaultStorage()) => {
  const { value, warning } = readInputSettings(storage);

  return {
    value: value.mouse,
    warning,
  };
};

export const writeStoredMouseSettings = (storage = getDefaultStorage(), mouse = DEFAULT_MOUSE_SETTINGS) => {
  const { value } = readInputSettings(storage);

  return writeInputSettings(storage, {
    ...value,
    mouse,
  });
};
