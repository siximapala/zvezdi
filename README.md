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

После изменений в коде лучше обновлять вкладку через `Ctrl+F5`, чтобы браузер не держал старые JS-модули в кэше.

## Тюнинг для разрабов

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
↑ в падении - отскок от накопленной скорости
```

Мята:

```text
J / L - движение
I - прыжок
O - лоза / крюк
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
src/game/scenes/            меню, загрузка и общий gameplay runtime
src/game/config/            конфиги персонажей и общие справочники
src/game/systems/           физика материалов, управление, HUD, tuning
assets/levels/              Tiled-уровни, источник правды для порядка уровней
assets/sprites/             временные SVG-спрайты
scripts/dev-server.mjs      локальный dev-сервер
scripts/check-syntax.mjs    быстрая проверка JS-синтаксиса
```

## Проверка

```powershell
npm run check
```

Команда проверяет JavaScript-файлы на синтаксические ошибки.

## Aseprite animations

For this project, export character animation from Aseprite as:

```text
Sprite sheet: Horizontal Strip
Data format: None
Trim sprite: Off
Trim cells: Off
Merge duplicates: Off
Border padding: 0
Spacing: 0
```

Save the PNG into `assets/sprites/`, for example:

```text
assets/sprites/blue-run.png
```

Then wire them like this:

1. Keep all frames on the same canvas size, for example `32x32`.
2. In `BootScene.preload`, load the PNG with `this.load.spritesheet(...)`.
3. In `GameplayScene`, create the Matter sprite from that texture key directly.
4. In `animations.js`, build the animation with `generateFrameNumbers(...)`.

Why: fixed-size strips are the simplest match for Phaser's spritesheet loader. Packed + trimmed atlas exports can shift frames and break rendering if the runtime expects a regular grid.
## Tiled level editing

Levels are edited in Tiled through:

```text
assets/levels/*.tmj
```

Open a `.tmj` file in Tiled, edit object layers, save, then refresh the matching URL, for example `http://127.0.0.1:4173/?level=2`, with `Ctrl+F5`.

The dev server scans `assets/levels/*.tmj` and builds `assets/levels/manifest.json` automatically. The shared runtime is `src/game/scenes/GameplayScene.js`, so adding a Tiled level does not require creating a new scene class or JS level config.

Full layer/property guide:

```text
docs/TILED_LEVELS.md
```

New level checklist:

```text
docs/NEW_LEVEL_TODO.md
```
