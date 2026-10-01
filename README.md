# Skyline Swinger

An original web-swinging 3D browser game (Three.js + React), built for touch controls on iPhone.

## Current features

- Free-roam low-poly city (Meridian City) with procedural building facades and a
  gradient sky
- Web-swing traversal with soft rope physics (hold WEB, drag to add momentum)
- Touch controls: left-side virtual joystick to move, right-side drag to look,
  WEB / JUMP / FIGHT buttons
- Patrolling robotic enemies ("Voltbots") with basic chase AI and melee combat
- 40 collectible energy orbs
- Walk-in building doors: some buildings have a glowing doorway leading to a
  furnished interior lobby, with a matching door to head back outside
- Walk-cycle limb animation, camera bob, filmic tone mapping

## Stack

- React 18 + Vite
- Three.js (imported directly, not a CDN script — avoids cross-origin script
  errors in sandboxed previews)
- Single main component: `src/App.jsx`

## Local development

```bash
npm install
npm run dev
```

## Still to do

- Deploy to Cloudflare (Workers static assets, since Pages is being
  consolidated into Workers)
- Push to GitHub
- Possibly split `App.jsx` into smaller modules as it grows (currently one file
  for portability between chat sessions)
