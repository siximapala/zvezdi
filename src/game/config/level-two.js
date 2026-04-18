export const LEVEL_TWO = {
  id: 'level-two',
  tiledKey: 'level-two-tiled',
  tiledPath: 'assets/levels/level-two.tmj',
  title: 'Уровень 2',
  startMessage: 'Мята разгоняется на синей рампе, перелетает пропасть лозой и включает мост для всех',
  completeMessage: 'Уровень 2 пройден. Enter: дальше',
  nextLevel: 'LevelThreeScene',
  world: {
    width: 2380,
    height: 720
  },
  neutral: [
    { x: 0, y: 642, width: 420, height: 96 },
    { x: 420, y: 608, width: 124, height: 130 },
    { x: 450, y: 560, width: 104, height: 24 },
    { x: 482, y: 512, width: 104, height: 24 },
    { x: 514, y: 464, width: 96, height: 24 },
    { x: 514, y: 412, width: 82, height: 24 },
    { x: 486, y: 384, width: 28, height: 72 },
    { x: 1740, y: 642, width: 640, height: 96 },
    { x: 1860, y: 540, width: 120, height: 24 },
    { x: 2030, y: 482, width: 118, height: 24 }
  ],
  materials: [
    { material: 'blue', shape: 'slope', x: 532, y: 642, width: 540, height: 245, direction: 'downRight' },
    { material: 'green', shape: 'block', x: 2080, y: 420, width: 150, height: 28 }
  ],
  notes: [
    { x: 96, y: 120, text: 'Волна может перевозить друзей на голове. Мята: K - лоза' },
    { x: 560, y: 372, text: 'Разгон с рампы. Дальше большая пропасть' },
    { x: 1130, y: 360, text: 'K - зацепиться/отцепиться. I/M - длина лозы. J/L - раскачка' },
    { x: 1760, y: 598, text: 'Мята жмет зеленую плиту, мост появляется для всех' }
  ],
  grappleAnchors: [
    { id: 'vine-1', x: 1325, y: 230, radius: 620, minLength: 74, maxLength: 540 },
    { id: 'vine-2', x: 1650, y: 250, radius: 560, minLength: 74, maxLength: 520 }
  ],
  plates: [
    { id: 'green-bridge', x: 1776, y: 624, width: 86, height: 18, color: 0x8fc68d, requires: 'green', latch: true }
  ],
  bridges: [
    {
      id: 'gap-bridge',
      x: 1088,
      y: 606,
      width: 628,
      height: 24,
      color: 0x111111,
      appearsWhen: ['green-bridge'],
      latch: true
    }
  ],
  goals: [
    { id: 'pink', x: 2210, y: 586, width: 48, height: 58 },
    { id: 'blue', x: 2268, y: 586, width: 48, height: 58 },
    { id: 'green', x: 2326, y: 586, width: 48, height: 58 }
  ]
};
