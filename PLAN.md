# CS DM Completion Plan

## Goal

Turn the existing static Three.js prototype into a convincing, immediately playable CS 1.6-inspired FFA deathmatch while preserving the existing offline bots, manual WebRTC mode, deterministic tests, and GitHub Pages compatibility.

## Visual target

The match must read as a game first, not a diagnostics dashboard. The arena should use a compressed 4:3-style viewport, sandy concrete and olive-metal materials, hard directional light, restrained fog, and strong silhouettes. The HUD should be compact and information-dense: radar with player pips, roundless FFA score, location label, weapon/ammo, health/armor, crosshair, hit marker, killfeed, and a scoreboard that feels like a VGUI-era overlay. The first-person view should show a recognizable low-poly weapon and hands with idle/walk/recoil/reload motion.

## Gameplay target

The loop is free-for-all: spawn, receive a short protection window, move through a three-lane arena, fire with weapon-specific recoil/spread, earn kills and money, die, and respawn quickly. Bots need varied aggression and enough activity that the arena feels alive in demo mode. Weapon switching, reload, buy menu, audio feedback, killfeed, and scoreboard must remain functional.

## Implementation slices

1. **Renderer polish:** remove debug-like empty-stage treatment, strengthen map lighting/material contrast, add skyline/industrial accents, improve player silhouettes, add a visible crosshair and screen-space feedback layers, and make the viewmodel read against the scene.
2. **HUD polish:** add map name/callout, timer/score emphasis, ammo and damage state, radar readability, killfeed styling, and a compact scoreboard modal that can be opened without destroying the game view.
3. **Gameplay feel:** tune bot reaction cadence, burst behavior, movement pressure, spawn protection and respawn pacing; ensure the demo produces visible movement, firing, hits, kills, and weapon changes.
4. **Accessibility and stability:** retain keyboard/mouse controls, pointer-lock fallback, reduced-motion-safe CSS, WebGL fallback, and deterministic selectors/data attributes used by the existing smoke/verify tests.
5. **Evidence:** run npm tests and a local static server, capture screenshots and a short gameplay video, then update the PR description with the final feature summary, verification commands, screenshot links, and the uploaded gameplay video.

## Acceptance criteria

- `npm test` passes from the repository root.
- `npm run build` or the repository's equivalent static build passes.
- The game loads at `/games/cs-dm/` from a static server with no module errors.
- Offline mode visibly contains an active arena, moving bots, weapon feedback, radar, killfeed, respawns, and score changes.
- Manual host/join P2P UI still loads and malformed codes fail safely.
- No copied Counter-Strike assets, maps, textures, or proprietary source are introduced; all new art is original/procedural or generated homage.
- The pull request description contains a direct playable link, implementation summary, verification results, and a gameplay video.
