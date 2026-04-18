Original prompt: Начни делать игру

Дополнительный запрос из лога: html5-игра на Phaser JS, пока 3 персонажа из 4 концептов; меню, первый уровень с управлением, разные персонажи по-разному взаимодействуют с разными поверхностями; посмотреть слайды/концепты; сохранить рисованно-пикселизированную стилистику; WIP-спрайты можно временные; предусмотреть место для будущей замены моделей и анимаций.

2026-04-16

Сделано:
- Создан первый playable-прототип на Phaser 3: `index.html`, сцены Boot/Menu/LevelOne и локальный dev-сервер.
- Добавлено меню с запуском уровня и управлением.
- Добавлен первый уровень с тремя персонажами: Искра, Волна, Мята.
- Реализованы разные правила поверхностей:
  - розовая поверхность: Искра стоит/цепляется, Волна и Мята погибают;
  - синяя поверхность: Волна стоит, Искра и Мята соскальзывают;
  - зелёная поверхность: Мята стоит, Искра и Волна проходят насквозь.
- Добавлены индивидуальные световые ауры у персонажей.
- Добавлены WIP SVG-спрайты в `assets/sprites`.
- Добавлены конфиги персонажей и уровня, чтобы дальше проще добавлять способности и менять баланс.
- Добавлена точка подключения будущих spritesheet-анимаций в `src/game/systems/animations.js`.
- После проверки геометрии добавлены нейтральные прыжковые платформы над розовой зоной и опущен зелёный маршрут, чтобы первый уровень был проходим всеми тремя персонажами.

Проверить:
- Запустить `npm run dev` и пройти уровень всеми тремя персонажами.
- Проверить, что CDN Phaser доступен в браузере. Если нужен офлайн-режим, добавить локальную сборку Phaser.

TODO:
- Добавить настоящие spritesheet-анимации вместо single-frame WIP-спрайтов.
- Расширить первую головоломку кнопками/дверью, когда базовое движение подтвердится.
- Решить, возвращаем ли четвёртого персонажа из концепта.
- Заменить временную физику ступеней на tilemap, если понадобятся более точные склоны.

2026-04-16 итерация исправлений

Сделано:
- Исправлена проходимость первого уровня: убрана зелёная стенка на маршруте Мяты, перенесены зелёные платформы в роль верхнего пути, добавлены нейтральные платформы для обхода цветных поверхностей.
- Убран плоский синий блок перед финишем, чтобы розовый и зелёный персонажи могли стоять у своих ворот.
- Скольжение на синей горке развернуто в обратную сторону: чужие персонажи теперь уезжают назад по склону.
- Перенастроена физика: выше гравитация, выше максимальная скорость падения, быстрее горизонтальное движение и короче дуга прыжка.
- Камера заменена на Duck Game-подобную: считает bounding box всех трёх игроков, плавно меняет zoom и scroll, добавляет небольшой lead по скорости.
- Добавлен dev-вход `/?level=1` для быстрой проверки уровня без меню.

Проверено:
- `npm run check` проходит.
- `http://127.0.0.1:4173/?level=1` отдаётся с HTTP 200.
- Headless Edge через DevTools Protocol: ошибок в консоли нет, LevelOneScene активна.
- Камера: при близких игроках zoom `1.08`, при разбросе от старта до финиша zoom `0.72`, все три игрока остаются внутри `camera.worldView`.
- Финишное условие срабатывает: при постановке всех трёх игроков в свои ворота `completed: true`, сообщение `Уровень пройден`.

2026-04-16 итерация камеры

Сделано:
- Камера переведена на строгую модель прямоугольника по крайним персонажам.
- Если персонажи рядом, камера держит минимальный world-rect `620x349`.
- Если кто-то отходит, строится bounding rectangle по реальным bounds всех трёх персонажей, добавляется процентный запас вокруг крайних героев, затем прямоугольник расширяется до 16:9.
- Убрано упреждение камеры по скорости, чтобы кадр зависел только от текущих крайних персонажей.
- Исправлен Phaser zoom edge-case: при zoom-in у левого края scroll теперь считается с поправкой на внутренний zoom-offset, поэтому крайние персонажи не вылетают из `worldView`.

Проверено:
- `npm run check` проходит.
- `http://127.0.0.1:4173/?level=1` отдаётся с HTTP 200.
- Headless Edge через DevTools Protocol: ошибок в консоли нет.
- Камера рядом: zoom `2.063`, worldView `620x349`, все bounds трёх персонажей внутри кадра.
- Камера при разбросе от x=125 до x=1648: zoom `0.744`, worldView покрывает весь уровень по X, все bounds трёх персонажей внутри кадра.

2026-04-16 итерация HUD и новых механик

Сделано:
- HUD вынесен из Phaser-камеры в DOM поверх canvas, теперь он `position: fixed` и не зависит от zoom/scroll камеры.
- `LevelOneScene` параметризована конфигом уровня, чтобы новые уровни не копировали всю игровую логику.
- Добавлен `LevelTwoScene` и прямой вход `/?level=2`.
- Первый уровень после победы ведёт на второй через `Enter`.
- Добавлена физическая коллизия между персонажами: они могут стоять друг на друге и использовать стак как механику.
- Во втором уровне добавлены новые командные механики:
  - высокий верхний переключатель, который предполагает стак персонажей;
  - открывающаяся дверь после верхнего переключателя;
  - три цветные плиты, каждая требует своего персонажа;
  - финальная дверь открывается после одновременной активации всех цветных плит.
- Двери второго уровня запоминают открытие, чтобы маршрут не ломался после схода с кнопок.

Проверено:
- `npm run check` проходит.
- `http://127.0.0.1:4173/?level=2` отдаётся с HTTP 200.
- Headless Edge: ошибок в консоли нет.
- HUD видим, не hidden, CSS position `fixed`.
- Второй уровень активен, есть 3 игрока, 4 активатора и 2 двери.
- Верхний переключатель открывает первую дверь и отключает её body.
- Три цветные плиты открывают финальную дверь и отключают её body.
- Финиш второго уровня срабатывает: `completed: true`, сообщение `Уровень 2 пройден`.

2026-04-16 итерация скольжения

Сделано:
- Скольжение на чужой slippery-поверхности усилено в `src/game/systems/playerControls.js`.
- Для синей поверхности сила сноса увеличена с `-32` до `-92`.
- Управление против скольжения ослаблено с `character.speed * 0.08` до `character.speed * 0.025`.
- Максимальная скорость скольжения увеличена с `character.speed * 1.05` до `character.speed * 1.85`.
- Горизонтальное трение на slippery-поверхности снижено с `8` до `0`.
- Прыжок с slippery-поверхности отключён, чтобы нельзя было продавить снос серией прыжков.

Проверено:
- `npm run check` проходит.

2026-04-16 итерация треугольных горок и лозы

Сделано:
- Синие горки переведены со ступенек-прямоугольников на кастомные треугольные slope-поверхности.
- Добавлена кастомная обработка slope-контакта: персонаж снапится на линию треугольника, получает материал поверхности и направление скатывания.
- Если персонаж стоит на голове другого, он получает `neutral`-опору и не скользит, даже если нижний персонаж находится на горке.
- Скольжение теперь сохраняет momentum после съезда с горки, чтобы можно было использовать разгон для прыжка или перелёта.
- На slippery-поверхности разрешены до 2 попыток прыжка, но каждая попытка увеличивает силу и максимальную скорость сноса экспоненциально.
- Добавлена способность Мяты `K`: лоза/крюк к ближайшему anchor в радиусе, с визуальной линией и pull-ускорением.
- Новый второй уровень сделан про треугольную синюю горку, разгон, обрыв и лозу Мяты.
- Старый второй уровень перенесён в третий, прямой вход теперь `/?level=3`.

Проверено:
- `npm run check` проходит.
- `/?level=1`, `/?level=2`, `/?level=3` отдаются с HTTP 200.
- Headless Edge: новый второй уровень активен, содержит треугольный blue slope `downRight`, 2 grapple anchor-а, способность лозы меняет velocity Мяты и рисует линию.
- Headless Edge: третий уровень стартует как `Уровень 3`, содержит 2 двери и slope.
- Headless Edge: чужой персонаж на синем slope получает `surface: blue`, custom ground и направление скатывания вправо.
- Headless Edge: персонаж на голове другого получает `surface: neutral` и не скользит.

2026-04-16 итерация фикса коллизий

Сделано:
- Исправлено дрожание при стоянии на голове: убран конфликт Arcade player-player collider и ручного snap-а.
- Стак персонажей теперь работает как ручная one-way опора: верхний персонаж снапится к голове нижнего, получает `surface: neutral`, временно отключает gravity и наследует часть скорости нижнего.
- Исправлено дрожание/застревание на треугольной горке: slope теперь тоже даёт ручную custom-опору с отключением gravity на кадр, пока персонаж находится на линии склона.
- После ухода с головы или slope gravity снова включается автоматически.
- Верхний персонаж больше не сбрасывает горизонтальную скорость в ноль каждый кадр, пока стоит на другом персонаже.

Проверено:
- `npm run check` проходит.
- `/?level=2` отдаётся с HTTP 200.
- Headless Edge: персонаж на slope 90 кадров держит стабильную Y, `slopeYRange: 0`, `surface: blue`, `allowGravity: false`.
- Headless Edge: персонаж на голове 90 кадров держит стабильный gap `0`, `riding: true`, `surface: neutral`, `allowGravity: false`.

2026-04-16 итерация повторного фикса коллизий по video.mp4

Сделано:
- Через браузерный canvas-экстрактор просмотрены кадры `video.mp4`; на них видно вертикальное дрожание стопки на ровной платформе.
- Возвращено толкание персонажей без возврата старого конфликтного Arcade player-player collider: добавлен ручной side-push по горизонтальному overlap.
- Убрана повторная slope-коррекция внутри `scene.update`, которая после движения снова сбрасывала вертикальную скорость.
- Для slope добавлена вертикальная скорость по углу треугольника: `velocityY = slopeRatio * velocityX`, поэтому персонаж движется вдоль линии, а не проваливается и не выталкивается обратно.
- Добавлен `POST_UPDATE`-snap перед рендером, чтобы голова и slope стабилизировались после реального physics tick Phaser, а не только в ручных тестах.

Проверено:
- `npm run check` проходит.
- `/?level=2` отдаётся с HTTP 200.
- Real browser loop через Headless Edge: стопка 90 кадров держит стабильный gap `3.23` без осцилляции, `surface: neutral`.
- Real browser loop через Headless Edge: боковой push снова работает, синий персонаж смещается с `x=292` до `x=376.11`.
- Real browser loop через Headless Edge: slope 90 кадров держит постоянную ошибку относительно линии без провала/подпрыгивания.

2026-04-16 collision-controller follow-up

Done:
- Player collision body is now square (`32x32` source pixels, scaled by the sprite), so gameplay contacts do not depend on the uneven star silhouette.
- Manual support correction now goes through one `movePlayerBodyTo()` helper. The helper syncs sprite position and Arcade body state and restores velocity/gravity flags after the snap.
- Head stacking latch is slightly wider and sticky for a short window after first contact, so a carrier settling by one physics tick does not drop the rider.
- Manual side-push still stays outside the Arcade player-player collider, so horizontal pushing remains without bringing back vertical solver jitter.

Checked:
- `npm run check` passes.

- Headless Edge real loop: when the carrier is already grounded, a rider on the carrier head holds `gapRange: 0` and `yRange: 0` for 100 frames.
- Headless Edge real loop: manual side-push moves the pushed player by about `100px` over 30 frames.

2026-04-17 Matter physics reset

Done:
- Removed the custom Arcade snap/support controller from the play scene: no `POST_UPDATE` body correction, no manual head support snap, no custom slope line snap.
- Switched gameplay physics from Phaser Arcade to Phaser Matter in `src/main.js`.
- Rebuilt material geometry for Matter: rectangular platforms are static Matter bodies, blue slopes are real angled static bodies under the triangular visual, and material hazard checks use Matter sensor bodies.
- Player bodies now collide physically with each other, so standing on heads and side pushing come from the solver instead of manual position correction.
- Character movement was retuned for Matter units: acceleration is smoothed, jump velocity is scaled, and slippery surfaces add impulse without moving the body directly.
- Doors, switches, goals, respawn, vine grapple, HUD, and camera were updated to work without Arcade bodies.

Checked:
- `npm run check` passes.
- Headless Edge real runtime loads `LevelTwoScene` with Matter enabled and no console exceptions.
- Headless Edge real runtime loads `LevelOneScene` and `LevelThreeScene` with Matter enabled and no console exceptions.
- Matter stack test: rider standing on a grounded carrier settles with `yRange: 0` and `gapRange: 0` after the initial contact.
- Matter push test: pushing another player moves them by about `61px` over 70 frames.
- Matter slope test: green enters the blue ramp, gets `surface: blue`, accelerates through the ramp, and does not get pinned to a snapped line.

2026-04-17 dev tuning controls

Done:
- Added a live dev tuning panel enabled with `?dev=1`.
- Added sliders for global speed, acceleration, air control, jump, ramp force, and ramp max speed.
- Tuning values apply every frame through `scene.gameplayTuning` and persist in `localStorage`.
- Default movement feel was made more active: speed `1.35x`, acceleration `1.45x`, jump `1.08x`, ramp force `1.7x`, ramp max speed `1.35x`.

Checked:
- `npm run check` passes.
- Headless Edge loads `/?level=2&dev=1`, shows the dev panel with 6 sliders, and changing `speedScale` updates the live scene tuning plus stored value.

2026-04-17 ramp access and camera follow-up

Done:
- Added a neutral stair/ledge chain before the big blue ramp in level 2, plus a small backstop wall at the top approach so players are not jumping straight into the empty side of the ramp.
- Increased the minimum camera framing from `620x349` to `860x484` world units and increased minimum edge padding, so grouped players are framed farther away.
- Changed slope grounding: a Matter contact with a slope body now counts as ground on the whole ramp, instead of using the old center-above-center test that failed near the lower part of an angled body.
- Removed the slippery-ramp jump lockout. Players can keep jumping on the ramp; horizontal ramp momentum is preserved after the jump/leave window.

Checked:
- `npm run check` passes.
- Headless Edge level 2: new geometry reports 5 access blocks before the ramp.
- Headless Edge level 2: grouped camera minimum is about `860x484` world units at zoom `1.488`.
- Headless Edge level 2: green stays in blue ramp contact for 110 frames on the lower ramp section.
- Headless Edge level 2: pressing green jump (`I`) on the ramp changes vertical velocity from about `0.34` to `-8.35`, confirming the ramp jump works.

2026-04-17 project docs and gitignore

Done:
- Rewrote `.gitignore` for the Phaser prototype: dependencies, build/cache output, logs, env files, editor/OS files, Codex agent workspace, temporary browser/test artifacts, screenshots, debug video, and extracted presentation scratch folders.
- Rewrote `README.md` with clean launch instructions, direct level URLs, dev tuning URL, controls, project structure, and syntax-check command.

Checked:
- `npm run check` passes.

2026-04-18 Tiled level workflow

Done:
- Added object-only Tiled map support through `src/game/systems/tiledLevel.js`.
- BootScene now preloads level `.tmj` JSON assets declared by level configs.
- Level scenes resolve Tiled maps at create-time and keep JS configs as fallback metadata.
- Level 2 now loads geometry and mechanics from `assets/levels/level-two.tmj`.
- Added Tiled object layers for spawns, neutral blocks, material blocks/slopes, vine anchors, plates, bridges, goals, and notes.
- Added `docs/TILED_LEVELS.md` with the layer/property contract for editing levels in Tiled.
- Dev server now serves `.json` and `.tmj` files as `application/json`.
- Added Tiled import aliases for hazard editing: `red` is treated as `pink`, and `Hazards`/`Spikes` layers are treated as material layers.

Checked:
- `npm run check` passes.
- `assets/levels/level-two.tmj` parses as JSON.
- The Tiled converter returns the expected level 2 objects: 10 neutral blocks, 2 material objects, 3 spawns, 2 vine anchors, 1 plate, 1 bridge, and 3 goals.
- Clean dev-server port serves `.tmj` with `application/json; charset=utf-8`.
- Headless Edge could not complete a real Phaser runtime check because Phaser is loaded from CDN and was not available in the isolated browser session.

2026-04-18 vine swing feel

Done:
- Made Green's vine add tangential swing velocity from left/right input instead of only correcting rope distance.
- Added stronger acceleration when input matches the current swing direction.
- Added a small reel-in pump when shortening the vine with upward input while already swinging.
- Raised vine velocity limits and keeps post-release momentum for longer.
- Added dev tuning sliders for vine swing force and vine speed.

Checked:
- `npm run check` passes.

2026-04-18 slope edge grounding fix

Done:
- Slope Matter bodies now carry explicit visual slope-line metadata.
- The solid slope collision strip is slightly shorter and thinner, so invisible ramp caps protrude less beyond the drawn triangle.
- `LevelOneScene` only marks a player grounded on a slope when the player's feet are above the actual slope line and inside the usable line range.
- Side/end/underside contacts with a ramp no longer grant grounded state, so players should not be able to jump from random ramp parts.

Checked:
- `npm run check` passes.

2026-04-18 one-way slope collision follow-up

Done:
- Bad ramp contacts now disable the Matter collision pair itself, not only the grounded/jump state.
- A player can collide with a slope only when their feet are near the real slope line, inside the usable X range, and they came from above on the previous physics step.
- Contacts from below, side, underside, and ramp caps should behave like the ramp is not there, avoiding corner scraping and below-ramp jumps.
- After reviewing `video_new.mp4`, added a Matter `beforeSolve` hook so invalid slope contacts are disabled before the solver can push the player against the ramp corner.
- Invalid slope pairs are also marked sensor-like for that solve and have their collision depth cleared.

Checked:
- `npm run check` passes.

2026-04-18 sensor slope controller rewrite

Done:
- Replaced solid Matter slope collision with sensor-only slope surfaces.
- Added a controller-style slope support pass that computes the slope line under the player's feet, places the body on that line only when the player came from above, and applies vertical velocity from the slope gradient.
- Slope support now respects per-character material behavior, so ghost/deadly materials are not treated as walkable slopes.
- This follows the common platformer-controller pattern: slopes are treated as ground queries/projections, not as generic rigid-body wedges with collidable caps and undersides.
- Tightened the slope support pickup after user reported remaining corner grabs: larger dead zones at slope endpoints, both current and previous X must be inside the usable range for a first pickup, rising bodies cannot be picked up from below, and snap-below tolerance is much smaller.

Checked:
- `npm run check` passes.

2026-04-18 black island platform collision correction

Done:
- Reverted the blue ramp back to the previous solid slippery Matter strip and removed the slope snap/controller path from runtime.
- Added one-way behavior for thin neutral black platforms (`height <= 34`, unless `oneWay = false`): they collide only when the player lands from above.
- Invalid contacts with one-way black platforms are disabled before Matter solve, so side/underside/corner rubbing should not push, snag, or allow edge jumps.
- Tiled neutral objects now preserve an optional `oneWay` property; docs note that thin neutral objects become one-way by default.

Checked:
- `npm run check` passes.
- Current Tiled level 2 parses with 9 neutral objects, 6 auto one-way neutral platforms, and 1 slope.

2026-04-18 one-way platform feel stabilization

Done:
- Stabilized thin black one-way platform contacts with a short sticky top-contact window after a valid landing, so the solver does not alternate every frame between grounded and airborne movement.
- Invalid one-way contacts now set the Matter pair to sensor-like for that solve instead of forcing `pair.isActive = false`, avoiding stale inactive pairs and sticky/rubbery movement.
- Blue ramp momentum preservation now applies only to characters whose behavior on that material is `slippery`; characters that are solid on the ramp use normal ground movement feel.
- Respawn clears one-way platform contact memory.

Checked:
- `npm run check` passes.
- Local dev server returned `/?level=2` with HTTP 200.

2026-04-18 one-way landing catch and player feet alignment

Done:
- Increased the Matter player rectangle height while keeping the same narrow width, so the drawn feet line up with the physical bottom of the character instead of sinking into platforms.
- Replaced the one-way platform's narrow `snapBelow` landing window with a wider top-crossing catch window, so fast downward falls onto thin islands are treated as valid landings instead of becoming pass-through sensor contacts.
- Kept the side-inset and sticky top-contact checks, so the earlier fix against side/corner climbing remains in place.

Checked:
- `npm run check` passes.
- Local dev server returned `/?level=2` with HTTP 200.

2026-04-18 gameplay scene and level registry refactor

Done:
- Renamed the shared runtime from `LevelOneScene` to `GameplayScene`.
- Removed per-level scene wrapper files for level 2 and level 3.
- Added `src/game/config/level-registry.js`; `src/main.js` now creates gameplay scene classes from the registry.
- Boot and menu now resolve levels through the registry instead of hardcoded `LevelOneScene`/`LevelTwoScene`/`LevelThreeScene` names.
- Scene keys now use level ids (`level-one`, `level-two`, `level-three`), and `nextLevel` values use those ids.
- Updated Tiled docs so new levels are added to `LEVEL_REGISTRY`, not by adding a scene class.

Checked:
- `npm run check` passes.
- `assets/levels/level-two.tmj` still parses as JSON.
- Local dev server returned `/?level=2` with HTTP 200.

2026-04-18 automatic Tiled level discovery

Done:
- Dev server now generates `assets/levels/manifest.json` dynamically by scanning `assets/levels/*.tmj`.
- BootScene loads that manifest, merges discovered Tiled maps with the built-in fallback registry, loads all needed `.tmj` files, and registers GameplayScene instances at runtime.
- `src/main.js` no longer creates gameplay scenes up front; BootScene owns runtime level registration.
- New Tiled maps can be added by saving a `.tmj` file under `assets/levels` with map properties like `id`, `alias`, `worldWidth`, `worldHeight`, and `nextLevel`.
- `nextLevel` can resolve either a scene/level id or an alias.
- Updated docs/README for the faster Tiled-first workflow.

Checked:
- `npm run check` passes.
- Dev server manifest returns `level-two` with alias `2`, no manifest errors.
- Local dev server returns HTTP 200 for both `/?level=level-two` and `/?level=2`.
