# PR Draft

## Summary
CS DM is now ready for a merge candidate on GitHub Pages. The branch adds the static Three.js deathmatch prototype, offline bot baseline, manual-code P2P flow, local verification, screenshots, and the docs needed to review the work end to end.

## Screenshots
All screenshot paths are relative and already exist in the repo.

- `games/cs-dm/screenshots/menu.png`
- `games/cs-dm/screenshots/offline-gameplay.png`
- `games/cs-dm/screenshots/buy-menu.png`
- `games/cs-dm/screenshots/scoreboard.png`
- `games/cs-dm/screenshots/p2p-ui.png`

## Tests
- `npm run test` passed.
- Static server verification passed with `python -m http.server 8080` from the repo root.
- `/games/` navigates to `/games/cs-dm/` through the relative catalog link.
- Playwright browser QA reported zero console errors and zero failed network requests.

## P2P limitations
CS DM uses manual-code WebRTC. It is best-effort only, depends on browser, NAT, and firewall behavior, and does not use a TURN server, signaling broker, relay, or backend.

The deterministic QA surface covers local-context behavior and a single-tab UI spot-check. It does not claim internet-wide reliability.

## IP / non-affiliation note
CS DM is not affiliated with Valve, Counter-Strike, or Steam. It does not ship copied Counter-Strike assets, audio, screenshots, maps, or exported meshes. The visuals are original or generated placeholders only.

## Commit overview
Current branch history shows nine atomic commits on top of `origin/master`:

1. `86c3b98` `docs(cs-dm): capture final gameplay screenshots`
2. `246104d` `test(cs-dm): verify manual p2p gameplay flow`
3. `18c1424` `feat(cs-dm): tune offline deathmatch playability`
4. `f41da21` `docs(cs-dm): add README screenshots and P2P notes`
5. `0825d5f` `test(cs-dm): add deterministic smoke suite`
6. `c1641ad` `fix(cs-dm): harden render and respawn edges`
7. `4fed019` `test(cs-dm): cover storage and name edge cases`
8. `7ae3dc0` `feat(games): list CS DM in catalog`
9. `ce227c4` `feat(cs-dm): add static deathmatch prototype`

All nine commits on the current branch have the required trailers.

## Merge-readiness checklist
- [x] Static Pages paths use relative URLs only.
- [x] Screenshot paths exist and are referenced in the docs.
- [x] `npm run test` passes.
- [x] Static server verification passes.
- [x] Console errors are zero in browser QA.
- [x] Failed network requests are zero in browser QA.
- [x] P2P limitations are documented clearly.
- [x] IP and non-affiliation note is present.
- [x] Commit history is atomic and trailer-complete.
- [x] No GitHub PR has been created yet.