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
