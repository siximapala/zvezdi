Original prompt: как правильно добавить в этот проект анимации сделанные в aseprite? сейчас одна анимация уже лежит в проекте, но игра не работает правильно - анимацию не видно, только мелькает кусок star-blue.svg во время бега

2026-04-19
- Fixed blue character animation pipeline to use the Aseprite JSON atlas instead of loading `blue-run.png` as a fixed-grid spritesheet.
- Fixed blue player creation to spawn directly from the `blue-run` texture instead of creating a Matter sprite from `star-blue.svg` and swapping textures afterward.
- Added Aseprite export guidance to the README so future character animations follow the same atlas-based setup.
- Root cause: the existing `blue-run.json` contains packed/trimmed atlas frames, so `load.spritesheet(..., { frameWidth, frameHeight })` was reading it incorrectly, while the sprite itself still started life as `star-blue`.
- Switched the blue animation pipeline back to a plain `spritesheet` after replacing the asset with a new `128x32` PNG strip and removing JSON export.
- Extended the same `32x32` spritesheet animation pipeline to `pink-run.png` and `green-run.png`, so all three characters now use `idle` frame `0` plus `run` frames `0..3`.
- Added `blue-death.png` as a dedicated death animation for the blue character and made respawn wait for the death sequence before restoring the normal run spritesheet.
- Extended the same death-animation pipeline to `pink-death.png` and `green-death.png`, so every character now switches to its own `*-death` spritesheet before respawn.
- Added `green-leavesh.png` as a 6-frame grapple effect for the green character; the leaves animation now appears near the star while the vine is attached to a grapple anchor.
- Added `pink-static.png`, `blue-static.png`, and `green-static.png` as dedicated idle spritesheets; all three characters now use their own 4-frame static animation while standing still.
- Added `one-spike.png` as the visual tile for spike fields; hazards now render by repeating the sprite per tooth while keeping the existing Matter collision/sensor setup.
- Moved background selection into level config: each level can now define its own `background` path, and BootScene preloads all referenced images before starting gameplay.
- Added `blue-jump.png` as a dedicated jump animation for the blue character and switched blue to the `jump` state whenever it is airborne.
- Extended jump animations to `pink-jump.png` and `green-jump.png`, and moved the airborne threshold earlier so jump animations begin sooner for all three characters.
