# Blokus Online

This folder contains the zero-build GitHub Pages implementation of **Blokus** at the requested repository path `games/blokus-online/`. It is designed to be launched directly from a static web host with no custom backend.

Public entry points:

- Primary playable page: `https://jasonycw.github.io/games/blokus-online/`

## What this folder provides

- `index.html` — the full Blokus application: UI, rules engine, local AI, canvas rendering, touch/mouse interactions, and WebRTC peer-to-peer multiplayer.
- `README.md` — this implementation note.

## Features

- **Standard 4-color Blokus:** 20×20 grid, 21 polyominoes per color, fixed Blue → Yellow → Red → Green turn order, corner-only same-color contact, and no same-color edge contact.
- **Startup player selection:** The landing screen lets users choose 1, 2, 3, or 4 people sharing the same device.
- **Local AI fill:** 1P, 2P, and 3P local games automatically fill the remaining colors with heuristic AI so every game always has four colors.
- **Pass-and-play local multiplayer:** 4 people can share one desktop, tablet, or phone.
- **Responsive desktop/mobile UI:** Canvas board and inventory controls accept mouse and touch input, with rotate/flip/cancel/place controls for accurate mobile placement.
- **Serverless online play:** Online games use PeerJS over WebRTC from a public CDN. The host shares a room ID, remote players connect in browser, and any leftover colors can be host-controlled or AI-controlled.
- **Static hosting only:** The page loads Tailwind CSS and PeerJS from public CDNs and does not require a build step, Node service, database, or custom websocket server.

## Online connection flow

1. Host opens the game and selects **Host Online Game**.
2. The page creates a `BLK-` prefixed room ID and displays it in the host lobby.
3. The host lobby shows every color, who controls it, and whether an online player has joined before the game starts.
4. Joining players open the game, choose **Join Online Game**, enter a valid six-character suffix after the fixed `BLK-` prefix, then choose one of the currently open colors or see a connection error.
5. The host starts the match after every online-open color has been chosen, or switches any empty online slots to AI/local control first.
6. The host remains authoritative for game state validation and broadcasts state updates to peers.

## Notes

- WebRTC can require internet access to public PeerJS/STUN infrastructure. If a restrictive network blocks peer discovery or NAT traversal, local pass-and-play and AI modes still work offline after the CDN files are loaded/cached by the browser.
- The game uses advanced final scoring at game over by converting placed squares and all-piece bonuses into official penalty/bonus points.
