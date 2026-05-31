# CS DM

Static GitHub Pages deathmatch prototype for CS DM.

## Play Modes

- Offline play is the reliable baseline: the local match runs as a 16-slot free-for-all with bots and does not require any network connection.
- Online P2P is best-effort manual WebRTC: host and joiner copy/paste offer and answer codes, with no third-party relay, TURN server, signaling broker, backend, or matchmaking service.
- Browser, NAT, and firewall behavior can prevent P2P connections. If a manual code is malformed, a room is full, the connection times out, a peer disconnects, the host closes, or protocol versions mismatch, the UI reports a recoverable error and offline bots remain available.

## Local Verification

Run from the repository root:

```sh
npm run test
```
