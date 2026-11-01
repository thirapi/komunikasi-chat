export function UnreadSeparator() {
  return (
    <div role="separator" aria-label="Pesan baru" className="flex items-center gap-2 pl-4 pr-3 my-2 select-none">
      <div className="h-px flex-1 bg-rose-500/70" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
        Baru
      </span>
    </div>
  );
}
