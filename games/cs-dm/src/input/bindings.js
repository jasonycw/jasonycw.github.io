import { InputAction } from './actions.js';

export const DEFAULT_BINDINGS = Object.freeze({
  [InputAction.MoveForward]: 'KeyW',
  [InputAction.MoveBack]: 'KeyS',
  [InputAction.MoveLeft]: 'KeyA',
  [InputAction.MoveRight]: 'KeyD',
  [InputAction.Fire]: 'Mouse0',
  [InputAction.Reload]: 'KeyR',
  [InputAction.Jump]: 'Space',
  [InputAction.Crouch]: 'ControlLeft',
  [InputAction.Buy]: 'KeyB',
  [InputAction.Scoreboard]: 'Tab',
  [InputAction.Settings]: 'Escape',
  [InputAction.WeaponSlot1]: 'Digit1',
  [InputAction.WeaponSlot2]: 'Digit2',
  [InputAction.WeaponSlot3]: 'Digit3',
  [InputAction.WeaponSlot4]: 'Digit4',
  [InputAction.WeaponSlot5]: 'Digit5',
});

export const DEFAULT_BINDING_FALLBACKS = Object.freeze({
  [InputAction.Scoreboard]: Object.freeze(['KeyT']),
  [InputAction.Settings]: Object.freeze(['KeyO']),
});

export const createDefaultBindingMap = () => ({
  ...DEFAULT_BINDINGS,
});

export const getBindingCandidates = (action) => {
  const candidates = [DEFAULT_BINDINGS[action], ...(DEFAULT_BINDING_FALLBACKS[action] ?? [])];

  return candidates.filter(Boolean);
};
