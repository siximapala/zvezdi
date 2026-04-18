import { MATERIALS } from '../config/level-one.js';

export const COLLISION_CATEGORIES = {
  player: 0x0001,
  neutral: 0x0002,
  pink: 0x0004,
  blue: 0x0008,
  green: 0x0010,
  door: 0x0020,
  sensor: 0x0040
};

const MATERIAL_CATEGORY = {
  neutral: COLLISION_CATEGORIES.neutral,
  pink: COLLISION_CATEGORIES.pink,
  blue: COLLISION_CATEGORIES.blue,
  green: COLLISION_CATEGORIES.green
};

const MATERIAL_FRICTION = {
  neutral: { friction: 0, frictionStatic: 0 },
  pink: { friction: 0, frictionStatic: 0 },
  blue: { friction: 0.02, frictionStatic: 0.02 },
  green: { friction: 0, frictionStatic: 0 }
};

export function createMaterialGroups() {
  return {
    neutral: [],
    pink: [],
    blue: [],
    green: [],
    sensors: []
  };
}

export function collisionMaskForCharacter(character) {
  let mask = COLLISION_CATEGORIES.player | COLLISION_CATEGORIES.neutral | COLLISION_CATEGORIES.door | COLLISION_CATEGORIES.sensor;

  for (const material of ['pink', 'blue', 'green']) {
    const behavior = behaviorFor(character, material);

    if (behavior === 'solid' || behavior === 'slippery') {
      mask |= MATERIAL_CATEGORY[material];
    }
  }

  return mask;
}

export function addMaterialBlock(scene, group, material, config) {
  const palette = MATERIALS[material];
  const block = scene.add
    .rectangle(config.x, config.y, config.width, config.height, palette.color, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(3, palette.edge, 1);
  const oneWayPlatform =
    material === 'neutral' && (config.oneWay === true || (config.oneWay !== false && config.height <= 34 && config.width >= 48));
  const body = addStaticRectangleBody(scene, material, config, { oneWayPlatform });
  const sensor = addMaterialSensor(scene, material, config);
  const entry = { block, body, sensor, material, config };

  group.push(entry);
  scene.materialGroups.sensors.push(sensor);
  return entry;
}

export function addSpikeField(scene, group, material, config) {
  const palette = MATERIALS[material];
  const graphics = scene.add.graphics();
  const toothWidth = config.width / config.teeth;

  graphics.fillStyle(palette.color, 1);
  graphics.lineStyle(3, palette.edge, 1);

  for (let index = 0; index < config.teeth; index += 1) {
    const left = config.x + toothWidth * index;
    const center = left + toothWidth / 2;
    const right = left + toothWidth;
    graphics.fillTriangle(left, config.y + config.height, center, config.y, right, config.y + config.height);
    graphics.strokeTriangle(left, config.y + config.height, center, config.y, right, config.y + config.height);
  }

  const bodyConfig = {
    x: config.x,
    y: config.y + config.height * 0.3,
    width: config.width,
    height: config.height * 0.7
  };
  const body = addStaticRectangleBody(scene, material, bodyConfig);
  const sensor = addMaterialSensor(scene, material, bodyConfig);
  const entry = { graphics, body, sensor, material, config: bodyConfig };

  group.push(entry);
  scene.materialGroups.sensors.push(sensor);
  return entry;
}

export function addStairs(scene, group, material, config) {
  const blocks = [];

  for (let index = 0; index < config.steps; index += 1) {
    const blockHeight = (index + 1) * config.stepHeight;

    blocks.push(
      addMaterialBlock(scene, group, material, {
        x: config.x + index * config.stepWidth,
        y: config.y - blockHeight,
        width: config.stepWidth + 2,
        height: blockHeight + 78
      })
    );
  }

  return blocks;
}

export function addTriangleSlope(scene, material, config) {
  const palette = MATERIALS[material];
  const graphics = scene.add.graphics();
  const points =
    config.direction === 'downRight'
      ? [
          { x: config.x, y: config.y - config.height },
          { x: config.x, y: config.y },
          { x: config.x + config.width, y: config.y }
        ]
      : [
          { x: config.x, y: config.y },
          { x: config.x + config.width, y: config.y },
          { x: config.x + config.width, y: config.y - config.height }
        ];
  const edgeStart = points[0];
  const edgeEnd = points[2];
  const centerX = (edgeStart.x + edgeEnd.x) / 2;
  const centerY = (edgeStart.y + edgeEnd.y) / 2;
  const length = Math.hypot(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
  const angle = Math.atan2(edgeEnd.y - edgeStart.y, edgeEnd.x - edgeStart.x);
  const slideDirection = config.direction === 'downRight' ? 1 : -1;
  const slopeLine = {
    x1: edgeStart.x,
    y1: edgeStart.y,
    x2: edgeEnd.x,
    y2: edgeEnd.y,
    minX: Math.min(edgeStart.x, edgeEnd.x),
    maxX: Math.max(edgeStart.x, edgeEnd.x)
  };

  graphics.fillStyle(palette.color, 1);
  graphics.lineStyle(3, palette.edge, 1);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  graphics.lineTo(points[1].x, points[1].y);
  graphics.lineTo(points[2].x, points[2].y);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  const body = addStaticMatterBody(
    scene,
    material,
    scene.matter.add.rectangle(centerX, centerY, length + 22, 24, {
      angle,
      isStatic: true,
      ...MATERIAL_FRICTION[material],
      collisionFilter: {
        category: MATERIAL_CATEGORY[material],
        mask: COLLISION_CATEGORIES.player
      }
    }),
    'surface',
    { slideDirection, slope: true, slopeLine }
  );
  const sensor = addStaticMatterBody(
    scene,
    material,
    scene.matter.add.rectangle(centerX, centerY, length + 34, 58, {
      angle,
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        category: COLLISION_CATEGORIES.sensor,
        mask: COLLISION_CATEGORIES.player
      }
    }),
    'sensor',
    { slideDirection, slope: true, slopeLine }
  );
  const entry = {
    ...config,
    material,
    slideDirection,
    slopeLine,
    graphics,
    body,
    sensor
  };

  scene.materialGroups[material].push(entry);
  scene.materialGroups.sensors.push(sensor);
  return entry;
}

export function behaviorFor(character, material) {
  if (material === 'neutral') {
    return 'solid';
  }

  return character.surfaces[material] ?? 'ghost';
}

function addStaticRectangleBody(scene, material, config, extra = {}) {
  return addStaticMatterBody(
    scene,
    material,
    scene.matter.add.rectangle(config.x + config.width / 2, config.y + config.height / 2, config.width, config.height, {
      isStatic: true,
      ...MATERIAL_FRICTION[material],
      collisionFilter: {
        category: MATERIAL_CATEGORY[material],
        mask: COLLISION_CATEGORIES.player
      }
    }),
    'surface',
    {
      ...extra,
      topY: config.y,
      minX: config.x,
      maxX: config.x + config.width
    }
  );
}

function addMaterialSensor(scene, material, config) {
  return addStaticMatterBody(
    scene,
    material,
    scene.matter.add.rectangle(config.x + config.width / 2, config.y + config.height / 2, config.width, config.height, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        category: COLLISION_CATEGORIES.sensor,
        mask: COLLISION_CATEGORIES.player
      }
    }),
    'sensor'
  );
}

function addStaticMatterBody(scene, material, body, kind, extra = {}) {
  annotateBody(body, {
    gameKind: kind,
    material,
    ...extra
  });

  return body;
}

export function annotateBody(body, metadata) {
  Object.assign(body, metadata);

  for (const part of body.parts ?? []) {
    Object.assign(part, metadata);
  }

  return body;
}
