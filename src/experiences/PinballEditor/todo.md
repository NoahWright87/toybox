# Pinball Editor — Future Work

## Physics Visualization

### Ghost Ball Trajectory Preview
When an element is selected and "Preview Physics" is enabled in the View menu,
spawn ghost balls in a ring around the selected object, aimed inward. They run
in a secondary Matter.js world (not the game world), leave low-opacity trail
lines on the canvas, and show the incoming approach path for that object.
- Spawn N balls (configurable, default ~20) in a circle of radius R around the element
- Random speeds within the plausible range (8–25 px/tick)
- Balls aimed at the element center ± some spread angle
- Draw trail as a series of line segments at ~10% opacity
- Trails fade after a few seconds or reset when selection changes
- Runs continuously while option is enabled (background Matter.js world)

### Heatmap Mode
Aggregate many ghost ball runs into a color-coded overlay on the board.
- Run N complete ball simulations from the plunger (launch at random charge levels)
- Record each ball position at each tick as a 2D histogram
- Render as a heat-encoded layer: cool blue → warm yellow → hot red
- Useful for: identifying dead zones, common paths, drain risk areas
- Toggle via View menu

## New Physics Objects

### Guide Rails / Orbit Lanes
A curved path that "catches" the ball if it enters near the entrance moving
roughly in the rail direction, then carries the ball along the path at the
incoming speed. Exit velocity matches the rail tangent at the endpoint.
- Data model: array of control points (Catmull-Rom spline)
- Editor: click to place first point, click to add intermediate points,
  double-click to finish; drag existing points to reshape
- Physics: entrance capture zone (cylinder trigger); while inside rail,
  override velocity to follow spline tangent at current t-value
- Ball speed is preserved (magnitude of incoming velocity)

### Tunnel / Subway
Ball enters one opening, exits from a different point on the board.
- Data model: { entranceX, entranceY, exitX, exitY, exitAngle }
- Editor: two-point placement (click entrance, click exit)
- Physics: entrance trigger teleports ball to exit with exitAngle velocity

### Spinner
Vertical obstacle that spins when hit; can be wired to a score event.
- Data model: { x, y, angle, spinCount (for rule triggers) }

### Gate / Diverter
One-way passage that can be opened/closed by rules.
- Data model: { x, y, angle, open: boolean, default: "open" | "closed" }

### Ball Lock / VUK (Vertical Up-Kicker)
Holds ball in place until a rule releases it; can eject at a set angle/speed.
- Data model: { x, y, ejectAngle, ejectSpeed, label }

## Simple Rule / Event System

### Trigger → Action Events
A minimal data-driven rule system that doesn't require code changes:
- Supported triggers: objectHit(id), objectHitCount(id, n), allInGroupHit(groupId), timerExpired(timerId), ballDrained
- Supported actions: addScore(n), lightObject(id), flashObject(id), openGate(id), closeGate(id), resetGroup(groupId), startTimer(timerId, seconds), startMode(modeId)
- Editor: "Rules" panel (separate from properties); list of trigger→action pairs
- Data stored in board JSON as `rules: Rule[]`

### Component Groups
Link several objects together:
- **Radio group**: only one in the group is "lit" at a time; hitting one unlit object lights it and unlit the previously lit one
- **Completion group**: tracks how many in the group are in the "activated" state; triggers an action when all are activated; can auto-reset on completion
- Editor: select multiple objects, right-click → "Add to Group..."

## Testing Tools
- Drop ball at cursor position (with configurable velocity)
- Launch N balls automatically and show heatmap
- "Auto-flipper" demo mode: AI-controlled flippers for unattended testing
- Show per-object hit counts after a run

## Dynamic / Moving Objects
*Discussed but out of scope until the game engine supports animation.*
- Moving targets (slide back and forth)
- Timed gate sequences
- Boss objects with health and phases
See also: Pinball game engine todo.md

## UX Improvements
- Undo / Redo (Ctrl+Z / Ctrl+Y)
- Snap-to-grid toggle (currently always on at 4px)
- Multi-select move/resize
- Keyboard shortcuts panel (accessible via Help menu)
- Selection cycling when multiple objects overlap at a click
- Object labels visible on canvas at low zoom
- Minimap / overview for large boards
