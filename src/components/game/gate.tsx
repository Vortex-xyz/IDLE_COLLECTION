export function Gate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col items-center justify-between bg-ink px-6 py-8 text-parchment">
      <p className="font-display text-xs tracking-widest text-gold">A STOLEN VAULT</p>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <img src="/art/gate.jpg?v=2" alt="" className="h-56 w-full border border-line object-cover" />
        <h1 className="font-display text-4xl font-bold tracking-wide text-gold">Hoardbound</h1>
        <p className="max-w-xs text-base leading-relaxed text-parchment-dim">
          You lifted the king's treasure. His heroes are already on the stair. Bind monsters to the rings and let them fight while you are away.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          className="h-14 bg-gold text-lg font-semibold text-ink transition-transform duration-150 ease-out active:scale-[0.96]"
          onClick={onEnter}
        >
          Bar the vault
        </button>
        <p className="text-center text-sm text-parchment-dim">Waves march on their own. Gold keeps if you leave.</p>
      </div>
    </div>
  );
}
