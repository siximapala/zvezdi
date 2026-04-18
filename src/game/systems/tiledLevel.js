const MATERIAL_IDS = new Set(['neutral', 'pink', 'blue', 'green']);
const MATERIAL_ALIASES = {
  red: 'pink',
  rose: 'pink'
};
const CHARACTER_IDS = new Set(['pink', 'blue', 'green']);
const OBJECT_LAYER_ALIASES = {
  neutral: ['neutral', 'ground', 'blocks'],
  materials: ['materials', 'material', 'hazards', 'hazard', 'spikes'],
  notes: ['notes', 'note', 'texts', 'text'],
  goals: ['goals', 'goal'],
  spawns: ['spawns', 'spawn'],
  grappleAnchors: ['grappleanchors', 'grapple-anchors', 'grapple_anchors', 'anchors', 'vines'],
  switches: ['switches', 'switch'],
  plates: ['plates', 'plate'],
  doors: ['doors', 'door'],
  bridges: ['bridges', 'bridge']
};

const DEFAULT_COLORS = {
  neutral: 0x111111,
  pink: 0xd94f8a,
  blue: 0x5fa1c9,
  green: 0x8fc68d,
  switch: 0xf1d93f
};

export function resolveLevelConfig(scene, sourceLevel) {
  if (!sourceLevel.tiledKey) {
    return sourceLevel;
  }

  const tiledMap = scene.cache.json.get(sourceLevel.tiledKey);

  if (!tiledMap) {
    console.warn(`Tiled map "${sourceLevel.tiledKey}" is not loaded, using JS fallback.`);
    return sourceLevel;
  }

  return levelFromTiledMap(tiledMap, sourceLevel);
}

export function levelFromTiledMap(map, fallback = {}) {
  const mapProperties = readProperties(map);
  const mapBounds = mapWorldBounds(map);
  const worldWidth = Math.max(numberValue(mapProperties.worldWidth, fallback.world?.width), mapBounds.width);
  const worldHeight = Math.max(numberValue(mapProperties.worldHeight, fallback.world?.height), mapBounds.height);

  return {
    ...fallback,
    id: stringValue(mapProperties.id, fallback.id),
    title: stringValue(mapProperties.title, fallback.title),
    startMessage: stringValue(mapProperties.startMessage, fallback.startMessage),
    completeMessage: stringValue(mapProperties.completeMessage, fallback.completeMessage),
    nextLevel: nullableString(mapProperties.nextLevel, fallback.nextLevel),
    world: {
      width: worldWidth,
      height: worldHeight
    },
    neutral: parseNeutral(map),
    materials: parseMaterials(map),
    notes: parseNotes(map),
    goals: parseGoals(map),
    spawns: parseSpawns(map),
    grappleAnchors: parseGrappleAnchors(map),
    switches: parseActivators(map, 'switches'),
    plates: parseActivators(map, 'plates'),
    doors: parseDoors(map),
    bridges: parseBridges(map)
  };
}

function parseNeutral(map) {
  return getObjects(map, 'neutral').map(rectConfig);
}

function parseMaterials(map) {
  return getObjects(map, 'materials').map((object) => {
    const properties = readProperties(object);
    const typeParts = splitKind(object.type || object.class || object.name);
    const material = materialValue(properties.material, typeParts.material, 'neutral');
    const shape = stringValue(properties.shape, typeParts.shape, 'block');
    const config = shape === 'slope' ? slopeConfig(object) : rectConfig(object);

    return {
      ...config,
      material,
      shape,
      direction: stringValue(properties.direction, 'upRight'),
      teeth: integerValue(properties.teeth, 4),
      steps: integerValue(properties.steps, 0),
      stepWidth: numberValue(properties.stepWidth, 32),
      stepHeight: numberValue(properties.stepHeight, 24)
    };
  });
}

function parseNotes(map) {
  return getObjects(map, 'notes').map((object) => {
    const properties = readProperties(object);

    return {
      x: object.x,
      y: object.y,
      text: stringValue(properties.text, object.text?.text, object.name, '')
    };
  });
}

function parseGoals(map) {
  return getObjects(map, 'goals').map((object) => {
    const properties = readProperties(object);

    return {
      ...rectConfig(object),
      id: characterValue(properties.id, object.name, object.type)
    };
  });
}

function parseSpawns(map) {
  const spawns = {};

  for (const object of getObjects(map, 'spawns')) {
    const properties = readProperties(object);
    const id = characterValue(properties.id, object.name, object.type);

    if (id) {
      spawns[id] = pointConfig(object);
    }
  }

  return spawns;
}

function parseGrappleAnchors(map) {
  return getObjects(map, 'grappleAnchors').map((object, index) => {
    const properties = readProperties(object);

    return {
      id: stringValue(properties.id, object.name, `vine-${index + 1}`),
      ...pointConfig(object),
      radius: numberValue(properties.radius, 420),
      minLength: numberValue(properties.minLength, 74),
      maxLength: numberValue(properties.maxLength, properties.radius, 420)
    };
  });
}

function parseActivators(map, layerKey) {
  return getObjects(map, layerKey).map((object, index) => {
    const properties = readProperties(object);
    const requires = stringValue(properties.requires, 'any');

    return {
      ...rectConfig(object),
      id: stringValue(properties.id, object.name, `${layerKey}-${index + 1}`),
      color: colorValue(properties.color, defaultColorFor(requires, layerKey === 'switches' ? 'switch' : 'neutral')),
      requires,
      latch: booleanValue(properties.latch, false),
      label: stringValue(properties.label, object.name, '')
    };
  });
}

function parseDoors(map) {
  return getObjects(map, 'doors').map((object, index) => {
    const properties = readProperties(object);

    return {
      ...rectConfig(object),
      id: stringValue(properties.id, object.name, `door-${index + 1}`),
      color: colorValue(properties.color, DEFAULT_COLORS.neutral),
      opensWhen: listValue(properties.opensWhen),
      latch: booleanValue(properties.latch, false)
    };
  });
}

function parseBridges(map) {
  return getObjects(map, 'bridges').map((object, index) => {
    const properties = readProperties(object);

    return {
      ...rectConfig(object),
      id: stringValue(properties.id, object.name, `bridge-${index + 1}`),
      color: colorValue(properties.color, DEFAULT_COLORS.neutral),
      appearsWhen: listValue(properties.appearsWhen),
      latch: booleanValue(properties.latch, false)
    };
  });
}

function getObjects(map, aliasKey) {
  const aliases = OBJECT_LAYER_ALIASES[aliasKey];

  return (map.layers ?? [])
    .filter((layer) => layer.type === 'objectgroup' && layer.visible !== false && aliases.includes(normalize(layer.name)))
    .flatMap((layer) => layer.objects ?? []);
}

function readProperties(source) {
  return Object.fromEntries((source.properties ?? []).map((property) => [property.name, property.value]));
}

function mapWorldBounds(map) {
  const mapWidth = numberValue(map.width) * numberValue(map.tilewidth);
  const mapHeight = numberValue(map.height) * numberValue(map.tileheight);
  let maxX = mapWidth;
  let maxY = mapHeight;

  for (const layer of map.layers ?? []) {
    if (layer.type !== 'objectgroup') {
      continue;
    }

    for (const object of layer.objects ?? []) {
      maxX = Math.max(maxX, numberValue(object.x) + numberValue(object.width));
      maxY = Math.max(maxY, numberValue(object.y) + numberValue(object.height));
    }
  }

  return {
    width: Math.ceil(maxX),
    height: Math.ceil(maxY)
  };
}

function rectConfig(object) {
  const properties = readProperties(object);
  const config = {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height
  };

  if (properties.oneWay !== undefined) {
    config.oneWay = booleanValue(properties.oneWay, false);
  }

  return config;
}

function slopeConfig(object) {
  return {
    x: object.x,
    y: object.y + object.height,
    width: object.width,
    height: object.height
  };
}

function pointConfig(object) {
  return {
    x: object.x + (object.width ? object.width / 2 : 0),
    y: object.y + (object.height ? object.height / 2 : 0)
  };
}

function splitKind(value) {
  const [first, second] = String(value ?? '').split(/[:/_-]/).filter(Boolean);
  const material = materialName(first);
  const shape = material ? second : first;

  return { material, shape };
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function stringValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function nullableString(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback ?? null;
  }

  const result = String(value);
  return result === 'null' || result === 'none' ? null : result;
}

function numberValue(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function integerValue(...values) {
  return Math.round(numberValue(...values));
}

function booleanValue(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return fallback;
}

function listValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function colorValue(value, fallback) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const hex = value.replace('#', '');
    const rgb = hex.length === 8 ? hex.slice(2) : hex;
    const parsed = Number.parseInt(rgb, 16);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function materialValue(...values) {
  for (const value of values) {
    const normalized = materialName(value);

    if (normalized) {
      return normalized;
    }
  }

  return 'neutral';
}

function materialName(value) {
  const normalized = normalize(value);
  const aliased = MATERIAL_ALIASES[normalized] ?? normalized;

  return MATERIAL_IDS.has(aliased) ? aliased : null;
}

function characterValue(...values) {
  for (const value of values) {
    const normalized = normalize(value);

    if (CHARACTER_IDS.has(normalized)) {
      return normalized;
    }
  }

  return '';
}

function defaultColorFor(requires, fallbackKey) {
  return DEFAULT_COLORS[requires] ?? DEFAULT_COLORS[fallbackKey] ?? DEFAULT_COLORS.neutral;
}
