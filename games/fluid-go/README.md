# Fluid Go

Fluid Go is an experimental tabletop strategy game variant of Go. Unlike traditional Go, which is played on discrete grid intersections, Fluid Go utilizes a **continuous influence field**. While it retains the core concepts of territory and capture, the physical manifestation of the "stones" is fluidic and dynamic.

## 1. What This Is
Fluid Go is an exploration of how classical board game logic changes when the environment becomes continuous rather than discrete. Stones are not just points on a grid; they are sources of an influence field that can flow, merge, and compete for space.

## 🕹 How to Play

### Basic Rules
* **Turn-based play:** Black and White alternate placing stones.
* **Group Connectivity:** Stones placed near each other (within the connectivity radius) automatically merge into a single "group."
* **Influence Generation:** Every stone generates a Gaussian-style density field. Multiple stones of the same color create a stronger, larger fluid mass.
* **Capture Mechanics:** A group is captured and removed if its entire boundary is submerged by the opponent's fluid density. As long as a portion of the group's perimeter remains "free" (not overwhelmed by opponent influence), the group survives.
* **Suicide Rule:** You cannot place a stone that results in your own group having zero liberties, unless that move captures an opponent's group.

### Controls
* **Snap Placement (Default):** Click to place stones precisely on the nearest 19x19 grid intersection.
* **Free Placement:** Hold `Shift` while clicking to place stones anywhere on the continuous board.
* **Touch Controls:** Drag to preview stone placement and release to place. Use the "Snap: ON/OFF" button to toggle behavior on mobile.
* **Pass/Reset:** Use the UI buttons to skip a turn or restart the match.

## 🛠 Technical Implementation

### 1. Fluid Simulation (Metaballs)
The "fluid" visualization is achieved using a Metaball-style approach:
* **Gaussian Influence:** Each stone's influence follows $f(d) = I_{max} \cdot e^{-\frac{d^2}{2\sigma^2}}$.
* **Performance Optimization:** Gradients are pre-calculated onto offscreen "stamps." Instead of calculating the exponential function for every pixel every frame, the engine blits these stamps using additive blending (`globalCompositeOperation = 'lighter'`).
* **Thresholding:** A sharp alpha threshold is applied to the combined influence map to create the distinct, liquid-like edges of the stone groups.

### 2. Group & Liberty Logic
* **Connectivity:** The engine uses a Breadth-First Search (BFS) to identify connected stones based on a physical distance threshold.
* **Liberty Sampling:** To check for capture, the engine samples points in a circular perimeter around every stone in a group. It compares the owner's influence value against the opponent's at these sample points. If the opponent's influence is stronger than the threshold and the owner's influence, that point is considered "submerged."

### 3. Canvas Architecture
* The entire game runs in a single `<canvas>` element.
* **Offscreen Buffers:** Separate offscreen canvases are used to cache the board grid and the fluid map, ensuring the game maintains 60 FPS even as the number of stones increases.

## 📜 Credits & Reference
This project is a recreation of the "Fluid Go" concept originally developed by [WangNianyi2001](https://github.com/WangNianyi2001/Fluid-Weiqi). This version is optimized for a zero-dependency, single-page web environment using standard HTML5, CSS3, and JavaScript.