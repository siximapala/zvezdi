# Звёзды

HTML5-прототип кооперативной платформенной игры на Phaser 3. В игре три персонажа с разными правилами взаимодействия с цветными поверхностями: кто-то стоит, кто-то скользит, кто-то проходит насквозь или погибает.

## Запуск

Нужен Node.js, установите любым доступным способом. Из корня проекта:

```powershell
cd D:\путь\zvezdi
npm run dev
```

В консоли появится локальный адрес. Обычно это:

```text
http://127.0.0.1:4173
```

Открой адрес в браузере. Если порт занят, dev-сервер автоматически попробует следующий свободный порт и напечатает его в консоль.

## Быстрый вход на уровни

```text
http://127.0.0.1:4173/?level=1
http://127.0.0.1:4173/?level=2
http://127.0.0.1:4173/?level=3
```

Level ids also work, for example `?level=level-two`. New `.tmj` files in `assets/levels` are picked up automatically by the dev server; if the map has `id = level-four` and `alias = 4`, both `?level=level-four` and `?level=4` work.

После изменений в коде лучше обновлять вкладку через `Ctrl+F5`, чтобы браузер не держал старые JS-модули в кэше.

## Dev tuning

Для настройки ощущения управления открой уровень с параметром `dev=1`:

```text
http://127.0.0.1:4173/?level=2&dev=1
```

Появится панель со слайдерами:

- общая скорость;
- разгон;
- контроль в воздухе;
- прыжок;
- сила рампы;
- максимальная скорость на рампе.

Значения применяются сразу во время игры и сохраняются в `localStorage` браузера.

## Управление

Искра:

```text
A / D - движение
W - прыжок
```

Волна:

```text
← / → - движение
↑ - прыжок
```

Мята:

```text
J / L - движение
I - прыжок
I x2 - лоза / крюк
M - удлинить лозу
```

Общее:

```text
R - перезапустить уровень
Esc - выйти в меню
Enter - перейти дальше после прохождения уровня
```

## Структура

```text
index.html                  точка входа
src/main.js                 конфиг Phaser
src/game/scenes/            сцены меню и уровней
src/game/config/            конфиги персонажей и уровней
src/game/systems/           физика материалов, управление, HUD, tuning
assets/sprites/             временные SVG-спрайты
scripts/dev-server.mjs      локальный dev-сервер
scripts/check-syntax.mjs    быстрая проверка JS-синтаксиса
```

## Проверка

```powershell
npm run check
```

Команда проверяет JavaScript-файлы на синтаксические ошибки.
## Tiled level editing

Level 2 can be edited in Tiled through:

```text
assets/levels/level-two.tmj
```

Open it in Tiled, edit object layers, save, then refresh `http://127.0.0.1:4173/?level=2` with `Ctrl+F5`.

The dev server scans `assets/levels/*.tmj` and builds `assets/levels/manifest.json` automatically. The shared runtime is `src/game/scenes/GameplayScene.js`, so adding a Tiled level does not require creating a new scene class.

Full layer/property guide:

```text
docs/TILED_LEVELS.md
```

New level checklist:

```text
docs/NEW_LEVEL_TODO.md
```
