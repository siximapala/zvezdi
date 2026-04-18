export const CHARACTERS = [
  {
    id: 'pink',
    name: 'Искра',
    textureKey: 'star-pink',
    spritePath: 'assets/sprites/star-pink.svg',
    color: 0xd94f8a,
    lightColor: 0xff79ae,
    spawn: { x: 130, y: 560 },
    speed: 265,
    jump: 610,
    controls: {
      left: 'A',
      right: 'D',
      jump: 'W'
    },
    surfaces: {
      pink: 'solid',
      blue: 'slippery',
      green: 'ghost'
    },
    copy: 'держится за розовые шипы'
  },
  {
    id: 'blue',
    name: 'Волна',
    textureKey: 'star-blue',
    spritePath: 'assets/sprites/star-blue.svg',
    color: 0x5fa1c9,
    lightColor: 0x89d0ff,
    spawn: { x: 190, y: 560 },
    speed: 258,
    jump: 590,
    controls: {
      left: 'LEFT',
      right: 'RIGHT',
      jump: 'UP'
    },
    surfaces: {
      pink: 'deadly',
      blue: 'solid',
      green: 'ghost'
    },
    copy: 'уверенно идёт по синему склону'
  },
  {
    id: 'green',
    name: 'Мята',
    textureKey: 'star-green',
    spritePath: 'assets/sprites/star-green.svg',
    color: 0x8fc68d,
    lightColor: 0xc2f0b8,
    spawn: { x: 250, y: 560 },
    speed: 250,
    jump: 635,
    controls: {
      left: 'J',
      right: 'L',
      jump: 'I',
      down: 'M',
      ability: 'K'
    },
    surfaces: {
      pink: 'deadly',
      blue: 'slippery',
      green: 'solid'
    },
    copy: 'видит зелёные блоки как обычный путь'
  }
];

export const CHARACTER_BY_ID = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character])
);
