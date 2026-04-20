# Уровни в Tiled

Игра поддерживает object-only карты Tiled (`.tmj`). Tiled используется как редактор уровней, а Phaser/Matter уже в игре создаёт настоящую игровую геометрию, коллизии и механику.

## Быстрый цикл

1. Установи Tiled: https://www.mapeditor.org/
2. Открой существующий `.tmj` в `assets/levels` или сохрани туда новую карту Tiled.
3. Двигай, растягивай, дублируй или добавляй объекты на object layers.
4. Сохрани файл как JSON map (`.tmj`).
5. Запусти игру и открой `/?level=2`, `/?level=level-two` или id своего нового уровня.
6. После сохранения карты обновляй браузер через `Ctrl+F5`.

## Главное правило

Объекты должны лежать на ожидаемых слоях. Импортёр читает названия слоёв, а не визуальные цвета в Tiled.

## Слои

`Spawns`
: Point objects с именами `pink`, `blue`, `green`.

`Neutral`
: Rectangle objects. Они становятся обычными чёрными платформами, полом и стенами.

Тонкие neutral-прямоугольники (`height <= 34`) по умолчанию считаются one-way островками: игроки стоят на них при приземлении сверху, но не цепляются сбоку и снизу. Если тонкий объект должен быть полностью твёрдым блоком, добавь ему свойство:

```text
oneWay = false
```

`Materials`
: Rectangle objects с пользовательскими свойствами:

```text
material = pink | blue | green
shape = block | slope | spikes | stairs
direction = upRight | downRight   только для slope
teeth = number                    только для spikes
```

`red` принимается как alias для `pink`, поэтому `material = red` работает для красных/розовых шипов.

Шипы можно класть и на слой `Hazards`. Импортёр обрабатывает `Hazards` так же, как `Materials`.

Если объект с `material`/`shape` случайно остался на `Neutral`, игра всё равно распознает его как material-объект и не сделает из него чёрный блок. Например `pink-spikes` с `material = pink` и `shape = spikes` будет работать как шипы даже на неправильном слое. Для порядка в Tiled всё равно лучше переносить такие объекты на `Materials` или `Hazards`.

Быстрая настройка шипов:

```text
Layer: Materials или Hazards
Object: rectangle
Name или class: red-spikes
Properties:
  material = red
  shape = spikes
  teeth = 5
```

Для рампы нарисуй прямоугольник, который задаёт bounding box склона. Игра превратит его в треугольный визуал и наклонное Matter-тело.

`GrappleAnchors`
: Point objects для лозы Мяты. Полезные свойства:

```text
radius = 620
minLength = 74
maxLength = 540
```

Мята цепляется клавишей `O`, если anchor находится в радиусе и не закрыт стеной.

`Plates`
: Rectangle trigger objects. Полезные свойства:

```text
id = green-bridge
requires = any | pink | blue | green
latch = true | false
color = #ff8fc68d
```

Для быстрых копипаст из Tiled игра также понимает типовые имена `pink-plate`, `blue-plate`, `green-plate`: если такой объект случайно остался на `Neutral`, импортёр всё равно сделает из него цветную plate и не создаст чёрную платформу. Но для порядка в файле лучше переносить такие объекты на слой `Plates`.

`Switches`
: То же по форме, что `Plates`, но объекты нужно класть на слой `Switches`.

`Doors`
: Rectangle objects. Полезные свойства:

```text
id = final-door
opensWhen = pink-plate,blue-plate,green-plate
latch = true | false
color = #ff111111
```

`final-door` может работать и без `opensWhen`: по умолчанию она ждёт `pink-plate,blue-plate,green-plate`. Явное свойство `opensWhen` всё равно лучше, если дверь должна открываться от других кнопок.

`Bridges`
: Rectangle objects, которые появляются после активации кнопок/плит. Полезные свойства:

```text
id = gap-bridge
appearsWhen = green-bridge
latch = true | false
color = #ff111111
```

`Goals`
: Rectangle objects с именами `pink`, `blue`, `green`.

`Notes`
: Objects со свойством `text`. Они рисуются в игре как подсказки.

## Свойства карты

Эти свойства задаются на самой карте, не на объекте:

```text
id = level-two
alias = 2
title = Level 2
worldWidth = 2380
worldHeight = 720
nextLevel = level-three
```

JS-конфигов уровней больше нет. Все уровни приходят из `.tmj`-файлов в `assets/levels`, а недостающие служебные поля получают только общие безопасные значения по умолчанию.

`nextLevel` обычно должен быть id другого уровня:

```text
nextLevel = level-three
```

Но alias тоже принимается:

```text
nextLevel = 4
```

Если уровень последний:

```text
nextLevel = null
```

Размер мира считается автоматически: игра берёт максимум из `worldWidth`, размера Tiled-карты и дальних объектов. Если ты расширяешь карту в Tiled, playable world расширяется вместе с ней. `worldWidth` нужен только если хочешь оставить пустое пространство за пределами видимой сетки.

Dev-server автоматически сканирует:

```text
assets/levels/*.tmj
```

и отдаёт их игре через:

```text
assets/levels/manifest.json
```

Поэтому для нового Tiled-файла не нужен отдельный scene class.

## Добавить новый Tiled-уровень

1. Скопируй `assets/levels/level-two.tmj` в новый файл, например:

```text
assets/levels/level-four.tmj
```

2. В Tiled задай свойства карты:

```text
id = level-four
alias = 4
title = Level 4
nextLevel = null
worldWidth = 1280
worldHeight = 720
```

3. Сохрани файл.

4. Обнови браузер через `Ctrl+F5`.

5. Открой уровень:

```text
/?level=4
```

или:

```text
/?level=level-four
```

Отдельный JS-конфиг или scene class для нового уровня не нужен. Если `.tmj` лежит в `assets/levels` и у карты есть уникальный `id`, dev-server добавит уровень в manifest автоматически.
