# Tenku

**Your commits, as a place.**

Type a GitHub username and walk through it. Repositories become floating islands
in a dusk sky, activity becomes light, and the whole archipelago is readable —
every visual property maps to a real number from the GitHub API.

A revamp of the "GitHub 3D world" idea, rebuilt from scratch with a different
visual thesis: an astronomical instrument at dusk rather than a neon game HUD.

---


## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
npm run typecheck  # tsc --noEmit
```

Node 18+. No API keys required to start — the app reads GitHub's public REST API
unauthenticated.

### Rate limits

Unauthenticated GitHub allows **60 requests per hour per IP**, and each world
costs 4 requests. That is fine for a personal demo and not fine for a launch.

Two ways to raise it to 5,000/hour:

1. **Per visitor.** The entry screen has an optional token field. It stores the
   token in `localStorage` only and sends it nowhere except `api.github.com`.
2. **For the deployment.** Copy `.env.example` to `.env` and set
   `VITE_GITHUB_TOKEN`. **Note:** Vite inlines `VITE_*` variables into the client
   bundle, so this token is public. Only ever use a token with **zero scopes**,
   and prefer a small proxy for anything real.

When the limit is hit the app does not dead-end — it explains the situation and
offers the bundled demo world, which is generated locally and touches no network.

---

## How to read the world

Nothing here is decorative. Every property is a number from the API:

| What you see | What it means |
| --- | --- |
| Monolith height | Stars (log scaled) |
| Island width | Forks |
| Altitude | How recently the repo was pushed — fresh floats high, dormant sinks |
| Colour | Primary language |
| Debris ring density | Open issues |
| Bridge pulse rate | How alive the repo is — daily pushes fire fast, dead repos barely flicker |
| Ring distance from centre | Rank by stars: your best-known work orbits closest |
| Central obelisk height | Total stars across all repositories |
| Pillars around the hub | One per day of public activity over the last 90 days |

### On the activity ring

GitHub's REST API does **not** expose the contribution graph. Tenku builds an
honest substitute from `/users/{login}/events/public` — a weighted count of
public events per day over the last 90 days, where a push carrying twelve commits
reads heavier than a single star. The UI always calls this "public activity",
never "contributions", because they are not the same thing.

---

## Controls

**Orbit** (default) — drag to look, scroll to close in, click an island to visit
it. `Esc` returns to the whole archipelago. `[` and `]` step between islands.

**Flight** — `F` to toggle, then click the view to take pointer lock.
`WASD` to fly, `Space`/`C` for altitude, `Shift` to sprint, click to visit
whatever is centred in the crosshair.

The reticle is the navigation instrument: a brass ring with a tick at every
island's true bearing. Bring one to the top of the ring and its name is written
out. That is how you find a repository you cannot currently see.

---

## Architecture

React owns the interface; a plain three.js engine owns the scene. They are
deliberately not fused — no react-three-fiber, no reconciler in the render loop.
The engine runs its own `requestAnimationFrame` and never triggers a React
render; the HUD components that need per-frame data (the reticle, the radar)
subscribe with their own rAF and mutate DOM directly.

```
src/
├── config/site.ts            single source of branding, palette, world constants
├── lib/
│   ├── github.ts             API client, token handling, typed error states
│   ├── mock.ts               offline demo dataset
│   ├── derive.ts             GitHub data → world layout
│   ├── languages.ts          language → in-palette colour
│   └── math.ts               damping, seeded RNG, easing, formatting
├── three/
│   ├── Engine.ts             renderer, scene, raycasting, labels, frame loop
│   ├── CameraRig.ts          orbit + flight modes, bezier cinematics
│   ├── types.ts
│   ├── objects/
│   │   ├── Island.ts         procedural landmass, monolith, debris ring
│   │   ├── HubIsland.ts      obelisk + instanced activity pillars
│   │   └── Bridges.ts        tube geometry with travelling pulses
│   ├── fx/
│   │   ├── Sky.ts            gradient dome + matched directional light
│   │   ├── Starfield.ts      instanced points with per-star twinkle
│   │   └── Atmosphere.ts     drifting motes + the aether cloud sea
│   ├── shaders/              all GLSL, one file per effect
│   └── post/Composer.ts      bloom + custom grade pass
├── ui/                       React HUD
└── styles/index.css          Tailwind layers + bespoke component classes
```

### Rebranding

`src/config/site.ts` holds the name, tagline, seed usernames, palette, and world
generation constants. Nothing else hardcodes a product name. The palette hexes
are duplicated in `tailwind.config.js` for utility classes — keep the two in sync.

---

## Design

**Direction:** astronomical instrument at dusk. Brass, ember, indigo, bone —
deliberately not the cyan/magenta cyberpunk default that 3D developer tools reach
for. The HUD is framed as an astrolabe, not a game overlay.

**Type:** Bodoni Moda (display) / Archivo (interface) / IBM Plex Mono (data).
The high-contrast didone is doing the work of a 19th-century star atlas plate;
the mono keeps every number legible next to it.

**Signature:** the bearing reticle. It is the one loud element, and everything
around it is kept quiet on purpose.

---

## Performance

Three quality presets in the settings panel:

- **High** — bloom + film grade, device pixel ratio capped at 2
- **Balanced** — same passes, DPR capped at 1.5
- **Low** — post-processing off, DPR 1

The frame counter turns amber below 30 fps. Rendering pauses entirely when the
tab is hidden, and `dt` is clamped so returning to a backgrounded tab does not
teleport the world.

`prefers-reduced-motion` is respected throughout: the opening flight is skipped
in favour of a cut, island bob and ring rotation stop, and CSS transitions are
reduced to zero.

---

## Known limits

- 22 islands maximum. Beyond that the archipelago stops being readable; the
  remainder are counted in the profile panel. Raise `world.maxIslands` in
  `site.ts` if you disagree.
- The activity ring only covers 90 days, because that is roughly as far back as
  the public events endpoint reaches.
- Organisations are not handled specially — `/users/{login}` returns org data,
  but the follower counts read oddly.
- WebGL is required. There is no 2D fallback.

---

## Licence

Your call — nothing here is licensed yet. The fonts are Google Fonts (SIL Open
Font License). three.js is MIT.
