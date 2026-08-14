# CS 1.6 Research Dossier: HUD, Bots, Audio & Hitboxes

> Comprehensive reference compiled from Valve Developer Community, CS wiki, PODBot/YaPB source code, ReGameDLL, and community documentation.
> Date: 2026-06-04

---

## 1. HUD LAYOUT (CS 1.6 @ 1024x768 reference)

CS 1.6 uses sprite-based HUD elements defined in `sprites/hud.txt`. Coordinate system: (0,0) is top-left. High-resolution sprites = `640hud1.spr` through `640hud9.spr`. At 1024x768, base HUD coordinate space = 640x480 then the engine scales.

### 1.1 Radar (Overview)
- **Position**: Top-left corner
- **Shape**: Square/rectangular, approx 120x120 px area (occupies top-left ~1/6 screen width)
- **Appearance**: Green-tinted, two zones -- lighter green 90-degree sector (your view cone) + darker green background
- **Rotation**: Radar is static; CONTENTS rotate so the light-green cone always points forward
- **Teammates**: Same level = white dots; Above = white "T"; Below = inverted white "T"
- **Enemy blips**: Fading red blip appears temporarily when teammate spots enemy
- **Bomb**: Carrier = orange square (T only); Planted = blinking orange X; Dropped = blinking orange (all visible)
- **Death markers**: "X" marks teammate deaths (blue CT, red T), short duration
- **Speaking indicator**: Teammate blip flashes on voice/radio
- **Console**: `cl_radartype 0/1` (solid/transparent), `cl_radar 1` (enable)
- **Config**: Overview images in `cstrike/overviews/` as .bmp + .txt descriptors (zoom/origin/rotation)
- Aspect ratio for radar is hardcoded to 4:3 in GoldSrc engine

### 1.2 Health Display
- **Position**: Bottom-left area
- **Format**: Numerical value with red "+" icon (cross/health symbol)
- **Coordinate** (Half-Life SDK HudLayout.res): xpos=16, ypos=432 from top-left
- **Color**: White numbers default; icon turns yellow/orange below ~50 HP, pulses red below ~20 HP
- No health bar -- numeric readout only
- Low health: screen gains red tint/border (damage overlay)

### 1.3 Armor Display
- **Position**: Below or next to health, bottom-left
- **Format**: Numerical value with shield/vest icon
- **Text**: "AR" abbreviation + numeric value
- **Color**: Light blue/white numbers
- Shown if armor > 0 (max 100), hidden if armor = 0

### 1.4 Ammo Display
- **Position**: Bottom-right area
- **Format**: `Clip / Reserve` (e.g., `30 / 90`)
- **Coordinates** (Source SDK HudLayout.res): xpos=r150 (150px from right), ypos=432; wide=136, tall=36
- **Weapon name**: Above the ammo numbers
- **Weapon icon**: Small sprite above/beside ammo readout
- Out of ammo: numbers turn red
- Secondary ammo (M4 silencer/USP): further right at xpos=r76, wide=60, tall=36

### 1.5 Money Display
- **Position**: Bottom-right (below ammo or same row depending on HUD version)
- **Format**: `$XXXX` amount
- **Color**: Green when enough for buy, white otherwise
- Buy zone indicator: shopping cart icon when in buy zone
- Money tracking: server-side, updates via network messages

### 1.6 Crosshair
- **Default color**: Bright green (RGB ~50, 250, 50)
- **Size**: `cl_crosshair_size 1/2/3`
- **Dynamic**: `cl_dynamiccrosshair 1` expands when moving/shooting, contracts when still
- **Translucency**: `cl_crosshair_translucent 1`
- **Custom colors**: `cl_crosshair_color "R G B"` (0-255)
- Changes based on weapon accuracy
- Resolution affects appearance: at 1024x768 sharper/thinner than 640x480

### 1.7 Round Timer / Clock
- **Position**: Top-center
- **Format**: `MM:SS` countdown
- **Default**: 1:45 (competitive), 2:00 (casual), 5:00 (standard)
- Turns red in last 10 seconds, pulses
- Server cvar: `mp_roundtime`

### 1.8 Killfeed (Death Notice)
- **Position**: Top-right
- **Format**: `[weapon icon] KillerName -> VictimName`
- **Max entries**: 5-6 (controlled by `hud_deathnotice_max` in modded clients)
- **Fade**: ~5s fully visible, then ~1s fade to transparent
- **Team colors**: T names orange/red, CT names blue/cyan
- Headshot symbol shown for headshot kills
- Weapon kill icons from sprite sheets in `sprites/`
- Source: `CHudDeathNotice` class in `cl_dll/hud.h`

### 1.9 HUD Sprite Files
- Low-res (<=512x384): 320hud1.spr - 320hud6.spr, 320_pain.spr, 320_train.spr
- High-res (>512x384): 640hud1.spr - 640hud9.spr, 640_pain.spr, 640_train.spr
- Sprite definitions in `sprites/hud.txt`: `name res sprfile x y width height`
- CS-specific: Separate weapon sprite files (e.g., 640hudap1.spr)
- Text rendered in Half-Life console font (small bitmap monospace)

---

## 2. KILLFEED FORMAT

### 2.1 Message Format
- Sent from server to client via `DeathMsg` network message
- Format: `[weapon icon sprite] KillerName -> VictimName`
- Weapon icon on the left
- Killer name next, then death indicator
- Victim name on the right
- Team colors: T = red/orange, CT = blue/cyan

### 2.2 Weapon Kill Icons
- Every weapon has its own unique HUD sprite for the killfeed
- Headshot kills show crosshair/headshot symbol
- Wallbang kills show penetration icon (modded versions)
- Knife kills show knife icon

### 2.3 Entry Lifetime
- Maximum visible: ~5-6 (hardcoded in client)
- Fully visible for ~4-5s, then fade over ~1s
- New entries push older ones up; oldest removed when exceeding max

### 2.4 Implementation
- `CHudDeathNotice` class in `cl_dll/hud.h` with `m_HUD_d_skull` sprite
- `MsgFunc_DeathMsg` handles incoming death messages
- `Draw(float flTime)` renders notices with fade alpha
- Modded clients (NextClient) support extended headers: wallbang-through-smoke, no-scope, jumping, dominating/revenge

---

## 3. BOT AI

### 3.1 Bot Systems for CS 1.6
1. **PODBot** (original) -- by Markus "Count Floyd" Klinge. Uses `.pwf` waypoint files
2. **PODBot MM** -- Metamod continuation: `.pwf` + `.pxp` (experience) + `.pvi` (visibility)
3. **YaPB** (Yet Another POD-Bot) -- Active fork from PODBot source. Uses `.pwf` and `.graph` format

### 3.2 Navigation: Waypoint System
Bots **cannot** navigate without waypoints in CS 1.6 (CPU too intensive for real-time navmesh).

**Waypoint files:**
- `.pwf` -- Main waypoint data (positions, connections, flags)
- `.pvi` -- Visibility table (auto-generated)
- `.pxp` -- Experience data (damage/danger per waypoint per team)
- `.graph` -- YaPB modern format (2048+ nodes, vertical camp directions)

**Waypoint types (flags):**
| Type | Color | Purpose |
|------|-------|---------|
| Normal (N) | Green | Basic navigation |
| Camp (C) | Cyan | Stop and watch arc between start/end angles |
| Goal (G) | Blue | Objective (bombsite, hostage rescue) |
| Rescue (R) | Yellow | Hostage rescue pickup |
| Ladder (L) | Orange | On a ladder |
| Jump (J) | Red | Must jump to reach next node |
| Crouch | -- | Must crouch at this point |
| T-specific | Coral (YaPB) | Only Terrorists use |
| CT-specific | Cornflower (YaPB) | Only CTs use |

**Waypoint structure** (from `waypoint.cpp`):
```
paths[i]->origin = player position
paths[i]->flags = W_FL_NORMAL | W_FL_CAMP | ...
paths[i]->Radius = computed radius (0-128 units)
paths[i]->index[j] = connected waypoint index
paths[i]->connectflag[j] = connection type
```

**Wayzone radius**: Scans 32-128 units in 16-unit increments at 360 degrees with 20 degree steps. Obstacles shrink radius. CAMP/GOAL/LADDER/RESCUE/CROUCH get radius = 0.

**Camp waypoint behavior**: Bot approaches, faces Camp start direction, scans arc between start/end markers. Changes focus every few seconds. Only hears enemies outside the arc.

### 3.3 Bot Thinking Cycle (from `bot.cpp`)
```
float g_flBotCommandInterval = 1.0 / 30.0;   // 30 times/sec
float g_flBotFullThinkInterval = 1.0 / 10.0; // Full AI 10 times/sec
```

**BotThink() loop:**
1. **Upkeep()** -- every 1/30s: movement, button states
2. **Update()** -- every 1/10s: full AI (goal, targeting, combat)
3. **ExecuteCommand()** -- sends movement + buttons to engine

**Jump mechanics:**
- `minJumpInterval = 0.9s`
- `sanityInterval = 0.3s` (absolute min between jumps)
- `IsJumping()` returns true for 1.0s after jump, or until `FL_ONGROUND`

### 3.4 Combat Behavior
- Hears enemy fire: immediately turns toward shooter
- Difficulty-dependent delay before threat recognition
- With enemy in sight: difficulty determines aim speed/accuracy

**Aiming system** (PODBot MM spring-damper):
```
pb_aim_spring_stiffness_x 13.0     pb_aim_spring_stiffness_y 13.0
pb_aim_damper_coefficient_x 0.22   pb_aim_damper_coefficient_y 0.22
pb_aim_deviation_x 2.0             pb_aim_deviation_y 1.0
```

**Aim types (1-4):**
1. Inhuman turns (instant 100%)
2. Constant angle velocity
3. botaim1 (old PID)
4. botaim2 (spring-damper -- DEFAULT, most human-like)

**Accuracy by skill:**
- Low skill: aim legs/torso
- High skill: aim head
- Skill 100: near-instant headshots
- `aimError` (x,y,z) offsets add inaccuracy

**Wall shooting**: `yapb_shootthruwalls 1` enables wall penetration attacks. Controlled by `seenThruWallChance` / `heardThruWallChance`.

### 3.5 Bot Personalities
- **Normal (0)**: Balanced
- **Aggressive (1)**: Rushes, pushes, uses knife at close range
- **Defensive/Careful (2)**: Camps more, falls back, seeks cover

### 3.6 Difficulty Parameters (YaPB)
```
Level = minReactionTime, maxReactionTime, headshot%, seenThruWall%, heardThruWall%, maxRecoil, aimError(x,y,z)

Newbie       = 0.6, 1.2, 15,  10, 10, 21, 3.0, 4.5, 1.0
Average      = 0.4, 0.8, 30,  25, 25, 18, 2.0, 3.0, 0.8
Normal       = 0.2, 0.5, 60,  50, 50, 18, 1.0, 1.5, 0.5
Professional = 0.1, 0.3, 85,  70, 70, 18, 0.2, 0.4, 0.1
Expert       = 0.1, 0.2, 100, 90, 90, 21, 0.0, 0.0, 0.0
```

**Summary**: Lower skill = longer pauses, bigger surprise time, slower shooting, worse accuracy. Skill > 80 = uses knife more in close range.

### 3.7 Buying Behavior
- Evaluate money, team needs, current loadout
- Buy rifles when enough money, SMGs/pistols on eco
- Decision at spawn in buy zone
- Restricted by `yapb wpnmode` cvars

### 3.8 Grenade Usage
- **Flashbang**: Before entering known enemy areas
- **HE**: At groups or known positions
- **Smoke**: Block sight lines before crossing
- Timing: `pb_timer_grenade 0.5` (check every 0.5s)

### 3.9 Objective Behavior
- **T**: Plant C4 at bombsite (goal waypoints)
- **CT**: Defuse bomb or rescue hostages
- **Goal selection**: Dynamic by personality, health, nearby teammates, equipment
- **Bomb carrier**: Issues "Follow Me" radio command for escort

### 3.10 Reaction to Teammate Death
- Becomes alert, checks radar death marker
- Knows approximate enemy position
- Aggressive: pushes toward kill location
- Defensive: takes cover, watches direction

### 3.11 Radio Commands Response
| Command | Reaction |
|---------|----------|
| "Follow Me" | Bots follow (max 3 default) |
| "Hold Position" | Follower stops and watches |
| "Go Go Go" | Stop follow/camp, rush forward |
| "Taking Fire, Need Assistance" | All free bots rush to position |
| "Need Backup" | Distance-limited assistance |
| "Storm the Front" | Increase aggression, rush aimed direction |
| "Get in Position" | Take covered position, wait |
| "Fall Back" | Increase fear, seek cover |

---

## 4. AUDIO SYSTEM

### 4.1 Footstep Sounds
Defined in `sound/materials.txt` mapping texture prefixes to material types:

| Prefix | Material | Sound files |
|--------|----------|-------------|
| (default) | Concrete | `player/pl_dirt1-4.wav` |
| M | Metal | `player/pl_metal1-4.wav` |
| V | Ventilation | `player/pl_duct1-4.wav` |
| S | Slosh/Water | `player/pl_slosh1-4.wav` |
| T | Tile | `player/pl_tile1-4.wav` |
| G | Grate | `player/pl_grate1-4.wav` |
| W | Wood | `player/pl_wood1-4.wav` |
| P | Computer | `player/pl_computer1-4.wav` |
| Y | Glass | `player/pl_glass1-4.wav` |
| F | Flesh | `player/pl_flesh1-4.wav` |

**Timing**: Walking volume=0.2, interval=400ms; Running volume=0.5, interval=300ms. Each surface has 4 variant sounds. Water wading: 600ms interval, volume=0.65. Ladder: 0.35 volume, 350ms interval.

### 4.2 Weapon Sounds
- **AK-47**: Loud, distinct crack, 7.62mm report
- **M4A1**: Sharper, snappier. Silenced: muffled "pop"
- **AWP**: Extremely loud, booming -- audible map-wide
- **Desert Eagle**: Heavy, booming pistol shot
- **USP**: Dull thud unsilenced; quiet "phut" silenced
- **Glock**: Higher-pitched, tinnier
- **Knife**: "Slash" swing; wet "stab" for secondary

**Audibility distances**: AWP = global (2000+ units); AK/M4 = ~1500-2000; SMGs = ~1000-1500; Pistols = ~750-1000; Knife swing = ~500, stab = ~750. Sound travels through walls (non-occluded engine).

### 4.3 Sound Propagation (GoldSrc)
- **No occlusion** -- sound travels through solid objects at full volume
- **Distance attenuation**: Volume = base * (1 - distance/max_distance)
- Channel system: CHAN_WEAPON, CHAN_VOICE, CHAN_BODY, CHAN_ITEM, CHAN_STATIC
- No HRTF in original; MetaAudio plugin adds OpenAL HRTF support
- Players use sound-through-walls for "wallbanging" intel

### 4.4 Radio Commands
Three menus: Z (RadioA), X (RadioB), C (RadioC). Files in `sound/radio/` as .wav.

### 4.5 Bomb Audio
- Plant beep: ~1s interval, accelerates as detonation approaches
- Last 10s: rapid beeping
- Defuse: distinct hissing sound
- Plant: brief electronic arming sequence
- All bomb sounds audible map-wide

---

## 5. PLAYER HITBOX SYSTEM

### 5.1 Hitbox Structure
CS 1.6 uses bounding box hit detection (not capsules). Hitboxes are **larger than the visible model** in some areas.

| Hitbox | Damage Multiplier | Notes |
|--------|------------------|-------|
| Head | 4.0x (400%) | Instant kill potential |
| Chest | 1.0x (100%) | Same as arms |
| Arms | 1.0x (100%) | Upper arms, forearms, hands |
| Stomach | 1.25x (125%) | Lower torso |
| Pelvis | 1.25x (125%) | Hip/groin |
| Legs | 0.75x (75%) | Thighs, calves, feet |

**Critical**: Bullet registers only the FIRST hitbox contacted (unlike CS:GO which can pass through multiple).

### 5.2 Hitbox Alignment
Hitboxes extend outside the visible model in CS 1.6. Tool: `rehlds/hitboxtracker` with `r_drawentities 3-7` to visualize.

### 5.3 Damage Formula
```
EffectiveDamage = BaseDamage x HitboxMultiplier x ArmorPenetration
Armor absorbs = min(Damage x (1 - AP%), Armor remaining)
Health damage = Damage - Armor absorbed
```

**Armor coverage**: Kevlar = chest/arms/stomach/pelvis. Helmet = head. **Legs never protected.**

### 5.4 Weapon Damage Table (Unarmored / Armored)
| Weapon | Head | Chest | Stomach | Leg | AP% |
|--------|------|-------|---------|-----|-----|
| AK-47 | 140 / 108 | 35 / 27 | 43 / 33 | 26 / 26 | 77.5% |
| M4A1 | 130 / 72 | 32 / 18 | 40 / 22 | 24 / 24 | 70.0% |
| AWP | 460 / 414 | 115 / 103 | 143 / 129 | 86 / 86 | 90.0% |
| Deagle | 212 / 159 | 53 / 39 | 66 / 49 | 39 / 39 | 73.8% |
| USP | 132 / 66 | 33 / 16 | 41 / 20 | 24 / 24 | 48.6% |
| Glock | 76 / 39 | 19 / 9 | 23 / 11 | 14 / 14 | 49.6% |
| MP5 | 104 / 35 | 26 / 9 | 32 / 11 | 20 / 20 | 50.0% |
| Knife swing | 80 / 68 | 20 / 17 | 25 / 21 | 15 / 15 | 84.8% |
| Knife stab | 260 / 220 | 65 / 55 | 65 / 55 | 65 / 55 | 84.6% |
| Scout | 300 / 225 | 75 / 56 | 93 / 70 | 56 / 56 | 89.0% |
| M249 | 136 / 100 | 34 / 25 | 42 / 25 | 25 / 25 | 68.2% |
| P228 | 124 / 77 | 31 / 19 | 38 / 19 | 23 / 23 | 57.0% |
| FAMAS | 114 / 58 | 28 / 14 | 35 / 18 | 21 / 21 | 65.2% |
| Galil | 112 / 58 | 28 / 14 | 35 / 18 | 21 / 21 | 63.6% |
| AUG | 122 / 68 | 30 / 17 | 37 / 21 | 22 / 22 | 70.0% |
| SG-552 | 124 / 75 | 31 / 19 | 38 / 23 | 23 / 23 | 72.0% |

### 5.5 Armor Penetration
- Higher AP% = more damage through armor
- AWP 90% AP: almost ignores armor
- MP5 ~50% AP: armor cuts damage in half
- AK-47 77.5% AP: enough for one-shot headshot through helmet

### 5.6 Wall Penetration (Wallbanging)
- **Penetrating**: AK-47, M4A1, AWP, Deagle, Scout, SG-552, AUG, G3SG1, M249
- **Non-penetrating**: All SMGs, shotguns, pistols (except Deagle), knife
- **Damage reduction**: ~33-40% per wall
- **Range reduction**: ~30% per surface
- Power ranking: AWP > AK-47 > M4A1 > Deagle > Scout

### 5.7 Movement Speed
| Equipment | Speed (units/s) |
|-----------|----------------|
| Knife/Pistols | 250 |
| SMGs | 240-250 |
| Scout | 260 |
| Shotguns | 240 |
| Rifles (AK, M4, AUG, SG) | 215-221 |
| AWP | 200 (150 scoped) |
| M249 | 200 |
| Shield | 180 |

### 5.8 Tagging Mechanic
When hit by bullets, movement speed is temporarily reduced:
- Light weapons: 15-25% slow
- Heavy weapons: 30-50% slow
- Effect increases with rate of fire
- Decays over ~1-2 seconds after last hit

---

## 6. KEY REFERENCES

### HUD
- ValveSoftware/halflife, `cl_dll/hud.h`
- ValveSoftware/source-sdk-2013, `game/mod_hl2mp/scripts/HudLayout.res`
- TWHL Wiki: "Tutorial: Modifying the HUD"
- Counter-Strike Wiki: Hitbox, Footsteps, Kill Feed, Weapons

### Bots
- APGRoboCop/podbot_mm -- PODBot MM full source
- yapb/yapb -- YaPB active fork
- ValveSoftware/halflife, `game_shared/bot/bot.cpp`
- FWGS/regamedll -- ReGameDLL_CS
- YaPB Documentation (yapb.readthedocs.io)

### Audio
- GoldSrc Audio Tutorial (the303.org)
- FreeSlave/halflife-featureful Wiki: Materials
- Counter-Strike Wiki: Footsteps
- MundoMapper texture tutorial

### Hitboxes & Weapons
- Counter-Strike Wiki: Hitbox
- Afghan Mujahedeen's CS Weapon Damage Chart
- ReGameDLL_CS `weapons.h`
- StrategyWiki: Counter-Strike/Equipment
- csdownload.net guides

### Key Repositories
- https://github.com/ValveSoftware/halflife
- https://github.com/APGRoboCop/podbot_mm
- https://github.com/yapb/yapb
- https://github.com/rehlds/ReGameDLL_CS
- https://github.com/FWGS/regamedll
- https://github.com/rehlds/hitboxtracker
- https://github.com/FreeSlave/halflife-featureful