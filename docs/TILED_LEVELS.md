# Tiled Level Workflow

The game now supports object-only Tiled maps (`.tmj`). Tiled is used as a level editor, while Phaser/Matter still creates the real gameplay geometry.

## Quick loop

1. Install Tiled: https://www.mapeditor.org/
2. Open `assets/levels/level-two.tmj`.
3. Move, resize, duplicate, or add objects in the object layers.
4. Save the file as JSON map (`.tmj`).
5. Run the game and open `/?level=2`.
6. Use `Ctrl+F5` in the browser after saving the map.

## Important rule

Keep objects in the expected layers. The importer reads layer names, not visual colors.

## Layers

`Spawns`
: Point objects named `pink`, `blue`, `green`.

`Neutral`
: Rectangle objects. These become normal black platforms/walls.

Thin neutral rectangles (`height <= 34`) are treated as one-way island platforms by default: players collide only when landing from above, not from the side or underside. Add `oneWay = false` to a thin neutral object if it must be a fully solid block.

`Materials`
: Rectangle objects with custom properties:

```text
material = pink | blue | green
shape = block | slope | spikes | stairs
direction = upRight | downRight   only for slope
teeth = number                    only for spikes
```

`red` is accepted as an alias for `pink`, so `material = red` works for red/pink hazard spikes.

You can also put spike rectangles on a `Hazards` layer. The importer treats `Hazards` like `Materials`.

Fast spike setup:

```text
Layer: Materials or Hazards
Object: rectangle
Name or class: red-spikes
Properties:
  material = red
  shape = spikes
  teeth = 5
```

For a slope, draw a rectangle that represents the slope bounding box. The game turns it into the real triangular visual and an angled Matter body.

`GrappleAnchors`
: Point objects for Green's vine. Useful properties:

```text
radius = 620
minLength = 74
maxLength = 540
```

`Plates`
: Rectangle trigger objects. Useful properties:

```text
id = green-bridge
requires = any | pink | blue | green
latch = true | false
color = #ff8fc68d
```

`Switches`
: Same shape as `Plates`, but use the `Switches` layer.

`Doors`
: Rectangle objects. Useful properties:

```text
id = final-door
opensWhen = pink-plate,blue-plate,green-plate
latch = true | false
color = #ff111111
```

`Bridges`
: Rectangle objects that appear after activators. Useful properties:

```text
id = gap-bridge
appearsWhen = green-bridge
latch = true | false
color = #ff111111
```

`Goals`
: Rectangle objects named `pink`, `blue`, `green`.

`Notes`
: Objects with a `text` property. These are drawn as in-game hint text.

## Map properties

Set these on the map itself when needed:

```text
id = level-two
worldWidth = 2380
worldHeight = 720
nextLevel = LevelThreeScene
```

If a map property is missing, the JS level config remains the fallback for title, messages, and next level.

## Adding another Tiled level

1. Copy `assets/levels/level-two.tmj` to a new file.
2. Create or update a JS level config with:

```js
export const LEVEL_FOUR = {
  id: 'level-four',
  tiledKey: 'level-four-tiled',
  tiledPath: 'assets/levels/level-four.tmj',
  title: 'Level 4',
  startMessage: '...',
  completeMessage: '...',
  nextLevel: null,
  world: { width: 1280, height: 720 },
  neutral: [],
  materials: [],
  notes: [],
  goals: []
};
```

3. Add that config to `LEVEL_ASSETS` in `BootScene`.
4. Add a scene class or reuse `LevelOneScene` with the new config.
