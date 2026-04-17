export const LEVEL_TWO = {
  id: 'level-two',
  title: 'Уровень 2',
  startMessage: 'Мята разгоняется на синей горке, прыгает через разрыв и цепляется лозой: K',
  completeMessage: 'Уровень 2 пройден. Enter: дальше',
  nextLevel: 'LevelThreeScene',
  world: {
    width: 2200,
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
    { x: 1500, y: 642, width: 700, height: 96 },
    { x: 1620, y: 540, width: 120, height: 24 },
    { x: 1790, y: 482, width: 118, height: 24 }
  ],
  materials: [
    { material: 'blue', shape: 'slope', x: 532, y: 642, width: 540, height: 245, direction: 'downRight' },
    { material: 'pink', shape: 'spikes', x: 1120, y: 650, width: 305, height: 84, teeth: 4 },
    { material: 'green', shape: 'block', x: 1840, y: 420, width: 150, height: 28 }
  ],
  notes: [
    { x: 96, y: 120, text: 'Волна может перевозить друзей на голове. Мята: K - лоза' },
    { x: 560, y: 372, text: 'Чужие звёзды срываются вниз по треугольной синей горке' },
    { x: 1180, y: 360, text: 'Мята сохраняет скорость и цепляется лозой: K' },
    { x: 1640, y: 598, text: 'После разгона скорость остаётся в воздухе' }
  ],
  grappleAnchors: [
    { id: 'vine-1', x: 1350, y: 248, radius: 470, pull: 52, duration: 980 },
    { id: 'vine-2', x: 1668, y: 290, radius: 390, pull: 44, duration: 760 }
  ],
  goals: [
    { id: 'pink', x: 2030, y: 586, width: 48, height: 58 },
    { id: 'blue', x: 2088, y: 586, width: 48, height: 58 },
    { id: 'green', x: 2146, y: 586, width: 48, height: 58 }
  ]
};
