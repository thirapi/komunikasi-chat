import { formatSeparatorDate } from "./date-separator";

export function DateAndUnreadSeparator({ date }: { date: Date }) {
  return (
    <div role="separator" className="flex items-center gap-3 pl-4 pr-3 my-4 select-none">
      <div className="h-px flex-1 bg-rose-500/70" />
      <span className="text-[11px] font-medium text-rose-500">
        {formatSeparatorDate(date)}
      </span>
      <div className="h-px flex-1 bg-rose-500/70" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
        Baru
      </span>
    </div>
  );
}
