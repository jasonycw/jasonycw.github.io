# CS 1.6 Deathmatch Research

## Experience target

Counter-Strike 1.6 is a GoldSrc first-person shooter with a deliberately low-poly, low-resolution, utilitarian presentation: concrete and sand-colored map materials, strong baked-light contrast, chunky geometry, compact HUD typography, and direct weapon feedback. The target should feel like an early-2000s tactical shooter rather than a modern glossy FPS. GoldSrc is documented as a C/C++ engine derived heavily from Quake, with OpenGL/software rendering, skeletal models, colored lighting, and a Half-Life SDK [1]. Counter-Strike 1.6 is a GoldSrc title released as the final major Counter-Strike version in 2003 [2].

## Deathmatch behavior

The reference mode is free-for-all rather than round-based objective play. The player should respawn rapidly after death, retain or reselect weapons, and stay in near-continuous action. ReGameDLL_CS documents the relevant server-side model: `mp_freeforall` enables FFA, `mp_forcerespawn` enables automatic respawn after a delay, `mp_respawn_immunitytime` provides spawn protection, `mp_respawn_immunity_force_unset` removes protection after movement or attack, `mp_auto_reload_weapons` reloads on spawn, and `mp_refill_bpammo_weapons` restores backpack ammunition. It also documents kill/frag limits and scoreboard health options [3].

The ReDeathmatch plugin confirms practical CSDM features to mirror: randomized or preset spawn points, configurable spawn protection, weapon menus, team deathmatch and FFA, and persistent configuration [4]. For this static game, implement a crisp FFA loop: spawn at a safe point, briefly show protection, move and fire, kill feed and score update, fast respawn, and a buy/loadout menu that does not interrupt the match for long.

## Source-level references

The original GoldSrc/Counter-Strike implementation is proprietary, so use public SDK material and clean-room open-source references rather than copied leaked code. ReGameDLL_CS is an MIT-licensed reverse-engineered server-side GameDLL for Counter-Strike 1.6, with readable configuration and gameplay behavior references, including free-for-all, respawn, weapons, ammunition, and spawn immunity [3]. The Valve Developer Community identifies the Half-Life SDK and GoldSrc programming model as the appropriate public engine-level reference [1][2].

## Gameplay video references

The visual and pacing target should be validated against public no-commentary CS 1.6 deathmatch videos, including `Counter-Strike 1.6 - fy_snow_night Deathmatch Gameplay` and `No Mercy, No Respawn Time – Counter Strike 1.6 Deathmatch!`. The implementation should emphasize immediate respawn, readable silhouettes, aggressive weapon rhythm, clear hit/death feedback, and the compact scoreboard/radar language visible in these references.

## References

[1]: https://developer.valvesoftware.com/wiki/GoldSrc "GoldSrc - Valve Developer Community"
[2]: https://developer.valvesoftware.com/wiki/Counter-Strike "Counter-Strike - Valve Developer Community"
[3]: https://github.com/rehlds/ReGameDLL_CS "ReGameDLL_CS - open-source Counter-Strike GameDLL reference"
[4]: https://github.com/ReDeathmatch/ReDeathmatch_AMXX "ReDeathmatch_AMXX - Counter-Strike 1.6 deathmatch plugin"
[5]: https://www.youtube.com/watch?v=NMEaellaVGk "Counter-Strike 1.6 - fy_snow_night Deathmatch Gameplay"
[6]: https://www.youtube.com/watch?v=eZcsiZ9fvyI "No Mercy, No Respawn Time - Counter Strike 1.6 Deathmatch"

## Current branch visual audit

The existing screenshots show a coherent dark shell and extensive controls, but the presentation reads as a tall diagnostics page rather than a game. The match view has a dark empty viewport, sparse HUD, placeholder-like scoreboard, and a visible pointer-lock warning. The menu is a narrow centered dashboard with modern rounded cards and blue buttons, not the compact utilitarian 4:3 CS 1.6 menu language. The next pass should prioritize a visibly playable canvas: a stylized dust/industrial arena, a first-person weapon silhouette, crosshair, radar, killfeed, ammo/health/armor readouts, active targets, muzzle flashes, hit markers, and a compact in-match scoreboard overlay. It should retain the existing accessible shell and tests while reducing the feeling of a placeholder/debug screen.
