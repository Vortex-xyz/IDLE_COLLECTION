import type { MonsterDef, Rarity, UpgradeId } from "./types";

export const PRESTIGE_WAVE = 15;
export const MAX_OFFLINE_SEC = 8 * 3600;
export const GEM_SUMMON_COST = 45;
export const PITY_GOLD = 40;
export const PITY_GEM = 25;
export const MAX_STARS = 5;

export const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export const DUP_GEMS: Record<Rarity, number> = {
  common: 2,
  rare: 8,
  epic: 22,
  legendary: 60,
};

export const RARITY_COST: Record<Rarity, number> = {
  common: 1,
  rare: 1.7,
  epic: 2.8,
  legendary: 5,
};

export const UPGRADES: {
  id: UpgradeId;
  name: string;
  max: number;
  base: number;
  blurb: string;
}[] = [
  { id: "damage", name: "Greed's Edge", max: 30, base: 60, blurb: "+12% damage for every bound monster." },
  { id: "gold", name: "Tax Ledger", max: 30, base: 60, blurb: "+12% gold from heroes and cleared waves." },
  { id: "haste", name: "War Drums", max: 20, base: 90, blurb: "+6% attack speed." },
  { id: "vault", name: "Iron Bands", max: 20, base: 75, blurb: "+28 vault integrity." },
  { id: "luck", name: "Crooked Dice", max: 10, base: 220, blurb: "Shifts summon odds toward rarer monsters." },
];

const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

export function getUpgrade(id: UpgradeId) {
  return UPGRADE_MAP.get(id)!;
}

export const MONSTERS: MonsterDef[] = [
  {
    id: "slime",
    name: "Gutter Slime",
    rarity: "common",
    blurb: "Splashes gutter-acid across heroes who bunch on the stair.",
    damage: 10,
    interval: 0.95,
    range: 210,
    shots: 1,
    splashRadius: 36,
    splashRatio: 0.45,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "bat",
    name: "Vault Bat",
    rarity: "common",
    blurb: "Darts from the rafters and bites before the line can brace.",
    damage: 6,
    interval: 0.48,
    range: 255,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "rat",
    name: "Coin Rat",
    rarity: "common",
    blurb: "Every bite shakes a coin loose from a hero's purse.",
    damage: 7,
    interval: 0.85,
    range: 200,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 1,
    execute: 0,
  },
  {
    id: "imp",
    name: "Cinder Imp",
    rarity: "rare",
    blurb: "Leaves a cinder in the wound that keeps eating armor.",
    damage: 13,
    interval: 1,
    range: 220,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0.4,
    burnTime: 2.4,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "wolf",
    name: "Hoard Wolf",
    rarity: "rare",
    blurb: "Tears with vicious luck. One bite in four lands twice as hard.",
    damage: 15,
    interval: 0.8,
    range: 215,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0.25,
    critMult: 2.1,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "golem",
    name: "Ledger Golem",
    rarity: "rare",
    blurb: "Slow, heavy, and fond of shattering a whole rank at once.",
    damage: 24,
    interval: 1.35,
    range: 168,
    shots: 1,
    splashRadius: 48,
    splashRatio: 0.7,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "wraith",
    name: "Tax Wraith",
    rarity: "epic",
    blurb: "A chill that drags boots. Slowed heroes linger in the kill zone.",
    damage: 18,
    interval: 0.9,
    range: 240,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 0.55,
    slowTime: 2.2,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "hydra",
    name: "Twin Hydra",
    rarity: "epic",
    blurb: "Two heads, two bites, both of them rude.",
    damage: 11,
    interval: 0.72,
    range: 220,
    shots: 2,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "drake",
    name: "Greed Drake",
    rarity: "legendary",
    blurb: "Breathes a fan of fire that splashes the stair and keeps burning.",
    damage: 30,
    interval: 1.15,
    range: 250,
    shots: 1,
    splashRadius: 42,
    splashRatio: 0.55,
    burn: 0.35,
    burnTime: 2.2,
    slow: 1,
    slowTime: 0,
    critChance: 0.1,
    critMult: 1.8,
    goldOnHit: 0,
    execute: 0,
  },
  {
    id: "lich",
    name: "Crown Lich",
    rarity: "legendary",
    blurb: "Finishes the nearly fallen and tithes whatever they were carrying.",
    damage: 22,
    interval: 0.88,
    range: 260,
    shots: 1,
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    critChance: 0,
    critMult: 2,
    goldOnHit: 2,
    execute: 0.14,
  },
];

const BY_ID = new Map(MONSTERS.map((m) => [m.id, m]));

export function getMonster(id: string): MonsterDef | undefined {
  return BY_ID.get(id);
}

export function isMonsterId(id: string): boolean {
  return BY_ID.has(id);
}

export const AD_COOLDOWN = { summon: 600, gems: 900, skip: 1200 } as const;
