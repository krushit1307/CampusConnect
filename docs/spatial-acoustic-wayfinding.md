# Spatial Acoustic Wayfinding (Issue #5458)

Interactive acoustic wayfinding for blind and low-vision users: an auditory beacon whose
virtual position tracks the direction and distance of an event/location target. The user
hears a subtle chime anchored in 3D space and navigates toward it by walking in the
direction the sound appears to come from.

## What this feature does

- Continuously reads the user's position, the target position and the user's head
  orientation from a position provider.
- Computes the 3D distance, the horizontal bearing to the target, and the target's
  direction relative to the user's head (0° = straight ahead, + = right, − = left).
- Renders a continuous, subtle audio beacon whose Web Audio source position is placed
  in the target's direction and scaled by distance.
- Exposes accessible Start/Stop controls and announces direction/distance via an
  `aria-live` region.

Route: `/events/spatial-wayfinding`.

## How spatial positioning works

Coordinates use meters in a local venue space (`+X` east, `+Y` north, `+Z` up), centered
on the user:

| Concept            | Calculation                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| Distance           | `hypot(Δx, Δy, Δz)` between user and target                              |
| Bearing            | `atan2(Δx, Δy)`, degrees clockwise from north                            |
| Relative direction | `normalizeAngle(bearing − head.yaw)` → `(-180, 180]`                     |
| Guidance text      | ahead / left / right / behind, with diagonals ("ahead and to your left") |

All calculations live in `src/lib/accessibility/spatialWayfindingCalculations.ts` and are
pure functions (angle normalization handles negative angles, angles > 360°, and wraparound
between 359° and 0°).

## The mock provider (simulated UWB)

`src/lib/accessibility/mockSpatialPositionProvider.ts` implements the
`SpatialPositionProvider` interface with deterministic, controllable data (default user at
`(0,0,0)`, a configurable target, and settable head orientation). It is a simulation only —
it does not access any UWB hardware. It exists so the whole flow works in any browser and so
the UI/tests can drive head turns and target changes deterministically.

## How Web Audio spatial positioning works

`src/lib/accessibility/spatialAudioBeacon.ts` uses the standard Web Audio API:

- One `AudioContext` (created/resumed from the **Start Navigation** user gesture).
- A gentle oscillator chime routed through an HRTF `PannerNode`.
- The panner source position is set in head-relative space so the chime appears to emanate
  from the target direction and grows closer/louder as the user approaches.
- `stop()` stops oscillators, clears node references and closes the context; repeated
  start/stop does not leak contexts, nodes or timers.

This is **Web Audio spatial wayfinding** — not Apple's native Spatial Audio or dynamic head
tracking. Head orientation currently comes from the mock provider (a demo slider); real head
tracking requires a platform API.

## Why real UWB is represented through an abstraction

Browsers cannot access Apple's U1/UWB chip or `NearbyInteraction`-style ranging, and there is
no browser API for AirPods dynamic head tracking or a U1 ranging session. Faking iPhone-only
capacities in web code would be misleading and broken. Instead, the feature talks only to the
small `SpatialPositionProvider` interface — a mock supplies data today, and a future native
layer can implement the same interface.

## What native UWB integration would require

A future implementation could:

1. Add a native companion (e.g. an iOS `NearbyInteraction`/U1 session or an Android UWB
   ranging session) and bridge measured positions to the web app.
2. Implement `SpatialPositionProvider` with the native-ranging-backed methods
   (`getUserPosition`/`getTargetPosition`/`getHeadOrientation`).
3. Optionally swap the Web Audio beacon for a platform spatial-audio engine (e.g.
   AVAudioEnvironmentNode/PHASE with head-tracked AirPods) behind the same driving math.

No changes to the wayfinding calculations, state machine or UI are required.

## Browser limitations

- No UWB-range access, no U1 chip, no AirPods head tracking — positions/orientation must come
  from a web-accessible provider (mock today).
- AudioContext must start from a user gesture (autoplay policy).
- HRTF spatialization requires headphones to be heard properly; browsers without Web Audio
  degrade gracefully (position text still works; audio is reported unavailable).
- No claims of millimeter accuracy: positions are whatever the provider supplies.

## How to test locally

```bash
npm run dev
# open http://localhost:5173/events/spatial-wayfinding
```

1. Choose a destination.
2. Press **Start Navigation** (wear headphones for the spatial effect).
3. Use the demo head-orientation slider to "turn your head" and hear the chime stay anchored.
4. Unit tests: run
   `npx vitest run src/lib/accessibility src/hooks/useSpatialWayfinding.test.ts src/components/accessibility/SpatialWayfindingPanel.test.tsx`.
