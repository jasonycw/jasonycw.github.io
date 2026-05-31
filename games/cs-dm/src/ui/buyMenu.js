import { BUY_CATEGORY_METADATA, DEFAULT_LOADOUT, WEAPON_LIST, getWeaponById } from '../config/index.js';
import { deriveWeaponSwitchMetadata } from '../render/weaponModels.js';

export const BUY_MODE = Object.freeze({
  kind: 'deathmatch-free-buy',
  costPolicy: 'ignored',
});

const cloneLoadout = (loadout = DEFAULT_LOADOUT) => Object.freeze({
  primaryWeaponId: loadout.primaryWeaponId ?? DEFAULT_LOADOUT.primaryWeaponId,
  secondaryWeaponId: loadout.secondaryWeaponId ?? DEFAULT_LOADOUT.secondaryWeaponId,
  equipmentIds: Object.freeze(Array.isArray(loadout.equipmentIds) ? [...loadout.equipmentIds] : [...DEFAULT_LOADOUT.equipmentIds]),
  activeWeaponId: loadout.activeWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
});

const uniqueEquipmentIds = (equipmentIds, selectedWeapon) => {
  const withoutSameSlot = equipmentIds.filter((weaponId) => {
    const weapon = getWeaponById(weaponId);
    return weapon && weapon.equipmentSlot !== selectedWeapon.equipmentSlot;
  });

  return Object.freeze([...withoutSameSlot, selectedWeapon.id]);
};

export const getBuyCategories = () => Object.freeze(
  Object.values(BUY_CATEGORY_METADATA)
    .sort((left, right) => left.order - right.order)
    .map((category) => Object.freeze({ ...category })),
);

export const getBuyWeaponsForCategory = (categoryId) => Object.freeze(
  WEAPON_LIST
    .filter((weapon) => weapon.buyCategory === categoryId)
    .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name)),
);

export const createDefaultBuyLoadout = () => cloneLoadout(DEFAULT_LOADOUT);

export const getLoadoutWeaponLabel = (loadout = DEFAULT_LOADOUT) => {
  const normalizedLoadout = cloneLoadout(loadout);
  const activeWeapon = getWeaponById(normalizedLoadout.activeWeaponId)
    ?? getWeaponById(normalizedLoadout.primaryWeaponId)
    ?? getWeaponById(DEFAULT_LOADOUT.activeWeaponId);

  return activeWeapon?.name ?? deriveWeaponSwitchMetadata(normalizedLoadout.activeWeaponId).hud.label;
};

export const getLoadoutWeaponSwitchMetadata = (loadout = DEFAULT_LOADOUT) => {
  const normalizedLoadout = cloneLoadout(loadout);
  return deriveWeaponSwitchMetadata(normalizedLoadout.activeWeaponId);
};

export function selectBuyPurchase(currentLoadout = DEFAULT_LOADOUT, weaponId) {
  const selectedWeapon = getWeaponById(weaponId);
  const previousLoadout = cloneLoadout(currentLoadout);

  if (!selectedWeapon) {
    return Object.freeze({
      ok: false,
      reason: 'invalid-weapon',
      error: 'That weapon is not available in this buy menu.',
      loadout: previousLoadout,
      selectedWeapon: null,
      mode: BUY_MODE,
    });
  }

  const nextLoadout = {
    primaryWeaponId: previousLoadout.primaryWeaponId,
    secondaryWeaponId: previousLoadout.secondaryWeaponId,
    equipmentIds: previousLoadout.equipmentIds,
    activeWeaponId: previousLoadout.activeWeaponId,
  };

  if (selectedWeapon.equipmentSlot === 'primary') {
    nextLoadout.primaryWeaponId = selectedWeapon.id;
    nextLoadout.activeWeaponId = selectedWeapon.id;
  } else if (selectedWeapon.equipmentSlot === 'secondary') {
    nextLoadout.secondaryWeaponId = selectedWeapon.id;
    nextLoadout.activeWeaponId = selectedWeapon.id;
  } else {
    nextLoadout.equipmentIds = uniqueEquipmentIds(previousLoadout.equipmentIds, selectedWeapon);
  }

  return Object.freeze({
    ok: true,
    reason: 'free-buy-selected',
    error: '',
    loadout: cloneLoadout(nextLoadout),
    selectedWeapon,
    switchMetadata: deriveWeaponSwitchMetadata(selectedWeapon.id),
    mode: BUY_MODE,
  });
}

const setHidden = (element, hidden) => {
  element.hidden = hidden;
  element.setAttribute('aria-hidden', String(hidden));
};

const setSelectedCategory = (categoryButtons, activeCategoryId) => {
  categoryButtons.forEach((button) => {
    const selected = button.dataset.buyCategory === activeCategoryId;
    button.classList.toggle('buy-menu__category--active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
};

export function createBuyMenuController({
  menuElement,
  categoryListElement,
  weaponListElement,
  errorElement,
  hudWeaponElement,
  closeButton,
  onLoadoutChange = () => {},
  onPurchaseFailure = () => {},
  onClose = () => {},
} = {}) {
  let loadout = createDefaultBuyLoadout();
  let activeCategoryId = getBuyCategories()[0]?.id ?? '';

  const syncHud = () => {
    hudWeaponElement.textContent = getLoadoutWeaponSwitchMetadata(loadout).hud.label;
  };

  const setError = (message = '') => {
    errorElement.textContent = message;
  };

  const renderWeapons = () => {
    weaponListElement.replaceChildren();

    getBuyWeaponsForCategory(activeCategoryId).forEach((weapon) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buy-menu__weapon';
      button.dataset.buyWeapon = weapon.id;

      const name = document.createElement('span');
      name.className = 'buy-menu__weapon-name';
      name.textContent = weapon.name;

      const meta = document.createElement('span');
      meta.className = 'buy-menu__weapon-meta';
      meta.textContent = `${weapon.ammo.type.toUpperCase()} · free buy`;

      button.append(name, meta);
      weaponListElement.append(button);
    });
  };

  const renderCategories = () => {
    categoryListElement.replaceChildren();

    getBuyCategories().forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buy-menu__category';
      button.dataset.buyCategory = category.id;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = category.label;
      categoryListElement.append(button);
    });

    setSelectedCategory([...categoryListElement.querySelectorAll('[data-buy-category]')], activeCategoryId);
  };

  const selectCategory = (categoryId) => {
    if (!BUY_CATEGORY_METADATA[categoryId]) {
      return;
    }

    activeCategoryId = categoryId;
    setError('');
    setSelectedCategory([...categoryListElement.querySelectorAll('[data-buy-category]')], activeCategoryId);
    renderWeapons();
  };

  const selectWeapon = (weaponId) => {
    const result = selectBuyPurchase(loadout, weaponId);

    if (!result.ok) {
      setError(result.error);
      onPurchaseFailure(result);
      return result;
    }

    loadout = result.loadout;
    setError('');
    syncHud();
    onLoadoutChange(loadout, result);
    return result;
  };

  const open = () => {
    setHidden(menuElement, false);
    setError('');
    const firstWeaponButton = weaponListElement.querySelector('[data-buy-weapon]');
    (firstWeaponButton ?? closeButton).focus();
  };

  const close = (options = Object.freeze({ playFeedback: true })) => {
    setHidden(menuElement, true);
    setError('');
    onClose(loadout, options);
  };

  const toggle = () => {
    if (menuElement.hidden) {
      open();
    } else {
      close();
    }
  };

  categoryListElement.addEventListener('click', (event) => {
    const button = event.target.closest('[data-buy-category]');
    if (button) {
      selectCategory(button.dataset.buyCategory);
    }
  });

  weaponListElement.addEventListener('click', (event) => {
    const button = event.target.closest('[data-buy-weapon]');
    if (button) {
      selectWeapon(button.dataset.buyWeapon);
    }
  });

  closeButton.addEventListener('click', close);

  renderCategories();
  renderWeapons();
  syncHud();
  setHidden(menuElement, true);

  return Object.freeze({
    open,
    close,
    toggle,
    selectCategory,
    selectWeapon,
    getLoadout: () => loadout,
  });
}
