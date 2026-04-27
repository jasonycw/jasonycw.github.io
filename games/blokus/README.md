# Blokus - Single-File P2P Web Edition

A complete, zero-build, serverless web implementation of the classic abstract strategy board game **Blokus**. This project is entirely contained within a single HTML file and features local multiplayer, built-in AI opponents, and fully serverless peer-to-peer online multiplayer over the internet.

Play now: https://jasonycw.github.io/games/blokus/

## 📖 What is Blokus?
Blokus is a spatial reasoning and strategy board game played on a 20x20 square grid. Each player receives a set of 21 unique polyomino pieces (shapes made of 1 to 5 squares) and takes turns placing them on the board. The goal is to fit as many of your pieces on the board as possible.

### Game Rules
1. **Turn Order:** Play always proceeds in this order: Blue (1) -> Yellow (2) -> Red (3) -> Green (4).
2. **First Move:** Each player's very first piece must cover their designated corner square of the board.
3. **Placement Rules:** * **Corner-to-Corner:** Every new piece you play MUST touch at least one other piece of your own color at the corners.
   * **No Edge Touching:** Pieces of the *same* color CANNOT share a flat edge. 
   * **Overlapping:** Pieces of *different* colors can touch freely (both edges and corners), but no two pieces can occupy the exact same square on the grid.
4. **Passing:** If a player cannot place any of their remaining pieces on the board, they must pass their turn. Once passed, they are skipped for the rest of the game.
5. **Winning & Scoring:** The game ends when all players are blocked or have placed all their pieces. The winner is the player with the highest score (most individual square units placed on the board).

---

## ✨ Features
* **Zero-Build Architecture:** No Node.js, Webpack, or complex build steps. Just open `index.html` in any modern web browser to play.
* **Responsive & Mobile Friendly:** Adapts seamlessly to desktop and mobile screens. Features a touch-optimized UI where players select a piece, position a "ghost preview", manipulate it, and confirm placement, preventing frustrating accidental drops.
* **Local Multiplayer:** Pass and play with friends on the same device.
* **Built-in AI:** Play against heuristic-based AI opponents. Fill empty seats with AI in both local and network games.
* **Online Multiplayer (P2P):** Play with friends over the internet with absolutely zero dedicated server hosting. Uses **WebRTC** to create direct peer-to-peer connections between browsers.
* **Interactive Preview:** Rotate and flip pieces before committing to a move, with real-time visual feedback on whether a placement is legally valid (Green = Valid, Red = Invalid).

---

## 🎮 How to Play

### Local Game
1. Click **Local Play** on the main menu.
2. Select who is controlling each color (Local Human or Local AI).
3. Click **Start Game**.

### Hosting an Online Game
1. Click **Host Online Game**.
2. Share the generated **6-character Room ID** with your friends.
3. Use the dropdowns to allocate slots to "Open (Network)", which allows remote players to join your game.
4. Once everyone has connected, click **Start Game**.

### Joining an Online Game
1. Click **Join Online Game**.
2. Enter the **Room ID** provided by the host.
3. Wait for the host to start the match.

---

## 🛠️ Code Structure Breakdown

The entire application runs from one `index.html` file, split into the following logical sections:

### 1. HTML Layout & Styling
* Uses **TailwindCSS** (via public CDN) for rapidly building responsive, grid-based layouts without writing custom CSS.
* Features a view-switching system (`#screen-main`, `#screen-lobby`, `#screen-game`) to handle UI state navigation.

### 2. Game Constants & Data (`SHAPES_DATA`)
* Contains the binary matrices defining all 21 standard Blokus polyominoes.
* Defines the 4 player colors and their starting corner coordinates on the 20x20 grid.

### 3. Core Logic & Matrix Math
* **Transformations:** Functions to calculate piece rotations (`rotateMatrix`) and horizontal flips (`flipMatrixH`).
* **Validation (`isValidMove`):** The heart of the game logic. Checks grid bounds, collision detection, the first-turn corner rule, and enforces the strict corner-to-corner and anti-edge rules.

### 4. Heuristic AI
* **Move Generation (`getAllValidMoves`):** Rather than brute-forcing the entire 20x20 grid, the AI scans for exposed valid corners, generating a list of all legally playable spots.
* **Decision Making (`runAITurn`):** Evaluates all legal moves, sorts them by piece size, and prioritizes placing the largest available piece first (a standard beginner Blokus strategy).

### 5. UI Rendering & Interaction
* Uses HTML5 `<canvas>` elements to draw the game board and the individual piece inventory.
* Implements drag-friendly touch events mapping screen coordinates to the internal grid matrix.

### 6. Networking & PeerJS
* Relies on **PeerJS** to abstract WebRTC connection flows.
* **Host Authority:** The Host acts as the central source of truth. It receives move requests from clients, validates them locally, updates the master state, and broadcasts the new board to all connected peers (`STATE_UPDATE`).

---

## 📜 Credits
* **Styling framework:** [Tailwind CSS](https://tailwindcss.com/)
* **P2P Networking:** [PeerJS](https://peerjs.com/)
* **Development:** Built via prompt-driven development utilizing Google's Gemini Pro 3.1.