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

## Replacement video validation

The original screen recording captured the browser window at 896x768, including browser chrome and only the upper-left portion of the game. The replacement uses Chromium's rendered page surface at 1280x720, excluding browser chrome. A three-moment contact sheet confirms a changing player position, weapon/ammo changes after firing, visible bot silhouettes and killfeed activity, and a full scoreboard overlay in the final moment. The replacement clip is `games/cs-dm/screenshots/cs-dm-gameplay-full.mp4`.

## Direct CS 1.6 gameplay comparison target

An analyzed CS 1.6 Dust II deathmatch recording establishes the following observable target characteristics: a narrow first-person eye-level view; a chunky low-poly weapon occupying roughly the lower-right 15–20% of the viewport; circular radar at top left; chronological killfeed at top right; health and armor at bottom left; ammo and reserve at bottom right; a simple green four-point crosshair that expands with movement and rapid fire; snappy movement with jump, crouch, and strafing; visible weapon recoil and viewmodel displacement; muzzle flash and shell ejection; bright hit blood and wall bullet decals; rapid respawn/death spectator feedback; warm desaturated sandstone materials with sharp mostly static lighting; and recognizable Dust II-inspired landmarks including A-site crates, Long A, Catwalk, and Middle double doors. Player silhouettes should read as dark tactical CT forms versus lighter desert Terrorist forms. These are clean-room observable goals, not copied assets.

Reference video: https://www.youtube.com/watch?v=9AZ8tgZJj3w
Analysis artifact: /home/ubuntu/cs16-pr17/video_9AZ8tgZJj3w_analysis_20260813_152618.md

## Live comparison audit after map/model pass

The live browser comparison confirms the scene is full-viewport and the desert palette is closer, but the current frame still exposes important mismatches against the CS 1.6 reference: the HUD banner remains hard-coded as SUNSPIRE YARD despite the Dust II rename; the first-person AK-47 is too blocky and black, lacks a readable wood handguard/stock silhouette, and occupies too much of the right edge; the nearby Terrorist model reads as an oversized head and rigid rectangular torso instead of a compact low-poly soldier; and spawn placement can put an NPC directly in the camera lane before combat begins. These are priority fixes before final evidence capture.

The refreshed browser frame now correctly shows DUST II / MIDDLE in the top bar and a warmer, more separated desert surface palette. However, the direct CS 1.6 comparison still shows the same major blockers: the local AK viewmodel is mostly a black rectangular silhouette with too much of the weapon occluded by the nearby NPC, and the NPC’s head/torso proportions remain oversized and toy-like. The game also reports ticks=0 and botShots=0 at the first frame, so the capture must delay until simulation activity is visible and must avoid recording the spawn-protection freeze as its hero shot.

The latest live build now advances correctly (ticks=34, simMs=567), confirming the earlier tick-zero issue was the missing local slot import. At the first visible frame, botShots=0 is expected while the 2-second spawn-protection window is still active, but the frame is still poor evidence because an NPC fills the center of the camera. The capture must wait past protection and deliberately move/aim into a combat lane before recording.

## Final evidence capture validation

The encoded clip is 1280x720, 15 seconds, and full-viewport. Its contact sheet shows the local player moving through multiple Dust II lanes, mouse-look changing the crosshair and view direction, ammo decreasing across AK-47 and Glock 18 states, active bot killfeed lines, the scoreboard/settings overlay, and the buy/settings interaction. A shot-timed frame also shows the local player at 0 health with `ELIMINATED BY Bishop · RESPAWN IN 1s`, multiple live killfeed entries, a visible enemy in the lane, and a CT model crossing the right side. A focused shot frame with muzzle flash and a confirmed local NPC kill should still be captured before final PR evidence replacement.

The focused capture improves the comparison: a representative frame shows a visible enemy at the end of the lane aligned near the crosshair, the AK-47 ammo has dropped from 30 to 26 during the opening burst, and the bot killfeed is active at the top right. The capture still does not guarantee a visually obvious muzzle-flash frame or local confirmed kill in the contact sheet because CDP screenshots sample after the short flash window and the player is moving past the target. Final evidence should use a dedicated slower firing/aim segment or the hitmarker/killfeed state as proof of the local combat action.

## Defect-reproduction pass

The pushed mouse-look fix loads and the offline loop advances (`ticks=31`, `simMs=517`). The live first-person frame remains visibly crowded by a nearby enemy model at spawn, and the current test must inspect `gameCanvas.dataset.localYaw` and `localPitch` before and after a synthetic canvas mouse event. The prior capture's mouse movement was not sufficient evidence because it did not prove that the controller view angles changed.

## Latest live visual audit

After the occlusion and recoil commits, the live build loads `DUST II FFA · 16 PLAYERS MIDDLE`, but the default spawn view is still visually weak: a large nearby enemy occupies the center of the frame, the left wall dominates the composition, and the visible model remains highly block-based. The updated third-person weapon is smaller and does not dominate the frame, but the Dust II resemblance is still primarily in labels and broad palette rather than landmark readability. Further work must spread initial spawns, improve the camera's first sightline, and strengthen arches, doors, crates, and model proportions before recording final evidence.

## Final v10 verification

The v10 evidence run reloads the page, starts the offline match explicitly, sets a 1280x720 rendered viewport, and drives WASD, real CDP mouse movement, and repeated fire events. It produced 240 PNG frames and an encoded full-viewport MP4. The selected proof frame shows the Dust II lane, radar, 16-player FFA HUD, health/armor/ammo, AK-47 viewmodel, muzzle flash, killfeed, and multiple active opponents. `npm test` passes across gameplay, 3D bot aim, torso/head hitboxes, map blockers, renderer occlusion, weapon models, P2P, audio, and smoke/performance coverage. GitHub GraphQL reports 0 unresolved review threads on PR #17.
