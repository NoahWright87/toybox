# Pinball Game Engine — Future Work

## Physics Objects to Add

### Guide Rails / Orbit Lanes
Curved paths that carry the ball from entrance to exit at preserved speed.
- Catmull-Rom spline path in board JSON
- Entrance trigger (circular sensor): if ball velocity is aimed within ~60° of
  rail direction and speed is within a reasonable range, take control
- While controlled: override velocity each tick to follow spline tangent at
  current arc-length position; preserve speed magnitude
- Exit: release with tangent velocity at endpoint
- Visual: draw the spline path as a thick curved line

### Tunnels / Subways
Ball enters an opening and teleports to an exit point.
- Entrance sensor detects ball; set ball position to exit point and apply
  exit velocity at the configured angle
- Brief visual flash at entrance and exit on transit

### Spinners
Thin vertical segment that rotates freely when hit.
- Matter.js constraint at center; high angular restitution
- Track total spin count for rule triggers

### Gates / Diverters
Static body that can be enabled/disabled at runtime.
- Matter.Body.setStatic / setSleeping to toggle collision

### Ball Lock / VUK
- Entrance sensor freezes ball (setStatic); hold until rule releases
- On release: setVelocity at configured angle/speed (VUK ejects upward)

## Rule / Event System

### Trigger → Action Engine
Execute side effects in response to game events without hardcoded logic.
- Register rules from board JSON on world creation
- Emit events from physics handlers (on bumper hit, etc.)
- Rule processor matches events to triggers and fires actions
- State variables: per-board counters, per-object hit counts, active modes

### Component Groups
- GroupState: tracks activated counts, last-lit index, etc.
- RadioGroup: on member hit, deactivate all others, activate this one
- CompletionGroup: on all members activated, fire completion action + reset

## Scoring & Display
- Score multipliers (configurable per object and per mode)
- Bonus countdown at ball drain
- Insert/light system: lit/unlit state per object, visual feedback

## Multiball
- Multiple active balls (refactor ball from single ref to array)
- Ball lock logic: hold N balls then release together

## Modes
- Named mode objects with start/active/complete/fail states
- Mode timer (countdown displayed on HUD)
- Mode-specific scoring and object behaviors

## Dynamic Objects
- Animated bodies: sinusoidal or path-based movement each tick
- Boss objects with health, phases, hit behavior
- Requires animation system in the game loop (update positions per tick)
- Drain protection: ensure moving objects can't push ball into drain

## Audio
- Per-object hit sounds (configurable sound ID in board JSON)
- Mode music
- Callout / voice line system

## Performance
- Consider Web Worker for physics + rendering on mobile
- Profile SUBSTEPS vs. accuracy trade-off with guide rails added
