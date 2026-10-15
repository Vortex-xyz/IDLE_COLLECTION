import { VIEW_H, VIEW_W, slotPos } from "./layout";
import { armedMonster, placed, view } from "./world";

const INK = "#101614";
const PANEL = "#1c2823";
const STONE = "#24302b";
const LINE = "#3c4c44";
const PARCH = "#f3ead7";
const DIM = "#b7ab96";
const GOLD = "#e2b356";
const EMBER = "#d4653a";
const MOSS = "#3e8f6e";

const MONSTER_IDS = ["slime", "bat", "rat", "imp", "wolf", "golem", "wraith", "hydra", "drake", "lich"];
const PROP_IDS = ["squire", "runner", "knight", "boss", "chest"];
const sprites = new Map<string, HTMLImageElement>();
let stairImg: HTMLImageElement | null = null;
let artStarted = false;

function kickArt(): void {
  if (artStarted) return;
  artStarted = true;
  stairImg = new Image();
  stairImg.src = "/art/stair.jpg?v=2";
  for (const id of MONSTER_IDS) {
    const img = new Image();
    img.src = `/art/monsters/${id}.png`;
    sprites.set(id, img);
  }
  for (const id of PROP_IDS) {
    const img = new Image();
    const folder = id === "chest" ? "ui" : "enemies";
    img.src = `/art/${folder}/${id}.png`;
    sprites.set(id, img);
  }
}

function spriteOf(id: string): HTMLImageElement | null {
  const img = sprites.get(id);
  if (!img || !img.complete || img.naturalWidth < 2) return null;
  return img;
}

function hash(n: number): number {
  let x = (n + 1) * 374761393;
  x = (x ^ (x >> 13)) * 1274126177;
  return ((x ^ (x >> 16)) >>> 0) / 4294967295;
}

let bg: HTMLCanvasElement | null = null;

function ensureBg(): HTMLCanvasElement {
  if (bg) return bg;
  const c = document.createElement("canvas");
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = INK;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let row = 0; row < 26; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const x = col * 46 + (row % 2) * 23 - 18;
      const y = row * 26;
      if (x > 96 && x < 232) continue;
      const shade = 18 + hash(row * 9 + col) * 16;
      g.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 6})`;
      g.fillRect(x, y, 44, 24);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.strokeRect(x + 0.5, y + 0.5, 43, 23);
    }
  }
  g.fillStyle = "#18211e";
  g.fillRect(116, 0, 128, 560);
  g.strokeStyle = GOLD;
  g.globalAlpha = 0.45;
  g.lineWidth = 2;
  g.strokeRect(118, 0, 124, 548);
  g.globalAlpha = 0.22;
  for (let y = 18; y < 540; y += 22) {
    g.beginPath();
    g.moveTo(126, y);
    g.lineTo(234, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#121a17";
  g.fillRect(8, 70, 22, 430);
  g.fillRect(330, 70, 22, 430);
  g.fillStyle = GOLD;
  g.globalAlpha = 0.35;
  g.fillRect(8, 70, 22, 3);
  g.fillRect(330, 70, 22, 3);
  g.globalAlpha = 1;
  bg = c;
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawMonster(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  scale: number,
  time: number,
  pulse: number,
): void {
  ctx.save();
  ctx.translate(x, y + (view.reduced ? 0 : Math.sin(time * 3 + x) * 1.5) - pulse * 7);
  ctx.scale(scale, scale);
  const painted = spriteOf(id);
  if (painted) {
    const w = 92;
    ctx.drawImage(painted, -w / 2, -w + 16, w, w);
    ctx.restore();
    return;
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const flap = view.reduced ? 0 : Math.sin(time * 8 + y) * 4;
  switch (id) {
    case "slime": {
      ctx.fillStyle = MOSS;
      ctx.beginPath();
      ctx.ellipse(0, 6, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f6b52";
      ctx.beginPath();
      ctx.ellipse(-4, 8, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PARCH;
      ctx.beginPath();
      ctx.arc(-5, 4, 2, 0, Math.PI * 2);
      ctx.arc(5, 4, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bat": {
      ctx.fillStyle = DIM;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-20, -6 + flap);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.moveTo(4, 0);
      ctx.lineTo(20, -6 + flap);
      ctx.lineTo(8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = STONE;
      ctx.beginPath();
      ctx.ellipse(0, 2, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EMBER;
      ctx.fillRect(-3, 1, 2, 2);
      ctx.fillRect(1, 1, 2, 2);
      break;
    }
    case "rat": {
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.quadraticCurveTo(18, 14, 16, 2);
      ctx.stroke();
      ctx.fillStyle = "#8d6424";
      ctx.beginPath();
      ctx.ellipse(-2, 6, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(8, 2, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PARCH;
      ctx.beginPath();
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.arc(10, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(-8, 10, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "imp": {
      ctx.strokeStyle = EMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 4);
      ctx.lineTo(16, -8);
      ctx.moveTo(10, 4);
      ctx.lineTo(18, 2);
      ctx.stroke();
      ctx.fillStyle = EMBER;
      ctx.beginPath();
      ctx.arc(0, 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(-8, -12);
      ctx.lineTo(-2, -4);
      ctx.moveTo(4, -4);
      ctx.lineTo(8, -12);
      ctx.lineTo(6, -2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(-3, 2, 2, 2);
      ctx.fillRect(2, 2, 2, 2);
      break;
    }
    case "wolf": {
      ctx.fillStyle = "#cbbfa6";
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.lineTo(8, 4);
      ctx.lineTo(16, 8);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-2, -2);
      ctx.moveTo(2, -4);
      ctx.lineTo(6, -14);
      ctx.lineTo(8, -2);
      ctx.fill();
      ctx.fillStyle = EMBER;
      ctx.beginPath();
      ctx.arc(10, 6, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "golem": {
      ctx.fillStyle = "#2a3832";
      roundRect(ctx, -12, -4, 24, 16, 3);
      ctx.fill();
      roundRect(ctx, -8, -16, 16, 12, 2);
      ctx.fill();
      ctx.strokeStyle = MOSS;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, -4);
      ctx.moveTo(-3, -8);
      ctx.lineTo(3, -8);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.fillRect(-14, 8, 6, 6);
      ctx.fillRect(8, 8, 6, 6);
      break;
    }
    case "wraith": {
      ctx.fillStyle = "rgba(183,171,150,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.quadraticCurveTo(14, 0, 8, 16);
      ctx.quadraticCurveTo(0, 8, -8, 16);
      ctx.quadraticCurveTo(-14, 0, 0, -16);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(-4, -4, 3, 3);
      ctx.fillRect(2, -4, 3, 3);
      break;
    }
    case "hydra": {
      ctx.strokeStyle = MOSS;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-2, 12);
      ctx.quadraticCurveTo(-10, 0, -8, -10);
      ctx.moveTo(2, 12);
      ctx.quadraticCurveTo(12, 2, 10, -12);
      ctx.stroke();
      ctx.fillStyle = "#2f6b52";
      ctx.beginPath();
      ctx.arc(-8, -12, 5, 0, Math.PI * 2);
      ctx.arc(10, -14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EMBER;
      ctx.fillRect(-10, -13, 2, 2);
      ctx.fillRect(8, -15, 2, 2);
      break;
    }
    case "drake": {
      ctx.fillStyle = EMBER;
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(-18, -8 + flap);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8d6424";
      ctx.beginPath();
      ctx.ellipse(2, 6, 12, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(20, 0);
      ctx.lineTo(10, 8);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(0, -10);
      ctx.lineTo(4, -2);
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = "#18211e";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 14);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = PARCH;
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillRect(-3, -4, 2, 2);
      ctx.fillRect(1, -4, 2, 2);
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(0, -18);
      ctx.lineTo(6, -12);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(12, -8);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, flash: number): void {
  const painted = spriteOf(kind);
  const h = kind === "boss" ? 78 : kind === "knight" ? 62 : 50;
  ctx.save();
  ctx.translate(x, y);
  if (painted) {
    ctx.drawImage(painted, -h / 2, -h + 6, h, h);
    ctx.restore();
    return;
  }
  ctx.scale(kind === "boss" ? 1.7 : 1.2, kind === "boss" ? 1.7 : 1.2);
  const body = flash > 0 ? PARCH : kind === "boss" ? "#d7c7a4" : "#efe6d2";
  ctx.fillStyle = body;
  if (kind === "runner") {
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = EMBER;
    ctx.fillRect(-2, -4, 4, 8);
  } else if (kind === "knight") {
    roundRect(ctx, -9, -12, 18, 22, 2);
    ctx.fill();
    ctx.fillStyle = LINE;
    ctx.fillRect(-6, -8, 12, 3);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, -28);
    ctx.stroke();
  } else if (kind === "boss") {
    ctx.fillStyle = EMBER;
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(0, -4);
    ctx.lineTo(16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    roundRect(ctx, -12, -16, 24, 26, 3);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(-6, -26);
    ctx.lineTo(-2, -16);
    ctx.lineTo(2, -24);
    ctx.lineTo(6, -16);
    ctx.lineTo(10, -26);
    ctx.lineTo(12, -16);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-6, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2, -12, 5, 22);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(4, -22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChest(ctx: CanvasRenderingContext2D, time: number): void {
  const y = 586 + (view.reduced ? 0 : Math.sin(time * 2) * 1);
  const paintedStair = stairImg && stairImg.complete && stairImg.naturalWidth > 0;
  if (!paintedStair) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(180, y + 22, 54, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d6424";
    roundRect(ctx, 150, y, 60, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#a9782c";
    ctx.beginPath();
    ctx.arc(180, y, 30, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(210, y);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(180, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const pct = view.vaultMax > 0 ? Math.max(0, view.vaultHp / view.vaultMax) : 0;
  const barY = paintedStair ? 548 : y - 18;
  ctx.fillStyle = PANEL;
  ctx.fillRect(118, barY, 124, 7);
  ctx.fillStyle = pct < 0.35 ? EMBER : MOSS;
  ctx.fillRect(118, barY, 124 * pct, 7);
}

export function renderBattle(ctx: CanvasRenderingContext2D): void {
  kickArt();
  const shakeX = view.reduced ? 0 : Math.sin(view.time * 42) * view.shake;
  const shakeY = view.reduced ? 0 : Math.cos(view.time * 37) * view.shake * 0.6;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  if (stairImg && stairImg.complete && stairImg.naturalWidth > 0) ctx.drawImage(stairImg, 0, 0, VIEW_W, VIEW_H);
  else ctx.drawImage(ensureBg(), 0, 0);
  const flicker = 0.35 + (view.reduced ? 0 : Math.sin(view.time * 7) * 0.08);
  const glow = ctx.createRadialGradient(36, 120, 4, 36, 120, 70);
  glow.addColorStop(0, `rgba(212,101,58,${flicker})`);
  glow.addColorStop(1, "rgba(212,101,58,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 60, 110, 140);
  const glow2 = ctx.createRadialGradient(324, 150, 4, 324, 150, 64);
  glow2.addColorStop(0, `rgba(226,179,86,${flicker * 0.8})`);
  glow2.addColorStop(1, "rgba(226,179,86,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(250, 90, 110, 140);

  const armed = armedMonster();
  for (let i = 0; i < 9; i += 1) {
    const p = slotPos(i);
    const id = placed(i);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 16, 22, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, armed && !id ? 30 + Math.sin(view.time * 4) * 2 : 28, 0, Math.PI * 2);
    ctx.strokeStyle = id || armed ? GOLD : LINE;
    ctx.lineWidth = id ? 2.5 : 1.5;
    ctx.setLineDash(id ? [] : [4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (id) drawMonster(ctx, id, p.x, p.y, 1, view.time, view.pulses[i] ?? 0);
  }

  for (const e of view.enemies) {
    if (!e.alive) continue;
    drawEnemy(ctx, e.kind, e.x, e.y, e.flash);
    const h = e.kind === "boss" ? 78 : e.kind === "knight" ? 62 : 50;
    const bw = e.kind === "boss" ? 40 : 24;
    ctx.fillStyle = PANEL;
    ctx.fillRect(e.x - bw / 2, e.y - h - 2, bw, 4);
    ctx.fillStyle = e.burn > 0 ? EMBER : e.slow > 0 ? DIM : MOSS;
    ctx.fillRect(e.x - bw / 2, e.y - h - 2, bw * Math.max(0, e.hp / e.maxHp), 4);
  }

  for (const p of view.projectiles) {
    if (!p.alive) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.crit ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of view.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawChest(ctx, view.time);

  ctx.font = "600 13px Outfit, sans-serif";
  ctx.textAlign = "center";
  for (const f of view.floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.25));
    ctx.fillStyle = f.color;
    ctx.font = f.big ? "700 16px Cinzel, Palatino, serif" : "600 12px Outfit, sans-serif";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (view.bannerLife > 0 && view.banner) {
    ctx.globalAlpha = Math.min(1, view.bannerLife * 2);
    ctx.fillStyle = GOLD;
    ctx.font = "700 28px Cinzel, Palatino, serif";
    ctx.fillText(view.banner, 180, 150);
    ctx.globalAlpha = 1;
  }
  if (view.hurt > 0) {
    ctx.fillStyle = `rgba(212,101,58,${view.hurt * 0.28})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const vignette = ctx.createRadialGradient(180, 320, 160, 180, 320, 420);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}

export function renderPoster(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#18211e";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.4;
  ctx.strokeRect(w / 2 - 28, 8, 56, h - 36);
  ctx.globalAlpha = 1;
  drawMonster(ctx, "slime", w / 2 - 36, h * 0.62, 1.1, time, 0);
  drawMonster(ctx, "drake", w / 2 + 34, h * 0.42, 1.15, time, 0);
  const bob = view.reduced ? 0 : Math.sin(time * 2);
  ctx.fillStyle = "#8d6424";
  roundRect(ctx, w / 2 - 22, h * 0.72 + bob, 44, 18, 3);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(w / 2 - 22, h * 0.72 + bob, 44, 3);
}
