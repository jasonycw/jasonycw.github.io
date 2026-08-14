export const InputAction = Object.freeze({
  MoveForward: 'MoveForward',
  MoveBack: 'MoveBack',
  MoveLeft: 'MoveLeft',
  MoveRight: 'MoveRight',
  Fire: 'Fire',
  Reload: 'Reload',
  Jump: 'Jump',
  Crouch: 'Crouch',
  Buy: 'Buy',
  Scoreboard: 'Scoreboard',
  Settings: 'Settings',
  WeaponSlot1: 'WeaponSlot1',
  WeaponSlot2: 'WeaponSlot2',
  WeaponSlot3: 'WeaponSlot3',
  WeaponSlot4: 'WeaponSlot4',
  WeaponSlot5: 'WeaponSlot5',
});

export const INPUT_ACTIONS = Object.freeze(Object.values(InputAction));

export const CRITICAL_INPUT_ACTIONS = Object.freeze([
  InputAction.MoveForward,
  InputAction.MoveBack,
  InputAction.MoveLeft,
  InputAction.MoveRight,
  InputAction.Fire,
  InputAction.Reload,
  InputAction.Jump,
  InputAction.Crouch,
  InputAction.Buy,
  InputAction.Scoreboard,
  InputAction.Settings,
  InputAction.WeaponSlot1,
  InputAction.WeaponSlot2,
  InputAction.WeaponSlot3,
  InputAction.WeaponSlot4,
  InputAction.WeaponSlot5,
]);
