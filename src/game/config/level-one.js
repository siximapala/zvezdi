export const MATERIALS = {
  neutral: {
    label: 'камень',
    color: 0x111111,
    edge: 0x111111
  },
  pink: {
    label: 'розовый',
    color: 0xd94f8a,
    edge: 0xbe3e77
  },
  blue: {
    label: 'синий',
    color: 0x5fa1c9,
    edge: 0x4c88ac
  },
  green: {
    label: 'зелёный',
    color: 0x8fc68d,
    edge: 0x6aa66b
  }
};

export const LEVEL_ONE = {
  id: 'level-one',
  title: 'Уровень 1',
  startMessage: 'Доведите всех троих до своих световых ворот',
  completeMessage: 'Уровень пройден. Enter: дальше',
  nextLevel: 'level-two',
  world: {
    width: 1720,
    height: 720
  },
  neutral: [
    { x: 0, y: 642, width: 396, height: 96 },
    { x: 392, y: 612, width: 120, height: 126 },
    { x: 420, y: 552, width: 72, height: 24 },
    { x: 638, y: 520, width: 72, height: 24 },
    { x: 835, y: 552, width: 72, height: 24 },
    { x: 1036, y: 540, width: 82, height: 24 },
    { x: 1160, y: 502, width: 82, height: 24 },
    { x: 1320, y: 474, width: 82, height: 24 },
    { x: 1460, y: 534, width: 72, height: 24 },
    { x: 1010, y: 652, width: 710, height: 86 },
    { x: 1370, y: 500, width: 124, height: 24 },
    { x: 1500, y: 440, width: 136, height: 24 }
  ],
  materials: [
    { material: 'pink', shape: 'spikes', x: 500, y: 610, width: 410, height: 96, teeth: 5 },
    { material: 'blue', shape: 'slope', x: 1084, y: 652, width: 430, height: 150, direction: 'upRight' },
    { material: 'green', shape: 'block', x: 1220, y: 456, width: 150, height: 28 },
    { material: 'green', shape: 'block', x: 1532, y: 530, width: 92, height: 28 }
  ],
  notes: [
    { x: 96, y: 112, text: 'Все трое нужны у выхода' },
    { x: 500, y: 548, text: 'Искра держится, остальные сгорают' },
    { x: 1032, y: 584, text: 'Волна идёт, другие скользят назад' },
    { x: 1214, y: 420, text: 'Мята видит зелёный путь' }
  ],
  goals: [
    { id: 'pink', x: 1518, y: 586, width: 48, height: 58 },
    { id: 'blue', x: 1580, y: 586, width: 48, height: 58 },
    { id: 'green', x: 1642, y: 586, width: 48, height: 58 }
  ]
};
