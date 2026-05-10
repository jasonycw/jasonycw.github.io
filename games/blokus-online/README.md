# Blokus Online

This folder contains a GitHub Pages, zero-build browser implementation of classic **Blokus** at:

<https://jasonycw.github.io/games/blokus-online/>

It is a static web app: `index.html` includes the HTML, CSS, and JavaScript needed to run the game. No repository build step, backend service, database, or packaged dependency is required.

## What the page does

- Runs a playable 20×20 classic Blokus game in any modern desktop or mobile browser.
- Supports **1 to 4 people sharing the same device** from the startup/local setup screen.
- Fills all non-human seats with **local AI**, so every match always has the four standard colors: Blue, Yellow, Red, and Green.
- Supports **online peer-to-peer play** between browsers with host and join flows.
- Uses mouse and touch input for selecting, rotating/flipping, previewing, and placing pieces.
- Implements the standard placement rules:
  - Blue → Yellow → Red → Green turn order.
  - First piece must cover the color's assigned corner.
  - Later pieces must touch the same color diagonally at a corner.
  - Same-color pieces may not touch along edges.
  - Different colors may touch along edges or corners.
  - Pieces cannot overlap or leave the board.
- Implements official-style end scoring:
  - Each unplaced unit square is `-1` point.
  - Placing all 21 pieces gives `+15` points.
  - Placing all pieces with the one-square monomino last gives an additional `+5` points.

## Files

- `index.html` — the complete game application, including UI, rules engine, AI, scoring, canvas rendering, and WebRTC/PeerJS networking.
- `README.md` — this documentation file.

The canonical folder and playable route are both `blokus-online`.

## Public CDN libraries

The game uses only public CDN-hosted libraries:

- [Tailwind CSS CDN](https://tailwindcss.com/docs/installation/play-cdn) for responsive styling.
- [PeerJS CDN](https://peerjs.com/) for simplifying WebRTC data connections.

PeerJS creates direct browser-to-browser WebRTC data channels after signaling. This project does not run an application server in this repository.

## Local play

1. Open `/games/blokus-online/`.
2. Choose **Local / AI Play**.
3. Select how many people are sharing the device: 1, 2, 3, or 4.
4. Optionally edit each color slot manually.
5. Press **Start Game**.

## Online play

### Host

1. Open `/games/blokus-online/`.
2. Choose **Host Online Game**.
3. Mark any remotely controlled colors as **Open (Network)**.
4. Share the generated room ID with other players.
5. Once browsers connect, press **Start Game**.

### Join

1. Open `/games/blokus-online/`.
2. Choose **Join Online Game**.
3. Enter the host's room ID.
4. Wait for the host to start the game.

## Mobile and desktop controls

- Select a piece from the tray.
- Tap/click or drag on the board to position the transparent preview.
- Use **Rot** to rotate the selected piece.
- Use **Flip** to mirror the selected piece.
- Press **Place** when the preview is green.
- Red preview cells indicate an illegal placement.

## Development notes

Because the page is intentionally static and single-file, updates can be made by editing `index.html` directly. If you add more dependencies, keep them as public CDN URLs or plain static files so the page remains compatible with GitHub Pages without a build pipeline.
