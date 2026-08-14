## CS DM — Counter-Strike 1.6-inspired static deathmatch

This PR completes the static browser deathmatch prototype into a playable, original homage to the **CS 1.6 / GoldSrc** experience. It is intentionally not a copy of Counter-Strike assets or proprietary code: the map, models, materials, weapon silhouettes, UI, and audio are procedural/original, informed by public GoldSrc documentation and clean-room gameplay references.

### What is now playable

The game loads as a build-free static page at [`/games/cs-dm/`](../tree/feature/cs-dm-static-prototype/games/cs-dm/). Start an offline 16-player free-for-all with bots, move with WASD, look with the mouse, aim and fire, reload, switch weapons, buy a loadout, open the scoreboard, and respawn rapidly after death. The match presents a compact GoldSrc-inspired combat viewport with a **Dust II-inspired sandstone route layout**, recognizable Middle/Long/Tunnels/A Site/B Site/CT Spawn callouts, hard readable lighting, radar, killfeed, crosshair, muzzle flash, hit marker, spawn-protection notice, health/armor/ammo HUD, animated low-poly faction silhouettes, recognizable AK-47/Glock/AWP-era weapon silhouettes, and scoreboard overlay.

All 15 bots now participate in the match loop. They navigate, acquire nearby living opponents, pursue targets when sightlines are blocked, exchange fire through valid sightlines, score kills, respawn, and update the killfeed. Local elimination shows the attacker name and respawn countdown in a kill-cam-style overlay. Enemy models are correctly depth-occluded by solid walls; the previous debug x-ray rendering has been removed.

The manual P2P flow remains available through **Host Game** and **Join Game**. The WebRTC offer/answer exchange is still manual by design for this static deployment, while the deterministic test suite covers offer/answer creation, remote-slot joining, input reduction, snapshot display, disconnect fallback, and malformed-code recovery.

### Evidence

| Evidence | Link |
| --- | --- |
| Full-viewport aimed-combat screenshot | [Open the final 1280×720 gameplay frame](https://files.manuscdn.com/user_upload_by_module/session_file/310519663510083575/uNdAdnBiaQVFwrGk.png) |
| Full-viewport combat video | [Watch the corrected movement, aiming, firing, killfeed, bot-combat, scoreboard, buy, and respawn recording](https://files.manuscdn.com/user_upload_by_module/session_file/310519663510083575/hoRJRQCgvvroGPVT.mp4) |
| Earlier full-loop video | [Watch the earlier full-viewport bot-combat and deathmatch loop](https://files.manuscdn.com/user_upload_by_module/session_file/310519663510083575/QCqEVNywfwlhDKST.mp4) |
| Original superseded recording | [Old cropped recording](https://files.manuscdn.com/user_upload_by_module/session_file/310519663510083575/bPvszBgdyWtWNAqC.mp4) — superseded because it included browser chrome and did not show enough of the game surface. |
| Multiplayer UI reference | [`screenshots/p2p-ui.png`](../blob/feature/cs-dm-static-prototype/games/cs-dm/screenshots/p2p-ui.png) |
| Offline match screenshot | [`screenshots/offline-gameplay.png`](../blob/feature/cs-dm-static-prototype/games/cs-dm/screenshots/offline-gameplay.png) |

### Verification completed

- `npm test` passes, including deterministic gameplay, bot soak, movement, combat, audio, static verification, weapon safety, renderer hardening, and the T30 smoke suite.
- The live static page was opened from the repository path and the offline match was run in-browser with 16 active slots, bot shots, kills, respawns, radar blips, killfeed entries, local elimination feedback, and no browser console errors after the timer import fix.
- The final evidence capture was taken from the rendered page surface at **1280×720**, excluding browser chrome. Scripted inputs drive WASD movement, relative mouse-look aiming, firing bursts, reload, weapon switching, scoreboard, buy/settings interactions, and continued bot combat.
- The video was compared against authentic CS 1.6 gameplay references for first-person framing, compact HUD hierarchy, weapon lower-right placement, Dust II-style sandstone landmarks, line-of-sight occlusion, killfeed timing, and rapid deathmatch respawn feedback. The implementation uses clean-room original geometry and materials rather than copied game assets.
- The production branch has been kept reviewable through atomic commits pushed during implementation.

### Research basis

The visual target follows the public [GoldSrc documentation](https://developer.valvesoftware.com/wiki/GoldSrc), Counter-Strike's [Valve Developer Community reference](https://developer.valvesoftware.com/wiki/Counter-Strike), and the documented deathmatch controls and respawn/spawn-immunity behavior in [ReGameDLL_CS](https://github.com/rehlds/ReGameDLL_CS) and [ReDeathmatch_AMXX](https://github.com/ReDeathmatch/ReDeathmatch_AMXX). The authentic gameplay-video comparison findings and acceptance criteria are committed in [`RESEARCH.md`](../blob/feature/cs-dm-static-prototype/RESEARCH.md), while implementation acceptance criteria are in [`PLAN.md`](../blob/feature/cs-dm-static-prototype/PLAN.md).

### Review status

Implementation proof-of-work has been tested and pushed. The previously reported review conversations have been fixed and resolved. Please review the current PR with:

`/gemini review the PR`
