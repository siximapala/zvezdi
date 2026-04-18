import { LEVEL_ONE } from './level-one.js';
import { LEVEL_THREE } from './level-three.js';
import { LEVEL_TWO } from './level-two.js';

const BASE_LEVEL_REGISTRY = [
  { alias: '1', sceneKey: LEVEL_ONE.id, level: LEVEL_ONE },
  { alias: '2', sceneKey: LEVEL_TWO.id, level: LEVEL_TWO },
  { alias: '3', sceneKey: LEVEL_THREE.id, level: LEVEL_THREE }
];

let activeLevelRegistry = [...BASE_LEVEL_REGISTRY];

export function levelEntries() {
  return activeLevelRegistry;
}

export function firstLevelEntry() {
  return activeLevelRegistry[0];
}

export function registerDiscoveredLevels(manifest) {
  const discovered = Array.isArray(manifest?.levels) ? manifest.levels : [];
  const merged = new Map(BASE_LEVEL_REGISTRY.map((entry) => [entry.sceneKey, entry]));

  for (const item of discovered) {
    const entry = entryFromManifestItem(item);

    if (!entry || merged.has(entry.sceneKey)) {
      continue;
    }

    merged.set(entry.sceneKey, entry);
  }

  activeLevelRegistry = [...merged.values()].sort(compareLevelEntries);
  return activeLevelRegistry;
}

export function levelEntryFor(value) {
  if (!value) {
    return null;
  }

  return (
    activeLevelRegistry.find((entry) => entry.alias === value || entry.sceneKey === value || entry.level.id === value) ?? null
  );
}

function entryFromManifestItem(item) {
  const id = stringValue(item?.id, fileId(item?.path));
  const tiledPath = stringValue(item?.path);

  if (!id || !tiledPath) {
    return null;
  }

  const level = {
    id,
    tiledKey: stringValue(item.tiledKey, `${id}-tiled`),
    tiledPath,
    title: stringValue(item.title, titleFromId(id)),
    startMessage: stringValue(item.startMessage, 'Доведите всех троих до своих световых ворот'),
    completeMessage: stringValue(item.completeMessage, 'Уровень пройден. Enter: дальше'),
    nextLevel: nullableString(item.nextLevel),
    world: {
      width: numberValue(item.worldWidth, 1280),
      height: numberValue(item.worldHeight, 720)
    },
    neutral: [],
    materials: [],
    notes: [],
    goals: []
  };

  return {
    alias: nullableString(item.alias),
    sceneKey: id,
    level
  };
}

function compareLevelEntries(left, right) {
  const leftOrder = orderValue(left);
  const rightOrder = orderValue(right);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.sceneKey.localeCompare(right.sceneKey);
}

function orderValue(entry) {
  const aliasNumber = Number(entry.alias);

  if (Number.isFinite(aliasNumber)) {
    return aliasNumber;
  }

  const idNumber = Number(String(entry.sceneKey).match(/\d+$/)?.[0]);
  return Number.isFinite(idNumber) ? idNumber : 10000;
}

function fileId(filePath) {
  return String(filePath ?? '')
    .split('/')
    .pop()
    ?.replace(/\.tmj$/i, '');
}

function titleFromId(id) {
  return String(id)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function stringValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function nullableString(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const result = String(value);
  return result === 'null' || result === 'none' ? null : result;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
