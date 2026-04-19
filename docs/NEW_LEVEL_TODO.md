# TODO: создать новый уровень в Tiled

## Быстрый путь

Уровень добавляется только файлом `.tmj` в `assets/levels`. JS-конфиг и отдельную scene class создавать не нужно.

1. Скопируй существующий уровень:

```text
assets/levels/level-two.tmj
```

например в:

```text
assets/levels/level-four.tmj
```

2. Открой новый `.tmj` в Tiled.

3. Выбери свойства карты, не свойства объекта.

В Tiled сними выделение с объектов или выбери саму карту в панели проекта.

4. Задай map properties:

Минимум:

```text
id = level-four
alias = 4
nextLevel = level-five
```

5. Если это последний уровень:

```text
nextLevel = null
```

Если после него должен идти другой уровень:

```text
nextLevel = level-five
```

6. Убедись, что есть слой `Spawns`.

На нём должны быть все три точки спавна персонажей:

```text
pink
blue
green
```

7. Убедись, что есть слой `Goals`.

На нём должны быть прямоугольники конечных целей:

```text
pink
blue
green
```

8. Делай обычные стены, пол и блоки на слое:

```text
Neutral
```

9. Для тонких островков-платформ используй прямоугольники на `Neutral` высотой `<= 34`.

Они автоматически станут one-way платформами: сверху стоишь, сбоку и снизу не цепляешься.

10. Если тонкий блок должен быть обычной твёрдой стеной, добавь ему property:

```text
oneWay = false
```

## Материалы

11. Делай цветные поверхности на слое:

```text
Materials
```

Свойства объекта:

```text
material = pink | blue | green
shape = block | slope | spikes | stairs
```

12. Для красных/розовых шипов:

```text
material = red
shape = spikes
teeth = 5
```

`red` автоматически считается как `pink`.

13. Для рампы:

```text
material = blue
shape = slope
direction = upRight | downRight
```

## Механики

14. Для лозы Мяты добавь point object на слой:

```text
GrappleAnchors
```

Полезные свойства:

```text
radius = 620
minLength = 74
maxLength = 540
```

Мята цепляется двойным нажатием `I`, если anchor не за стеной.

15. Для кнопок/плит используй слой:

```text
Plates
```

Пример:

```text
id = green-bridge
requires = green
latch = true
color = #ff8fc68d
```

16. Для мостов используй слой:

```text
Bridges
```

Пример:

```text
id = gap-bridge
appearsWhen = green-bridge
latch = true
color = #ff111111
```

17. Для дверей используй слой:

```text
Doors
```

Пример:

```text
id = final-door
opensWhen = pink-plate,blue-plate,green-plate
latch = true
color = #ff111111
```

18. Для текста-подсказок используй слой:

```text
Notes
```

У объекта добавь property:

```text
text = Двойное I - лоза
```

## Размер карты

19. Если расширяешь уровень вправо:

```text
Карта -> Изменить размер карты...
```

Увеличь ширину. Игровой мир расширится автоматически.

`worldWidth` нужен только если хочешь пустое место за пределами сетки.

## Проверка

20. Сохрани `.tmj`.

21. Обнови браузер:

```text
Ctrl+F5
```

22. Открой уровень напрямую:

```text
http://127.0.0.1:4173/?level=4
```

или:

```text
http://127.0.0.1:4173/?level=level-four
```

23. Проверь базовый чеклист:

```text
- все три персонажа появляются
- камера видит всех
- стены не дают карабкаться
- one-way платформы работают
- шипы убивают нужных персонажей
- лоза цепляется только если anchor не за стеной
- все три goals достижимы
- после победы Enter ведёт на nextLevel
```

24. Если уровень не появился, проверь:

```text
- файл лежит в assets/levels
- расширение именно .tmj
- в map properties есть id
- alias не конфликтует с другим уровнем
- после сохранения сделан Ctrl+F5
```

25. Чтобы проверить, видит ли dev-server уровень, открой:

```text
http://127.0.0.1:4173/assets/levels/manifest.json
```

Там должен быть твой новый уровень.
