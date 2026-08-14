import { CRITICAL_INPUT_ACTIONS } from './actions.js';

const RESERVED_SHORTCUT_CODES = Object.freeze(['Tab', 'Escape', 'F5', 'F12']);

export const isReservedBrowserShortcut = (code) => RESERVED_SHORTCUT_CODES.includes(code);

export const getDuplicateCriticalBindings = (
  bindings,
  actions = CRITICAL_INPUT_ACTIONS,
) => {
  const ownersByCode = new Map();

  actions.forEach((action) => {
    const code = bindings[action];

    if (!code) {
      return;
    }

    const owners = ownersByCode.get(code) ?? [];
    owners.push(action);
    ownersByCode.set(code, owners);
  });

  return [...ownersByCode.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([code, actionsForCode]) => ({
      code,
      actions: actionsForCode,
    }));
};

export const hasDuplicateCriticalBindings = (
  bindings,
  actions = CRITICAL_INPUT_ACTIONS,
) => getDuplicateCriticalBindings(bindings, actions).length > 0;

export const getBindingWarnings = (bindings) => ({
  duplicateCriticalBindings: getDuplicateCriticalBindings(bindings),
  reservedBindings: Object.entries(bindings)
    .filter(([, code]) => isReservedBrowserShortcut(code))
    .map(([action, code]) => ({
      action,
      code,
    })),
});
