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
