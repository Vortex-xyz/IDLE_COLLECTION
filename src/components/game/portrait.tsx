export function Portrait({ id, size = 72 }: { id: string; size?: number }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <img src="/art/ui/medallion.png" alt="" draggable={false} className="col-start-1 row-start-1 size-full object-contain" />
      <img
        src={`/art/monsters/${id}.png`}
        alt=""
        draggable={false}
        className="col-start-1 row-start-1 object-contain"
        style={{ width: Math.round(size * 0.68), height: Math.round(size * 0.68) }}
      />
    </span>
  );
}