export type Rarity = "common" | "rare" | "epic" | "legendary";
export type EnemyKind = "squire" | "runner" | "knight" | "boss";
export type UpgradeId = "damage" | "gold" | "haste" | "vault" | "luck";
export type Banner = "gold" | "gem";
export type Tab = "battle" | "summon" | "hoard" | "forge";
export type AdKind = "summon" | "gems" | "skip" | "double";

export type Owned = { level: number; stars: number };

export type PendingReward = { seconds: number; gold: number; gems: number };

export type SaveData = {
  version: 1;
  gold: number;
  gems: number;
  wave: number;
  highestWave: number;
  prestige: number;
  owned: Record<string, Owned>;
  grid: (string | null)[];
  upgrades: Record<UpgradeId, number>;
  summons: number;
  kills: number;
  pityGold: number;
  pityGem: number;
  settings: { sfx: number; music: number; shake: boolean };
  iap: { noAds: boolean; dmg2x: boolean };
  ads: { summon: number; gems: number; skip: number };
  lastActive: number;
  tutorial: boolean;
  pending: PendingReward | null;
};

export type MonsterDef = {
  id: string;
  name: string;
  rarity: Rarity;
  blurb: string;
  damage: number;
  interval: number;
  range: number;
  shots: number;
  splashRadius: number;
  splashRatio: number;
  burn: number;
  burnTime: number;
  slow: number;
  slowTime: number;
  critChance: number;
  critMult: number;
  goldOnHit: number;
  execute: number;
};

export type Modal =
  | { type: "none" }
  | { type: "offline" }
  | { type: "settings" }
  | { type: "reveal" }
  | { type: "rebirth" }
  | { type: "reset" }
  | { type: "ad" }
  | { type: "picker"; slot: number };

export type Reveal = {
  id: string;
  isNew: boolean;
  stars: number;
  gems: number;
};
