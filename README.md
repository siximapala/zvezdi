# Звёзды

HTML5-прототип кооперативной платформенной игры на Phaser 3. В игре три персонажа с разными правилами взаимодействия с цветными поверхностями: кто-то стоит, кто-то скользит, кто-то проходит насквозь или погибает.

## Авторы

- [siximapala](https://github.com/siximapala): ядро, управление, уровни
- [jarungii](https://github.com/jarungii): дизайн и арты
- [kateromanovna](https://github.com/kateromanovna): уровни
- [sos-mislom](https://github.com/sos-mislom): отдельная благодарность за [онлайн режим к игре ](https://github.com/siximapala/zvezdi/tree/online-mode-beta)


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

## Анимации Aseprite

Для этого проекта экспортируйте анимации персонажей из Aseprite так:

```text
Sprite sheet: Horizontal Strip
Data format: None
Trim sprite: Off
Trim cells: Off
Merge duplicates: Off
Border padding: 0
Spacing: 0
```

Сохраните PNG в `assets/sprites/`, например:

```text
assets/sprites/blue-run.png
```

Затем подключите его так:

1. Все кадры должны быть на холсте одного размера, например `32x32`.
2. В `BootScene.preload` загрузите PNG через `this.load.spritesheet(...)`.
3. В `GameplayScene` создайте Matter-спрайт напрямую из этого texture key.
4. В `animations.js` соберите анимацию через `generateFrameNumbers(...)`.

Почему так: фиксированные strip-спрайты проще всего подходят для загрузчика `spritesheet` в Phaser. Экспорт через packed/trimmed atlas может сдвигать кадры и ломать отображение, если runtime ожидает обычную сетку.

## Редактирование уровней в Tiled

Уровни редактируются в Tiled через файлы:

```text
assets/levels/*.tmj
```

Откройте `.tmj` файл в Tiled, измените object layers, сохраните файл, затем обновите нужный URL, например `http://127.0.0.1:4173/?level=2`, через `Ctrl+F5`.

Dev-сервер автоматически сканирует `assets/levels/*.tmj` и собирает `assets/levels/manifest.json`. Общий runtime уровней находится в `src/game/scenes/GameplayScene.js`, поэтому для добавления Tiled-уровня не нужно создавать новую scene class или JS-конфиг уровня.

Полное руководство по слоям и свойствам:

```text
docs/TILED_LEVELS.md
```

Чеклист для нового уровня:

```text
docs/NEW_LEVEL_TODO.md
```
