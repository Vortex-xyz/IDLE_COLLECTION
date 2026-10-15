import {
  DUP_GEMS,
  GEM_SUMMON_COST,
  MAX_STARS,
  MONSTERS,
  RARITY_COST,
  getMonster,
  getUpgrade,
} from "./data";
import { LEAK_Y, SPAWN_Y } from "./layout";
import type { Banner, EnemyKind, MonsterDef, Rarity, SaveData, UpgradeId } from "./types";

export function goldSummonCost(summons: number): number {
  return 100 + summons * 10;
}

export function gemSummonCost(): number {
  return GEM_SUMMON_COST;
}

export function damageMultiplier(save: Pick<SaveData, "upgrades" | "prestige" | "iap">): number {
  return Math.pow(1.12, save.upgrades.damage) * (1 + save.prestige * 0.08) * (save.iap.dmg2x ? 2 : 1);
}

export function goldMultiplier(save: Pick<SaveData, "upgrades" | "prestige">): number {
  return Math.pow(1.12, save.upgrades.gold) * (1 + save.prestige * 0.06);
}

export function hasteMultiplier(save: Pick<SaveData, "upgrades">): number {
  return Math.pow(1.06, save.upgrades.haste);
}

export function vaultMaxOf(upgrade: number, prestige: number): number {
  return Math.round((84 + upgrade * 28) * (1 + prestige * 0.04));
}

export function hitDamage(def: MonsterDef, level: number, stars: number, dmgMult: number): number {
  const lvl = 1 + (level - 1) * 0.22;
  const star = 1 + stars * 0.28;
  return def.damage * lvl * star * dmgMult;
}

export function attackInterval(def: MonsterDef, haste: number): number {
  return Math.max(0.12, def.interval / haste);
}

export function levelCost(id: string, level: number): number {
  const def = getMonster(id);
  const rarity = def?.rarity ?? "common";
  return Math.round(26 * Math.pow(level, 1.4) * RARITY_COST[rarity]);
}

export function upgradeCost(id: UpgradeId, level: number): number {
  return Math.round(getUpgrade(id).base * Math.pow(1.48, level));
}

export function rates(banner: Banner, luck: number): Record<Rarity, number> {
  const leg = banner === "gem" ? 0.06 + luck * 0.008 : 0.012 + luck * 0.005;
  const epic = banner === "gem" ? 0.18 + luck * 0.01 : 0.07 + luck * 0.008;
  let rare = banner === "gem" ? 0.36 : 0.24;
  if (leg + epic + rare > 0.98) rare = Math.max(0.05, 0.98 - leg - epic);
  const common = Math.max(0, 1 - leg - epic - rare);
  return { common, rare, epic, legendary: leg };
}

export function rollRarity(banner: Banner, luck: number, rng: () => number): Rarity {
  const table = rates(banner, luck);
  const r = rng();
  if (r < table.legendary) return "legendary";
  if (r < table.legendary + table.epic) return "epic";
  if (r < table.legendary + table.epic + table.rare) return "rare";
  return "common";
}

export function rollMonster(banner: Banner, luck: number, rng: () => number = Math.random): MonsterDef {
  const rarity = rollRarity(banner, luck, rng);
  const pool = MONSTERS.filter((m) => m.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)] ?? MONSTERS[0]!;
}

export function duplicateGems(rarity: Rarity): number {
  return DUP_GEMS[rarity];
}

export function maxStars(): number {
  return MAX_STARS;
}

const HP_MULT: Record<EnemyKind, number> = { squire: 1, runner: 0.58, knight: 1.9, boss: 10 };
const SPEED_MULT: Record<EnemyKind, number> = { squire: 1, runner: 1.72, knight: 0.74, boss: 0.55 };
const GOLD_MULT: Record<EnemyKind, number> = { squire: 1, runner: 0.8, knight: 1.55, boss: 7 };
const LEAK_BASE: Record<EnemyKind, number> = { squire: 11, runner: 8, knight: 16, boss: 34 };

export function makePlan(wave: number): EnemyKind[] {
  const count = Math.min(26, 6 + Math.floor((wave - 1) * 1.05));
  const plan: EnemyKind[] = [];
  for (let i = 0; i < count; i += 1) {
    if (wave >= 8 && i % 6 === 5) plan.push("knight");
    else if (wave >= 4 && i % 4 === 3) plan.push("runner");
    else plan.push("squire");
  }
  if (wave % 10 === 0) plan.push("boss");
  return plan;
}

export function spawnInterval(wave: number): number {
  return Math.max(0.42, 0.92 - (wave - 1) * 0.015);
}

export function maxHp(kind: EnemyKind, wave: number): number {
  return 18 * Math.pow(1.168, wave - 1) * HP_MULT[kind];
}

export function moveSpeed(kind: EnemyKind, wave: number): number {
  const base = 38 + Math.min(42, (wave - 1) * 0.85);
  return base * SPEED_MULT[kind];
}

export function killGold(kind: EnemyKind, wave: number): number {
  return (4 + wave * 0.9) * GOLD_MULT[kind];
}

export function clearGold(wave: number): number {
  return 24 + wave * 8;
}

export function leakDamage(kind: EnemyKind, wave: number): number {
  return Math.round(LEAK_BASE[kind] * (1 + (wave - 1) * 0.035));
}

export function bossGems(wave: number): number {
  if (wave % 10 !== 0) return 0;
  return 6 + 2 * Math.floor(wave / 10);
}

export function boardDps(save: SaveData): number {
  const dmg = damageMultiplier(save);
  const haste = hasteMultiplier(save);
  let dps = 0;
  for (const id of save.grid) {
    if (!id) continue;
    const owned = save.owned[id];
    const def = getMonster(id);
    if (!owned || !def) continue;
    const hit = hitDamage(def, owned.level, owned.stars, dmg);
    const crit = 1 + def.critChance * (def.critMult - 1);
    const interval = attackInterval(def, haste);
    const splash = def.splashRatio > 0 ? 1 + def.splashRatio * 0.75 : 1;
    dps += (hit * def.shots * crit * splash) / interval;
  }
  return dps;
}

export function computeOffline(save: SaveData, elapsedSec: number): { gold: number; gems: number } {
  const elapsed = Math.min(Math.max(0, elapsedSec), 8 * 3600);
  const dps = boardDps(save);
  if (dps <= 0 || elapsed <= 0) return { gold: 0, gems: 0 };
  const wave = Math.max(1, save.wave);
  const plan = makePlan(wave);
  let hp = 0;
  let goldSum = 0;
  let travelSum = 0;
  for (const kind of plan) {
    hp += maxHp(kind, wave);
    goldSum += killGold(kind, wave);
    travelSum += (LEAK_Y - SPAWN_Y) / moveSpeed(kind, wave);
  }
  const avgTravel = travelSum / plan.length;
  const span = avgTravel + Math.max(0, plan.length - 1) * spawnInterval(wave);
  const killFraction = Math.min(1, (span * dps) / Math.max(1, hp));
  const clear = killFraction >= 0.98;
  const mult = goldMultiplier(save);
  const goldPer = (goldSum * killFraction + (clear ? clearGold(wave) : 0)) * mult;
  const timePer = clear ? Math.min(span, hp / dps + 1.2) : span;
  const attempts = elapsed / Math.max(2.5, timePer);
  const gold = Math.round(goldPer * attempts * 0.72);
  let gems = 0;
  if (clear) {
    const bosses = Math.max(0, Math.floor((wave - 1 + attempts) / 10) - Math.floor((wave - 1) / 10));
    gems = Math.round(bosses * bossGems(Math.max(10, Math.ceil(wave / 10) * 10)));
  }
  return { gold: Math.max(0, gold), gems: Math.max(0, gems) };
}
