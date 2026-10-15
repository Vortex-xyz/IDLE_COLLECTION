import { computeOffline } from "./balance";
import { MAX_OFFLINE_SEC, UPGRADES, isMonsterId } from "./data";
import type { Owned, PendingReward, SaveData, UpgradeId } from "./types";

const KEY = "hoardbound-save-v1";
const BAK = "hoardbound-save-v1-bak";

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function emptyGrid(): (string | null)[] {
  return [null, null, null, null, null, null, null, null, null];
}

export function freshUpgrades(): Record<UpgradeId, number> {
  return { damage: 0, gold: 0, haste: 0, vault: 0, luck: 0 };
}

export function createDefaultSave(): SaveData {
  const grid = emptyGrid();
  grid[7] = "slime";
  return {
    version: 1,
    gold: 40,
    gems: 0,
    wave: 1,
    highestWave: 1,
    prestige: 0,
    owned: { slime: { level: 1, stars: 0 } },
    grid,
    upgrades: freshUpgrades(),
    summons: 0,
    kills: 0,
    pityGold: 0,
    pityGem: 0,
    settings: { sfx: 0.7, music: 0.28, shake: true },
    iap: { noAds: false, dmg2x: false },
    ads: { summon: 0, gems: 0, skip: 0 },
    lastActive: Date.now(),
    tutorial: false,
    pending: null,
  };
}

function readPending(v: unknown): PendingReward | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const gold = num(p.gold, 0, 0, 1e15);
  const gems = num(p.gems, 0, 0, 1e9);
  const seconds = num(p.seconds, 0, 0, MAX_OFFLINE_SEC);
  if (gold <= 0 && gems <= 0) return null;
  return { gold, gems, seconds };
}

export function sanitize(raw: unknown): SaveData {
  const base = createDefaultSave();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  base.gold = num(o.gold, 40, 0, 1e15);
  base.gems = num(o.gems, 0, 0, 1e9);
  base.wave = Math.round(num(o.wave, 1, 1, 100000));
  base.highestWave = Math.round(num(o.highestWave, base.wave, 1, 100000));
  base.prestige = Math.round(num(o.prestige, 0, 0, 100000));
  base.summons = Math.round(num(o.summons, 0, 0, 1e7));
  base.kills = Math.round(num(o.kills, 0, 0, 1e12));
  base.pityGold = Math.round(num(o.pityGold, 0, 0, 1000));
  base.pityGem = Math.round(num(o.pityGem, 0, 0, 1000));
  base.lastActive = num(o.lastActive, Date.now(), 0, Date.now() + 1000);
  base.tutorial = bool(o.tutorial, false);

  const ownedIn = o.owned;
  const owned: Record<string, Owned> = {};
  if (ownedIn && typeof ownedIn === "object") {
    for (const [id, val] of Object.entries(ownedIn as Record<string, unknown>)) {
      if (!isMonsterId(id) || !val || typeof val !== "object") continue;
      const row = val as Record<string, unknown>;
      owned[id] = {
        level: Math.round(num(row.level, 1, 1, 500)),
        stars: Math.round(num(row.stars, 0, 0, 5)),
      };
    }
  }
  if (Object.keys(owned).length === 0) owned.slime = { level: 1, stars: 0 };
  base.owned = owned;

  const grid = emptyGrid();
  if (Array.isArray(o.grid)) {
    for (let i = 0; i < 9; i += 1) {
      const id = o.grid[i];
      if (typeof id === "string" && owned[id]) grid[i] = id;
    }
  }
  const seen = new Set<string>();
  for (let i = 0; i < 9; i += 1) {
    const id = grid[i];
    if (!id) continue;
    if (seen.has(id)) grid[i] = null;
    else seen.add(id);
  }
  if (!grid.some(Boolean)) {
    const first = Object.keys(owned)[0];
    if (first) grid[7] = first;
  }
  base.grid = grid;

  const upIn = (o.upgrades ?? {}) as Record<string, unknown>;
  for (const u of UPGRADES) {
    base.upgrades[u.id] = Math.round(num(upIn[u.id], 0, 0, u.max));
  }

  const settings = (o.settings ?? {}) as Record<string, unknown>;
  base.settings = {
    sfx: num(settings.sfx, 0.7, 0, 1),
    music: num(settings.music, 0.28, 0, 1),
    shake: bool(settings.shake, true),
  };
  const iap = (o.iap ?? {}) as Record<string, unknown>;
  base.iap = { noAds: bool(iap.noAds, false), dmg2x: bool(iap.dmg2x, false) };
  const ads = (o.ads ?? {}) as Record<string, unknown>;
  const now = Date.now();
  base.ads = {
    summon: num(ads.summon, 0, 0, now),
    gems: num(ads.gems, 0, 0, now),
    skip: num(ads.skip, 0, 0, now),
  };
  base.pending = readPending(o.pending);
  base.version = 1;
  return base;
}

export function loadSave(): SaveData {
  const store = storage();
  if (!store) return createDefaultSave();
  const parse = (text: string | null): SaveData | null => {
    if (!text) return null;
    try {
      return sanitize(JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  };
  const save = parse(store.getItem(KEY)) ?? parse(store.getItem(BAK)) ?? createDefaultSave();
  const hadFile = Boolean(store.getItem(KEY) || store.getItem(BAK));
  if (hadFile && !save.pending) {
    const elapsed = (Date.now() - save.lastActive) / 1000;
    if (elapsed > 30) {
      const reward = computeOffline(save, elapsed);
      if (reward.gold > 0 || reward.gems > 0) {
        save.pending = {
          seconds: Math.min(elapsed, MAX_OFFLINE_SEC),
          gold: reward.gold,
          gems: reward.gems,
        };
      }
    }
  }
  save.lastActive = Date.now();
  return save;
}

export function persist(save: SaveData): void {
  const store = storage();
  if (!store) return;
  try {
    const prev = store.getItem(KEY);
    if (prev) store.setItem(BAK, prev);
    save.lastActive = Date.now();
    store.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota — keep playing in memory */
  }
}
