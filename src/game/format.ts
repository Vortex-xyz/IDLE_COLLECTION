export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  let v = Math.abs(n);
  if (v < 1000) return sign + Math.floor(v).toString();
  const units = ["K", "M", "B", "T"] as const;
  let u = -1;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u += 1;
  }
  const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return sign + text + (units[u] ?? "");
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r.toString().padStart(2, "0")}s`;
  return `${r}s`;
}

export function formatMult(n: number): string {
  return `×${n.toFixed(2)}`;
}
