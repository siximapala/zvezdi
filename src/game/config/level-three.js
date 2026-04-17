export const LEVEL_THREE = {
  id: 'level-three',
  title: 'Уровень 3',
  startMessage: 'Встаньте друг на друга, нажмите верхний свет и откройте ворота',
  completeMessage: 'Уровень 3 пройден',
  nextLevel: null,
  world: {
    width: 1900,
    height: 720
  },
  neutral: [
    { x: 0, y: 642, width: 430, height: 96 },
    { x: 520, y: 642, width: 270, height: 96 },
    { x: 940, y: 642, width: 960, height: 96 },
    { x: 545, y: 512, width: 120, height: 24 },
    { x: 690, y: 430, width: 150, height: 24 },
    { x: 1205, y: 548, width: 220, height: 24 },
    { x: 1465, y: 500, width: 165, height: 24 }
  ],
  materials: [
    { material: 'blue', shape: 'slope', x: 1010, y: 642, width: 336, height: 112, direction: 'upRight' },
    { material: 'pink', shape: 'spikes', x: 815, y: 618, width: 105, height: 76, teeth: 2 },
    { material: 'green', shape: 'block', x: 1458, y: 416, width: 118, height: 26 }
  ],
  notes: [
    { x: 110, y: 124, text: 'Теперь звёзды могут стоять друг на друге' },
    { x: 546, y: 468, text: 'Башня из друзей достанет до верхнего света' },
    { x: 1018, y: 582, text: 'Синяя горка всё ещё скидывает чужих назад' },
    { x: 1264, y: 606, text: 'Три цвета держат финальную дверь' }
  ],
  switches: [
    {
      id: 'tower',
      x: 718,
      y: 398,
      width: 82,
      height: 18,
      color: 0xf1d93f,
      requires: 'any',
      label: 'верхний свет'
    }
  ],
  plates: [
    { id: 'pink-plate', x: 1184, y: 624, width: 72, height: 18, color: 0xd94f8a, requires: 'pink' },
    { id: 'blue-plate', x: 1278, y: 624, width: 72, height: 18, color: 0x5fa1c9, requires: 'blue' },
    { id: 'green-plate', x: 1372, y: 624, width: 72, height: 18, color: 0x8fc68d, requires: 'green' }
  ],
  doors: [
    {
      id: 'tower-door',
      x: 900,
      y: 548,
      width: 40,
      height: 94,
      color: 0x111111,
      opensWhen: ['tower'],
      latch: true
    },
    {
      id: 'final-door',
      x: 1640,
      y: 520,
      width: 42,
      height: 122,
      color: 0x111111,
      opensWhen: ['pink-plate', 'blue-plate', 'green-plate'],
      latch: true
    }
  ],
  goals: [
    { id: 'pink', x: 1710, y: 586, width: 48, height: 58 },
    { id: 'blue', x: 1770, y: 586, width: 48, height: 58 },
    { id: 'green', x: 1830, y: 586, width: 48, height: 58 }
  ]
};
