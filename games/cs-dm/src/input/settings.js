import { InputAction, INPUT_ACTIONS } from './actions.js';
import { DEFAULT_BINDING_FALLBACKS, createDefaultBindingMap } from './bindings.js';
import { getBindingWarnings, hasDuplicateCriticalBindings } from './conflicts.js';

const BINDING_LABEL_OVERRIDES = Object.freeze({
  Mouse0: 'Mouse 1',
  Mouse1: 'Mouse 2',
  Mouse2: 'Mouse 3',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Left Meta',
  MetaRight: 'Right Meta',
  Escape: 'Esc',
  Space: 'Space',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
});


export const MOUSE_SENSITIVITY_RANGE = Object.freeze({
  min: 0.25,
  max: 3,
  step: 0.05,
});

export const DEFAULT_MOUSE_SETTINGS = Object.freeze({
  sensitivity: 1,
  invertY: true,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const roundToStepPrecision = (value) => Number(value.toFixed(2));

export const normalizeMouseSensitivity = (sensitivity = DEFAULT_MOUSE_SETTINGS.sensitivity) => {
  const numericSensitivity = Number(sensitivity);

  if (!Number.isFinite(numericSensitivity)) {
    return DEFAULT_MOUSE_SETTINGS.sensitivity;
  }

  return roundToStepPrecision(clamp(numericSensitivity, MOUSE_SENSITIVITY_RANGE.min, MOUSE_SENSITIVITY_RANGE.max));
};

export const normalizeMouseSettings = (settings = DEFAULT_MOUSE_SETTINGS) => {
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...DEFAULT_MOUSE_SETTINGS };
  }

  return {
    sensitivity: normalizeMouseSensitivity(settings.sensitivity),
    invertY: typeof settings.invertY === 'boolean' ? settings.invertY : DEFAULT_MOUSE_SETTINGS.invertY,
  };
};

export const getMouseSensitivityPercent = (settings = DEFAULT_MOUSE_SETTINGS) => `${Math.round(normalizeMouseSettings(settings).sensitivity * 100)}%`;

export const getConfiguredMouseLookDelta = (lookDelta = Object.freeze({ yawDelta: 0, pitchDelta: 0 }), settings = DEFAULT_MOUSE_SETTINGS) => {
  const mouseSettings = normalizeMouseSettings(settings);
  const yawDelta = Number(lookDelta.yawDelta) || 0;
  const pitchDelta = Number(lookDelta.pitchDelta) || 0;

  return Object.freeze({
    yawDelta: -yawDelta * mouseSettings.sensitivity,
    pitchDelta: pitchDelta * mouseSettings.sensitivity * (mouseSettings.invertY ? -1 : 1),
  });
};

export const getBindingLabel = (code) => {
  if (typeof code !== 'string' || code.length === 0) {
    return 'Unbound';
  }

  if (BINDING_LABEL_OVERRIDES[code]) {
    return BINDING_LABEL_OVERRIDES[code];
  }

  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3);
  }

  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }

  if (code.startsWith('Numpad') && code.length > 6) {
    return `Num ${code.slice(6)}`;
  }

  return code;
};

export const normalizeBindingMap = (bindings = createDefaultBindingMap()) => {
  const normalizedBindings = createDefaultBindingMap();

  if (bindings === null || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return normalizedBindings;
  }

  INPUT_ACTIONS.forEach((action) => {
    const code = bindings[action];

    if (typeof code === 'string' && code.trim().length > 0) {
      normalizedBindings[action] = code.trim();
    }
  });

  return normalizedBindings;
};

export const rebindInputAction = (bindings = createDefaultBindingMap(), action = InputAction.Buy, code = '') => Object.freeze({
  ...normalizeBindingMap(bindings),
  [action]: code,
});

export const getLiveBindingCandidates = (bindings = createDefaultBindingMap(), action = InputAction.Buy) => {
  const normalizedBindings = normalizeBindingMap(bindings);
  const candidates = [normalizedBindings[action], ...(DEFAULT_BINDING_FALLBACKS[action] ?? [])];

  return Object.freeze(candidates.filter((candidate, index, list) => typeof candidate === 'string' && candidate.length > 0 && list.indexOf(candidate) === index));
};

export const getBindingChangeResult = (bindings = createDefaultBindingMap(), action = InputAction.Buy, code = '') => {
  const nextBindings = rebindInputAction(bindings, action, code);
  const warnings = getBindingWarnings(nextBindings);
  const duplicateCriticalBinding = warnings.duplicateCriticalBindings.length > 0;

  return Object.freeze({
    ok: !duplicateCriticalBinding,
    reason: duplicateCriticalBinding ? 'duplicate-critical-binding' : 'binding-updated',
    bindings: duplicateCriticalBinding ? normalizeBindingMap(bindings) : nextBindings,
    warnings,
    duplicateCriticalBinding,
  });
};

export const hasBindingConflict = (bindings = createDefaultBindingMap()) => hasDuplicateCriticalBindings(normalizeBindingMap(bindings));
