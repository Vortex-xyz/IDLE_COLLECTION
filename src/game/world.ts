import { play, resumeAudio, setMix } from "./audio";
import {
  attackInterval,
  boardDps,
  bossGems,
  clearGold,
  computeOffline,
  damageMultiplier,
  duplicateGems,
  gemSummonCost,
  goldMultiplier,
  goldSummonCost,
  hasteMultiplier,
  hitDamage,
  killGold,
  leakDamage,
  levelCost,
  makePlan,
  maxHp,
  moveSpeed,
  rates,
  rollMonster,
  spawnInterval,
  upgradeCost,
  vaultMaxOf,
} from "./balance";
import { AD_COOLDOWN, MAX_OFFLINE_SEC, MAX_STARS, PITY_GEM, PITY_GOLD, PRESTIGE_WAVE, getMonster } from "./data";
import { formatNum } from "./format";
import { LEAK_Y, SPAWN_Y, slotPos } from "./layout";
import { createDefaultSave, emptyGrid, freshUpgrades, loadSave, persist, sanitize } from "./save";
import type { AdKind, Banner, EnemyKind, Modal, Owned, Rarity, Reveal, SaveData, Tab, UpgradeId } from "./types";

export type { Modal, Reveal, Tab };

type Enemy = {
  alive: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  lane: number;
  phase: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  leak: number;
  slow: number;
  slowFactor: number;
  burn: number;
  burnDps: number;
  burnTick: number;
  flash: number;
};

type Proj = {
  alive: boolean;
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Enemy | null;
  dmg: number;
  speed: number;
  color: string;
  splashRadius: number;
  splashRatio: number;
  burn: number;
  burnTime: number;
  slow: number;
  slowTime: number;
  goldOnHit: number;
  execute: number;
  crit: boolean;
  life: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number };
type FloatText = { x: number; y: number; text: string; life: number; max: number; color: string; big: boolean };

export const view = {
  time: 0,
  shake: 0,
  hurt: 0,
  vaultHp: 84,
  vaultMax: 84,
  pulses: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  enemies: [] as Enemy[],
  projectiles: [] as Proj[],
  particles: [] as Particle[],
  floats: [] as FloatText[],
  reduced: false,
  banner: "",
  bannerLife: 0,
};

const enemyPool: Enemy[] = [];
const projPool: Proj[] = [];

export type Snapshot = {
  gold: number;
  gems: number;
  wave: number;
  best: number;
  prestige: number;
  dps: number;
  dmgMult: number;
  goldMult: number;
  vaultHp: number;
  vaultMax: number;
  foes: number;
  status: string;
  tab: Tab;
  speed: 1 | 2;
  grid: (string | null)[];
  owned: Record<string, Owned>;
  upgrades: SaveData["upgrades"];
  summons: number;
  kills: number;
  pityGold: number;
  pityGem: number;
  summonCost: number;
  gemCost: number;
  modal: Modal;
  reveal: Reveal | null;
  armedId: string | null;
  tip: boolean;
  settings: SaveData["settings"];
  iap: SaveData["iap"];
  cd: { summon: number; gems: number; skip: number };
  adLeft: number;
  adKind: AdKind | null;
  pending: SaveData["pending"];
  toasts: { id: number; text: string }[];
  canRebirth: boolean;
  history: { id: string; rarity: Rarity }[];
  ratesGold: ReturnType<typeof rates>;
  ratesGem: ReturnType<typeof rates>;
};

let save: SaveData = createDefaultSave();
let booted = false;
let tab: Tab = "battle";
let speed: 1 | 2 = 1;
let modal: Modal = { type: "none" };
let reveal: Reveal | null = null;
let armed: string | null = null;
let hold = false;
let hidden = false;
let phase: "fight" | "recover" = "recover";
let recoverLeft = 0.8;
let recoverText = "The stair fills";
let plan: EnemyKind[] = [];
let planI = 0;
let spawnCd = 0.4;
let spawnSerial = 0;
let waveSpawned = 0;
let waveLeaks = 0;
let vaultBroke = false;
let slotCd = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let acc = 0;
let saveAcc = 0;
let pubAcc = 0;
let simTime = 0;
let adLeft = 0;
let adKind: AdKind | null = null;
let history: { id: string; rarity: Rarity }[] = [];
let toasts: { id: number; text: string; life: number }[] = [];
let toastSeq = 1;
let snap: Snapshot = buildSnapshot();
const listeners = new Set<() => void>();
const drawers = new Set<() => void>();

const TINT: Record<string, string> = {
  slime: "#3e8f6e",
  bat: "#b7ab96",
  rat: "#e2b356",
  imp: "#d4653a",
  wolf: "#f3ead7",
  golem: "#8d6424",
  wraith: "#b7ab96",
  hydra: "#3e8f6e",
  drake: "#d4653a",
  lich: "#e2b356",
};

function toast(text: string): void {
  toasts = [...toasts.slice(-2), { id: toastSeq, text, life: 2.8 }];
  toastSeq += 1;
}

function grantGold(raw: number, minOne = false): number {
  const amt = Math.round(raw * goldMultiplier(save));
  const g = minOne ? Math.max(1, amt) : Math.max(0, amt);
  if (g <= 0) return 0;
  save.gold = Math.min(1e15, save.gold + g);
  return g;
}

function syncVaultMax(healFull: boolean): void {
  const next = vaultMaxOf(save.upgrades.vault, save.prestige);
  if (healFull) view.vaultHp = next;
  else if (next > view.vaultMax) view.vaultHp += next - view.vaultMax;
  view.vaultMax = next;
  view.vaultHp = Math.min(view.vaultMax, Math.max(0, view.vaultHp));
}

function clearField(): void {
  enemyPool.push(...view.enemies);
  projPool.push(...view.projectiles);
  view.enemies.length = 0;
  view.projectiles.length = 0;
  view.particles.length = 0;
  view.floats.length = 0;
}

function resetCombat(fullHeal: boolean): void {
  clearField();
  phase = "recover";
  recoverLeft = 0.85;
  recoverText = "The stair fills";
  plan = [];
  planI = 0;
  spawnCd = 0.3;
  waveSpawned = 0;
  waveLeaks = 0;
  vaultBroke = false;
  syncVaultMax(fullHeal);
}

function cdLeft(kind: "summon" | "gems" | "skip"): number {
  const elapsed = (Date.now() - save.ads[kind]) / 1000;
  return Math.max(0, AD_COOLDOWN[kind] - elapsed);
}

function foeCount(): number {
  return view.enemies.length + Math.max(0, plan.length - planI);
}

function buildSnapshot(): Snapshot {
  return {
    gold: save.gold,
    gems: save.gems,
    wave: save.wave,
    best: save.highestWave,
    prestige: save.prestige,
    dps: boardDps(save),
    dmgMult: damageMultiplier(save),
    goldMult: goldMultiplier(save),
    vaultHp: view.vaultHp,
    vaultMax: view.vaultMax,
    foes: foeCount(),
    status: phase === "recover" ? recoverText : `${foeCount()} on the stair`,
    tab,
    speed,
    grid: save.grid.slice(),
    owned: { ...save.owned },
    upgrades: { ...save.upgrades },
    summons: save.summons,
    kills: save.kills,
    pityGold: save.pityGold,
    pityGem: save.pityGem,
    summonCost: goldSummonCost(save.summons),
    gemCost: gemSummonCost(),
    modal,
    reveal,
    armedId: armed,
    tip: !save.tutorial,
    settings: { ...save.settings },
    iap: { ...save.iap },
    cd: { summon: cdLeft("summon"), gems: cdLeft("gems"), skip: cdLeft("skip") },
    adLeft,
    adKind,
    pending: save.pending ? { ...save.pending } : null,
    toasts: toasts.map((t) => ({ id: t.id, text: t.text })),
    canRebirth: save.highestWave >= PRESTIGE_WAVE,
    history: history.slice(),
    ratesGold: rates("gold", save.upgrades.luck),
    ratesGem: rates("gem", save.upgrades.luck),
  };
}

function publish(): void {
  snap = buildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot(): Snapshot {
  return snap;
}

export function onFrame(fn: () => void): () => void {
  drawers.add(fn);
  return () => drawers.delete(fn);
}

export function placed(index: number): string | null {
  return save.grid[index] ?? null;
}

export function armedMonster(): string | null {
  return armed;
}

export function boot(): void {
  if (booted) return;
  booted = true;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    view.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  save = loadSave();
  hold = Boolean(save.pending);
  modal = save.pending ? { type: "offline" } : { type: "none" };
  resetCombat(true);
  setMix(save.settings.sfx, save.settings.music);
  persist(save);
  publish();
}

function makeEnemy(): Enemy {
  return {
    alive: false,
    kind: "squire",
    x: 180,
    y: 0,
    lane: 0,
    phase: 0,
    hp: 1,
    maxHp: 1,
    speed: 1,
    gold: 1,
    leak: 1,
    slow: 0,
    slowFactor: 1,
    burn: 0,
    burnDps: 0,
    burnTick: 0,
    flash: 0,
  };
}

function makeProj(): Proj {
  return {
    alive: false,
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    target: null,
    dmg: 1,
    speed: 520,
    color: "#e2b356",
    splashRadius: 0,
    splashRatio: 0,
    burn: 0,
    burnTime: 0,
    slow: 1,
    slowTime: 0,
    goldOnHit: 0,
    execute: 0,
    crit: false,
    life: 1.2,
  };
}

function spawnFloat(x: number, y: number, text: string, color: string, big: boolean): void {
  if (view.floats.length > 32) view.floats.shift();
  view.floats.push({ x, y, text, life: big ? 0.9 : 0.7, max: big ? 0.9 : 0.7, color, big });
}

function burst(x: number, y: number, color: string, n: number): void {
  const count = view.reduced ? Math.min(3, n) : n;
  for (let i = 0; i < count; i += 1) {
    if (view.particles.length > 90) return;
    const a = Math.random() * Math.PI * 2;
    const sp = 24 + Math.random() * 80;
    view.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 24,
      life: 0.35 + Math.random() * 0.3,
      max: 0.65,
      color,
      r: 1.4 + Math.random() * 1.6,
    });
  }
}

function slay(e: Enemy): void {
  if (!e.alive) return;
  e.alive = false;
  const g = grantGold(e.gold);
  save.kills += 1;
  if (g > 0) spawnFloat(e.x, e.y - 8, `+${g}`, "#e2b356", false);
  burst(e.x, e.y, e.kind === "boss" ? "#d4653a" : "#e2b356", e.kind === "boss" ? 14 : 6);
  if (e.kind === "boss" && save.settings.shake && !view.reduced) view.shake = Math.min(14, view.shake + 7);
  play("coin");
}

function failWave(): void {
  clearField();
  phase = "recover";
  recoverLeft = 2.3;
  recoverText = "Vault breached";
  view.banner = "BREACHED";
  view.bannerLife = 1.3;
  syncVaultMax(true);
  toast(`Wave ${save.wave} breached. The same stair rises again.`);
  play("breach");
}

function leak(e: Enemy): void {
  if (!e.alive) return;
  e.alive = false;
  view.vaultHp -= e.leak;
  view.hurt = 0.7;
  waveLeaks += 1;
  if (view.vaultHp <= 0) vaultBroke = true;
  if (save.settings.shake && !view.reduced) view.shake = Math.min(16, view.shake + (e.kind === "boss" ? 10 : 5));
  spawnFloat(e.x, e.y, "BREACH", "#d4653a", true);
  play("breach");
}

function hurtEnemy(e: Enemy, amount: number, floatIt: boolean, crit: boolean, source: Proj | null, status: boolean, splash: boolean): void {
  if (!e.alive || amount <= 0) return;
  e.hp -= amount;
  e.flash = 0.12;
  if (floatIt && amount >= 0.5) {
    spawnFloat(e.x + (crit ? 0 : Math.random() * 8 - 4), e.y - 16, Math.max(1, Math.round(amount)).toString(), crit ? "#f3ead7" : "#d4653a", crit);
  }
  if (status && source) {
    if (source.burn > 0) {
      e.burn = Math.max(e.burn, source.burnTime);
      e.burnDps = Math.max(e.burnDps, amount * source.burn);
    }
    if (source.slowTime > 0) {
      e.slow = Math.max(e.slow, source.slowTime);
      e.slowFactor = source.slow;
    }
    if (source.goldOnHit > 0) {
      const g = grantGold(source.goldOnHit, true);
      spawnFloat(e.x, e.y - 26, `+${g}`, "#e2b356", false);
    }
    if (source.execute > 0 && e.hp > 0 && e.hp <= e.maxHp * source.execute) {
      e.hp = 0;
      spawnFloat(e.x, e.y - 30, "FALL", "#f3ead7", true);
    }
  }
  if (e.hp <= 0) {
    slay(e);
    return;
  }
  if (splash && source && source.splashRadius > 0 && source.splashRatio > 0) {
    const r2 = source.splashRadius * source.splashRadius;
    for (const other of view.enemies) {
      if (!other.alive || other === e) continue;
      const dx = other.x - e.x;
      const dy = other.y - e.y;
      if (dx * dx + dy * dy <= r2) hurtEnemy(other, amount * source.splashRatio, true, false, source, false, false);
    }
  }
}

function impact(p: Proj, e: Enemy): void {
  burst(e.x, e.y, p.color, 4);
  play("hit");
  hurtEnemy(e, p.dmg, true, p.crit, p, true, true);
}

function pickTarget(x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestY = -Infinity;
  const r2 = range * range;
  for (const e of view.enemies) {
    if (!e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > r2) continue;
    if (e.y > bestY) {
      bestY = e.y;
      best = e;
    }
  }
  return best;
}

function fire(slot: number, id: string): void {
  const def = getMonster(id);
  const owned = save.owned[id];
  if (!def || !owned) return;
  const pos = slotPos(slot);
  const target = pickTarget(pos.x, pos.y, def.range);
  if (!target) {
    slotCd[slot] = 0.08;
    return;
  }
  const dmgMult = damageMultiplier(save);
  const haste = hasteMultiplier(save);
  let dmg = hitDamage(def, owned.level, owned.stars, dmgMult);
  const crit = Math.random() < def.critChance;
  if (crit) dmg *= def.critMult;
  const shots = Math.max(1, def.shots);
  for (let s = 0; s < shots; s += 1) {
    const p = projPool.pop() ?? makeProj();
    p.alive = true;
    p.x = pos.x + (s - (shots - 1) / 2) * 12;
    p.y = pos.y - 10;
    p.target = target;
    p.tx = target.x;
    p.ty = target.y - 6;
    p.dmg = dmg;
    p.speed = 540;
    p.color = TINT[id] ?? "#e2b356";
    p.splashRadius = def.splashRadius;
    p.splashRatio = def.splashRatio;
    p.burn = def.burn;
    p.burnTime = def.burnTime;
    p.slow = def.slow;
    p.slowTime = def.slowTime;
    p.goldOnHit = def.goldOnHit;
    p.execute = def.execute;
    p.crit = crit;
    p.life = 1.4;
    view.projectiles.push(p);
  }
  slotCd[slot] = attackInterval(def, haste);
  view.pulses[slot] = 1;
}

function spawnEnemy(kind: EnemyKind): void {
  const e = enemyPool.pop() ?? makeEnemy();
  const lane = kind === "boss" ? 0 : (spawnSerial % 3) - 1;
  spawnSerial += 1;
  e.alive = true;
  e.kind = kind;
  e.lane = lane;
  e.phase = Math.random() * Math.PI * 2;
  e.x = 180 + lane * 26;
  e.y = SPAWN_Y;
  e.maxHp = maxHp(kind, save.wave);
  e.hp = e.maxHp;
  e.speed = moveSpeed(kind, save.wave);
  e.gold = killGold(kind, save.wave);
  e.leak = leakDamage(kind, save.wave);
  e.slow = 0;
  e.slowFactor = 1;
  e.burn = 0;
  e.burnDps = 0;
  e.burnTick = 0;
  e.flash = 0;
  view.enemies.push(e);
  waveSpawned += 1;
}

function compact(): void {
  let w = 0;
  for (let i = 0; i < view.enemies.length; i += 1) {
    const e = view.enemies[i]!;
    if (e.alive) view.enemies[w++] = e;
    else enemyPool.push(e);
  }
  view.enemies.length = w;
  w = 0;
  for (let i = 0; i < view.projectiles.length; i += 1) {
    const p = view.projectiles[i]!;
    if (p.alive) view.projectiles[w++] = p;
    else projPool.push(p);
  }
  view.projectiles.length = w;
}

function clearWave(): void {
  const wave = save.wave;
  const g = grantGold(clearGold(wave));
  const gems = bossGems(wave);
  if (gems > 0) save.gems += gems;
  save.highestWave = Math.max(save.highestWave, wave);
  save.wave = wave + 1;
  save.highestWave = Math.max(save.highestWave, save.wave);
  view.vaultHp = Math.min(view.vaultMax, view.vaultHp + view.vaultMax * 0.22);
  phase = "recover";
  recoverLeft = 1.45;
  recoverText = "Wave held";
  view.banner = "HELD";
  view.bannerLife = 1.1;
  toast(gems > 0 ? `Wave ${wave} held · +${formatNum(g)} gold · +${gems} gems` : `Wave ${wave} held · +${formatNum(g)} gold`);
  play("clear");
}

function softFail(): void {
  clearField();
  phase = "recover";
  recoverLeft = 1.8;
  recoverText = "A hero slipped through";
  view.banner = "SLIPPED";
  view.bannerLife = 1.2;
  toast(`Wave ${save.wave} failed. Nobody may reach the chest.`);
  play("breach");
}

function beginWave(): void {
  phase = "fight";
  plan = makePlan(save.wave);
  planI = 0;
  spawnCd = 0.28;
  waveSpawned = 0;
  waveLeaks = 0;
  vaultBroke = false;
  recoverText = "On the stair";
  syncVaultMax(false);
}

function step(dt: number): void {
  simTime += dt;
  if (phase === "recover") {
    recoverLeft -= dt;
    if (recoverLeft <= 0) beginWave();
    return;
  }
  if (planI < plan.length) {
    spawnCd -= dt;
    if (spawnCd <= 0) {
      spawnEnemy(plan[planI]!);
      planI += 1;
      spawnCd = spawnInterval(save.wave);
    }
  }
  for (let i = 0; i < 9; i += 1) {
    const id = save.grid[i];
    if (!id) continue;
    slotCd[i] = (slotCd[i] ?? 0) - dt;
    if ((slotCd[i] ?? 0) <= 0) fire(i, id);
  }
  for (const p of view.projectiles) {
    if (!p.alive) continue;
    if (p.target && p.target.alive) {
      p.tx = p.target.x;
      p.ty = p.target.y - 6;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    const stepD = p.speed * dt;
    if (dist <= stepD + 10) {
      if (p.target && p.target.alive) impact(p, p.target);
      p.alive = false;
    } else {
      p.x += (dx / dist) * stepD;
      p.y += (dy / dist) * stepD;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
  }
  for (const e of view.enemies) {
    if (!e.alive) continue;
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick += dt;
      if (e.burnTick >= 0.4) {
        const chunk = e.burnDps * e.burnTick;
        e.burnTick = 0;
        hurtEnemy(e, chunk, true, false, null, false, false);
        if (!e.alive) continue;
      }
    }
    if (e.slow > 0) e.slow -= dt;
    const slow = e.slow > 0 ? e.slowFactor : 1;
    e.y += e.speed * slow * dt;
    e.x = 180 + e.lane * 26 + Math.sin(simTime * 1.6 + e.phase) * 5;
    if (e.y >= LEAK_Y) leak(e);
  }
  compact();
  if (vaultBroke) {
    failWave();
    return;
  }
  if (phase === "fight" && planI >= plan.length && view.enemies.length === 0 && waveSpawned > 0) {
    if (waveLeaks === 0) clearWave();
    else softFail();
  }
}

function decayVfx(dt: number): void {
  view.time += dt;
  view.shake = Math.max(0, view.shake - dt * 28);
  view.hurt = Math.max(0, view.hurt - dt * 1.35);
  view.bannerLife = Math.max(0, view.bannerLife - dt);
  for (let i = 0; i < 9; i += 1) view.pulses[i] = Math.max(0, (view.pulses[i] ?? 0) - dt * 3.4);
  for (const e of view.enemies) e.flash = Math.max(0, e.flash - dt);
  for (const f of view.floats) {
    f.life -= dt;
    f.y -= dt * 26;
  }
  let w = 0;
  for (let i = 0; i < view.floats.length; i += 1) {
    if (view.floats[i]!.life > 0) view.floats[w++] = view.floats[i]!;
  }
  view.floats.length = w;
  for (const p of view.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 50 * dt;
  }
  w = 0;
  for (let i = 0; i < view.particles.length; i += 1) {
    if (view.particles[i]!.life > 0) view.particles[w++] = view.particles[i]!;
  }
  view.particles.length = w;
  for (const t of toasts) t.life -= dt;
  if (toasts.some((t) => t.life <= 0)) toasts = toasts.filter((t) => t.life > 0);
}

function grantAd(kind: AdKind): void {
  adKind = null;
  adLeft = 0;
  if (kind === "double") {
    claimOffline(2);
    return;
  }
  if (kind === "summon") {
    save.ads.summon = Date.now();
    doPull("gold", true);
    return;
  }
  if (kind === "gems") {
    save.ads.gems = Date.now();
    save.gems += 25;
    toast("+25 gems");
    modal = { type: "none" };
    play("coin");
  } else if (kind === "skip") {
    save.ads.skip = Date.now();
    const reward = computeOffline(save, 30 * 60);
    save.gold = Math.min(1e15, save.gold + reward.gold);
    save.gems += reward.gems;
    toast(reward.gems > 0 ? `Skip · +${formatNum(reward.gold)} gold · +${reward.gems} gems` : `Skip · +${formatNum(reward.gold)} gold`);
    modal = { type: "none" };
    play("coin");
  }
  persist(save);
  publish();
}

function frame(realDt: number): void {
  const dt = Math.min(0.05, Math.max(0, realDt));
  if (modal.type === "ad") {
    adLeft -= dt;
    if (adLeft <= 0 && adKind) grantAd(adKind);
  }
  if (!hidden && !hold) {
    acc += dt * speed;
    let guard = 0;
    while (acc >= 1 / 60 && guard < 8) {
      step(1 / 60);
      acc -= 1 / 60;
      guard += 1;
    }
    if (guard >= 8) acc = 0;
  }
  decayVfx(dt);
  saveAcc += dt;
  if (saveAcc >= 5) {
    saveAcc = 0;
    persist(save);
  }
  pubAcc += dt;
  const hz = modal.type === "ad" ? 0.05 : 0.12;
  if (pubAcc >= hz) {
    pubAcc = 0;
    publish();
  }
  for (const draw of drawers) draw();
}

let raf = 0;
let lastTs = 0;
let visBound = false;

function onVis(): void {
  if (typeof document === "undefined") return;
  if (document.hidden) {
    hidden = true;
    persist(save);
  } else {
    hidden = false;
    lastTs = performance.now();
    resumeAudio();
    const elapsed = (Date.now() - save.lastActive) / 1000;
    if (elapsed > 25 && !save.pending && modal.type !== "ad") {
      const reward = computeOffline(save, elapsed);
      if (reward.gold > 0 || reward.gems > 0) {
        save.pending = { seconds: Math.min(elapsed, MAX_OFFLINE_SEC), gold: reward.gold, gems: reward.gems };
        hold = true;
        modal = { type: "offline" };
        persist(save);
        publish();
      }
    }
  }
}

export function startLoop(): () => void {
  if (typeof window === "undefined") return () => {};
  if (!visBound) {
    visBound = true;
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => persist(save));
  }
  if (raf) return () => {};
  lastTs = performance.now();
  const loop = (now: number) => {
    const dt = (now - lastTs) / 1000;
    lastTs = now;
    frame(dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
}

function doPull(banner: Banner, free: boolean): void {
  const cost = banner === "gold" ? goldSummonCost(save.summons) : gemSummonCost();
  if (!free) {
    if (banner === "gold" && save.gold < cost) {
      toast("Not enough gold");
      publish();
      return;
    }
    if (banner === "gem" && save.gems < cost) {
      toast("Not enough gems");
      publish();
      return;
    }
    if (banner === "gold") save.gold -= cost;
    else save.gems -= cost;
  }
  const luck = save.upgrades.luck;
  const cap = banner === "gold" ? PITY_GOLD : PITY_GEM;
  const pity = banner === "gold" ? save.pityGold : save.pityGem;
  let picked = rollMonster(banner, luck);
  if (pity + 1 >= cap) {
    const legends = ["drake", "lich"];
    const id = legends[Math.floor(Math.random() * legends.length)] ?? "drake";
    const forced = getMonster(id);
    if (forced) picked = forced;
  }
  if (picked.rarity === "legendary") {
    if (banner === "gold") save.pityGold = 0;
    else save.pityGem = 0;
  } else if (banner === "gold") save.pityGold += 1;
  else save.pityGem += 1;
  save.summons += 1;
  const owned = save.owned[picked.id];
  let next: Reveal;
  if (!owned) {
    save.owned[picked.id] = { level: 1, stars: 0 };
    next = { id: picked.id, isNew: true, stars: 0, gems: 0 };
  } else if (owned.stars < MAX_STARS) {
    owned.stars += 1;
    next = { id: picked.id, isNew: false, stars: owned.stars, gems: 0 };
  } else {
    const gems = duplicateGems(picked.rarity);
    save.gems += gems;
    next = { id: picked.id, isNew: false, stars: MAX_STARS, gems };
  }
  reveal = next;
  history = [{ id: picked.id, rarity: picked.rarity }, ...history].slice(0, 8);
  modal = { type: "reveal" };
  play(picked.rarity === "legendary" ? "legendary" : "summon");
  persist(save);
  publish();
}

export function setTab(next: Tab): void {
  if (tab === next) return;
  tab = next;
  play("ui");
  publish();
}

export function toggleSpeed(): void {
  speed = speed === 1 ? 2 : 1;
  play("ui");
  publish();
}

export function openSettings(): void {
  if (modal.type === "offline" || modal.type === "ad") return;
  modal = { type: "settings" };
  play("ui");
  publish();
}

export function closeModal(): void {
  if (modal.type === "offline" || modal.type === "ad") return;
  modal = { type: "none" };
  publish();
}

export function dismissTip(): void {
  save.tutorial = true;
  persist(save);
  publish();
}

export function summon(banner: Banner): void {
  doPull(banner, false);
}

export function levelUp(id: string): void {
  const owned = save.owned[id];
  const def = getMonster(id);
  if (!owned || !def) return;
  const cost = levelCost(id, owned.level);
  if (save.gold < cost) {
    toast("Not enough gold");
    publish();
    return;
  }
  save.gold -= cost;
  owned.level += 1;
  toast(`${def.name} is level ${owned.level}`);
  play("coin");
  persist(save);
  publish();
}

export function buyUpgrade(id: UpgradeId): void {
  const spec = save.upgrades[id];
  const max = id === "luck" ? 10 : id === "haste" || id === "vault" ? 20 : 30;
  if (spec >= max) return;
  const cost = upgradeCost(id, spec);
  if (save.gold < cost) {
    toast("Not enough gold");
    publish();
    return;
  }
  save.gold -= cost;
  save.upgrades[id] = spec + 1;
  syncVaultMax(false);
  play("coin");
  persist(save);
  publish();
}

export function arm(id: string): void {
  if (!save.owned[id]) return;
  armed = id;
  tab = "battle";
  modal = { type: "none" };
  play("ui");
  publish();
}

export function cancelArm(): void {
  armed = null;
  publish();
}

export function openSlot(index: number): void {
  if (armed) {
    place(index, armed);
    return;
  }
  modal = { type: "picker", slot: index };
  publish();
}

export function place(index: number, id: string | null): void {
  if (index < 0 || index > 8) return;
  if (id) {
    if (!save.owned[id]) return;
    const existing = save.grid.indexOf(id);
    if (existing >= 0) save.grid[existing] = null;
    save.grid[index] = id;
    slotCd[index] = 0.2;
  } else {
    save.grid[index] = null;
  }
  armed = null;
  modal = { type: "none" };
  play("ui");
  persist(save);
  publish();
}

export function claimOffline(mult: number): void {
  if (!save.pending) {
    hold = false;
    modal = { type: "none" };
    publish();
    return;
  }
  const gold = Math.round(save.pending.gold * mult);
  const gems = Math.round(save.pending.gems * mult);
  save.gold = Math.min(1e15, save.gold + gold);
  save.gems += gems;
  save.pending = null;
  hold = false;
  modal = { type: "none" };
  toast(mult > 1 ? `Doubled hoard · +${formatNum(gold)} gold` : `Collected · +${formatNum(gold)} gold`);
  play("coin");
  persist(save);
  publish();
}

export function askRebirth(): void {
  if (save.highestWave < PRESTIGE_WAVE) return;
  modal = { type: "rebirth" };
  publish();
}

export function rebirth(): void {
  if (save.highestWave < PRESTIGE_WAVE) return;
  save.prestige += 1;
  save.gold = 0;
  save.wave = 1;
  save.summons = 0;
  save.pityGold = 0;
  save.pityGem = 0;
  for (const id of Object.keys(save.owned)) {
    const row = save.owned[id];
    if (row) row.level = 1;
  }
  save.upgrades = freshUpgrades();
  save.grid = emptyGrid();
  const keep = save.owned.slime ? "slime" : Object.keys(save.owned)[0];
  if (keep) save.grid[7] = keep;
  armed = null;
  tab = "battle";
  modal = { type: "none" };
  resetCombat(true);
  toast(`Rebirth ${save.prestige}. The stair starts over.`);
  play("clear");
  persist(save);
  publish();
}

export function askReset(): void {
  modal = { type: "reset" };
  publish();
}

export function hardReset(): void {
  save = createDefaultSave();
  history = [];
  armed = null;
  tab = "battle";
  speed = 1;
  hold = false;
  modal = { type: "none" };
  reveal = null;
  resetCombat(true);
  setMix(save.settings.sfx, save.settings.music);
  toast("The vault was emptied.");
  persist(save);
  publish();
}

export function setSfx(v: number): void {
  save.settings.sfx = Math.min(1, Math.max(0, v));
  setMix(save.settings.sfx, save.settings.music);
  publish();
}

export function setMusic(v: number): void {
  save.settings.music = Math.min(1, Math.max(0, v));
  setMix(save.settings.sfx, save.settings.music);
  publish();
}

export function toggleShake(): void {
  save.settings.shake = !save.settings.shake;
  play("ui");
  persist(save);
  publish();
}

export function startAd(kind: AdKind): void {
  if (kind !== "double") {
    const key = kind === "summon" ? "summon" : kind === "gems" ? "gems" : "skip";
    if (cdLeft(key) > 0) {
      toast("Not ready yet");
      publish();
      return;
    }
  }
  if (save.iap.noAds) {
    grantAd(kind);
    return;
  }
  adKind = kind;
  adLeft = 1.3;
  modal = { type: "ad" };
  publish();
}

export function buyIap(sku: "noads" | "x2" | "g500" | "g1200" | "g3000"): void {
  if (sku === "noads") save.iap.noAds = true;
  if (sku === "x2") save.iap.dmg2x = true;
  if (sku === "g500") save.gems += 500;
  if (sku === "g1200") save.gems += 1200;
  if (sku === "g3000") save.gems += 3000;
  syncVaultMax(false);
  toast("Demo coffer opened. Nothing was charged.");
  play("coin");
  persist(save);
  publish();
}

export function serialize(): string {
  return JSON.stringify(save);
}

export function replaceSave(text: string): boolean {
  try {
    save = sanitize(JSON.parse(text) as unknown);
    save.pending = null;
    hold = false;
    history = [];
    armed = null;
    modal = { type: "none" };
    resetCombat(true);
    setMix(save.settings.sfx, save.settings.music);
    toast("Save restored");
    persist(save);
    publish();
    return true;
  } catch {
    toast("That save could not be read");
    publish();
    return false;
  }
}

export function debugFight(seconds: number): { wave: number; gold: number; kills: number; vault: number; foes: number } {
  boot();
  save.pending = null;
  hold = false;
  modal = { type: "none" };
  const n = Math.floor(seconds / (1 / 60));
  for (let i = 0; i < n; i += 1) step(1 / 60);
  return { wave: save.wave, gold: Math.round(save.gold), kills: save.kills, vault: Math.round(view.vaultHp), foes: view.enemies.length };
}
