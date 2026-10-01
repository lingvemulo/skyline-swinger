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
- Heading-up mini-map (top right) showing buildings and door dots by type
- Walk-in buildings: every building has a lit shop-style entrance (glass doors,
  coloured canopy, HOTEL/APARTMENTS/SHOP/OFFICE sign) on its most open side.
  Each is a hotel, apartment block, shop or office with 3 floors (stairs + elevator with a
  floor-button panel) and a top-floor door out to the building's real rooftop
  (rooftop stair hut leads back in). Interior code lives in `src/interiors.js`.
- Add `?debug` to the URL to expose a `window.__ss` test hook (teleport,
  joystick, enter buildings) for testing from a desktop browser
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
