export const VIEW_W = 360;
export const VIEW_H = 640;
export const SPAWN_Y = 40;
export const LEAK_Y = 524;

export const COLS = [76, 180, 284];
export const ROWS = [252, 348, 444];

export function slotPos(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: COLS[col] ?? 180, y: ROWS[row] ?? 348 };
}
