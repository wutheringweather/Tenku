# Dev brief — Canopy

Written for whoever picks this up next. Covers the parts that are not obvious
from reading the code, the traps, and where to extend.

---

## 1. The two-world split

The single most important structural decision: **React never renders inside the
frame loop.**

- `Engine` owns `requestAnimationFrame`. It renders three.js and CSS2D labels.
- React renders the HUD once per state change — selection, phase, mode, fps.
- Components that need 60fps data (`Reticle`, `Radar`) run their **own** rAF,
  read from `engineRef.current`, and mutate `SVGElement` attributes directly.

If you add a HUD element that follows the camera, follow the same pattern. Do
**not** lift per-frame values into React state — 22 islands × 60fps will make
the interface stutter long before the 3D scene does.

---

## 2. Data flow

```
username
  → lib/github.ts fetchProfileBundle()      4 requests, reports progress
  → ProfileBundle { profile, repos, activity }
  → lib/derive.ts deriveWorld()             pure function, no side effects
  → WorldSpec { islands[], totalStars, overflow }
  → Engine.build(spec)                      constructs meshes, starts sequence
```

`deriveWorld` is pure and deterministic — the same repo always produces the same
island, because every random value is seeded off `hash(repo.fullName)`. That
matters: it means a user's world looks identical every time they load it, and
screenshots stay reproducible.

**If you change the placement rules, change the legend.** The "Reading the
world" table in `ProfilePanel.tsx` and the table in the README both document the
mapping. A world that lies about what it shows is worse than no world.

---

## 3. The materialisation sequence

`Engine.runSequence(dt)` is a hand-rolled timeline, not a tween library.

```
t=0.0   camera starts below the cloud sea at (-14, -96, 44)
t=0.2   sunrise begins, 3.6s ramp
t=0.35  hub heartwood starts rising
t=0.6   aether sea fades in
t=1.0   islands begin materialising, 0.14s stagger by star rank
t=1.4   motes fade in
t=5.4   camera cinematic completes → onReady() → phase 'world'
```

Two clocks run in parallel here and they are tuned to land together: the
`runSequence` stagger total (`1.0 + islands × 0.14 + 1.6`) and the camera's
`openingSequence` duration (5.4s). **If you change the island count cap or the
stagger, retune the camera duration** or the HUD will appear while islands are
still assembling.

Under `prefers-reduced-motion` the camera cut is instant and the stagger drops
to 0.02s.

---

## 4. Shader gotchas

All GLSL lives in `src/three/shaders/`, as template strings. Nothing precompiles
them, so **a syntax error is a white screen, not a build failure.** Check the
console first when the scene goes blank.

- `crystalVert` expects geometry in **unit space with y ∈ [0, 1]**. The
  `CylinderGeometry` is translated up by 0.5 for exactly this reason, so the
  reveal animation scales from the base rather than the centre. If you swap the
  geometry, translate it the same way.
- The debris ring geometry has an **all-zeros `position` attribute**. Positions
  are computed in the vertex shader from `aAngle`/`aRadius`. The bounding sphere
  is therefore set manually — without it three.js frustum-culls the ring the
  moment the camera moves.
- `bridgeFrag` relies on `TubeGeometry`'s UV layout: `vUv.x` runs along the tube
  length. Swap the geometry and the pulse direction breaks.
- Everything additive is `depthWrite: false`. Keep it that way; enabling depth
  writes on the stems/heartwood makes them punch holes in each other.

---

## 5. Where to extend

**More repositories.** `world.maxIslands` in `config/site.ts`. Past ~30 the
archipelago stops reading as a place and starts reading as noise, and the reticle
gets crowded. A second concentric ring is already supported (`perRing`,
`ringSpacing`); a third works but is far from the camera's comfortable range.

**Organisations.** `/orgs/{name}/repos` returns the same shape as
`/users/{login}/repos`, so `fetchProfileBundle` needs a branch and a fallback for
the follower fields. The world builder needs no changes.

**Comparing two users.** `deriveWorld` takes a single bundle. For a versus mode,
offset the whole archipelago on X and build twice — the `Engine` holds islands in
a flat array, so selection indices would need namespacing.

**Sharing.** There is no share feature yet. The cheapest version:
`renderer.domElement.toDataURL()` after a frame, plus `?u=username` in the URL
read on mount. The renderer would need `preserveDrawingBuffer: true`, which costs
a little performance — set it only when a capture is requested.

**Audio.** Nothing here makes sound. If you add it, gate it behind an explicit
toggle that defaults to off.

---

## 6. Deploy

Static build, no server. `npm run build` → `dist/`.

- **Netlify / Vercel:** build `npm run build`, publish `dist`. No config needed.
- Set `VITE_GITHUB_TOKEN` in the host's env vars **only** if you accept that it
  ships to the client. A zero-scope token is the only acceptable choice.
- The better production answer is a tiny proxy function that holds the token
  server-side and forwards to `api.github.com`. Point `API` in `lib/github.ts` at
  it and delete the client token field.

Bundle is roughly 750 kB raw / 205 kB gzipped, with three.js as the bulk of it.
`vite.config.ts` already splits three and react into separate chunks so the shell
paints before the engine arrives.

---

## 7. Testing checklist before shipping

- [ ] A user with zero public repos → clear message, no crash
- [ ] A user with one repo → single island, world still legible
- [ ] A user with 100+ repos → overflow count shown in the profile panel
- [ ] Rate limit hit → the demo world offer appears, nothing dead-ends
- [ ] Offline → network error path, not a spinner forever
- [ ] Mobile portrait → dock scrolls, drawer becomes a bottom sheet, reticle
      hidden, radar hidden
- [ ] `prefers-reduced-motion: reduce` → no camera flight, no bobbing
- [ ] Tab backgrounded for a minute, then restored → no time jump
- [ ] Quality set to Low on an integrated GPU → holds 60fps
- [ ] Keyboard only → focus rings visible, `Tab` reaches every control
