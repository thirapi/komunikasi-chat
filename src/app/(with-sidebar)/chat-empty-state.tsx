"use client";

import { ChatCircle, Hash, Compass, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Shortcut } from "@/components/ui/kbd";
import { runAppCommand, type AppCommand } from "@/lib/chat/app-commands";

/**
 * What /channels/default shows next to the sidebar on desktop. On mobile this
 * pane is hidden and the sidebar takes the whole screen (see
 * MobileStackContent), so it only needs to work at md and up.
 *
 * Deliberately quiet: a greeting, the few things you can start from here, and
 * the shortcuts worth knowing. The dialogs live in AppSidebar and are opened
 * through the app command bus.
 */
const ACTIONS: { command: AppCommand; label: string; hint: string; icon: React.ElementType; keys?: string[] }[] = [
  { command: "search", label: "Cari pesan", hint: "Di semua channel dan obrolan", icon: MagnifyingGlass, keys: ["mod", "k"] },
  { command: "new-dm", label: "Pesan baru", hint: "Mulai obrolan pribadi", icon: ChatCircle },
  { command: "create-channel", label: "Buat channel", hint: "Ruang untuk tim atau topik", icon: Hash },
  { command: "explore-channels", label: "Jelajahi channel", hint: "Gabung channel publik", icon: Compass },
];

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["mod", "k"], label: "Cari di semua pesan" },
  { keys: ["mod", "f"], label: "Cari di room yang terbuka" },
  { keys: ["up"], label: "Edit pesan terakhir" },
  { keys: ["esc"], label: "Batal balas / edit" },
];

export function ChatEmptyState({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-sm">
        <p className="text-sm text-muted-foreground">Halo, {name}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
          Pilih obrolan untuk mulai
        </h1>

        <ul className="mt-6 -mx-2">
          {ACTIONS.map(({ command, label, hint, icon: Icon, keys }) => (
            <li key={command}>
              <button
                type="button"
                onClick={() => runAppCommand(command)}
                className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground group-hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{hint}</span>
                </span>
                {keys && <Shortcut keys={keys} />}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Pintasan keyboard</p>
          <dl className="mt-2 space-y-1.5">
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={label} className="flex items-center justify-between gap-4 text-xs">
                <dt className="text-muted-foreground">{label}</dt>
                <dd><Shortcut keys={keys} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
