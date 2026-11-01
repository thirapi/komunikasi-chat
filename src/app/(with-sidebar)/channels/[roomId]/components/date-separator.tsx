export function formatSeparatorDate(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hari ini";
  if (date.toDateString() === yesterday.toDateString()) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

export function DateSeparator({ date }: { date: Date }) {
  return (
    <div role="separator" className="flex items-center gap-3 px-4 my-4 select-none">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground">
        {formatSeparatorDate(date)}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
