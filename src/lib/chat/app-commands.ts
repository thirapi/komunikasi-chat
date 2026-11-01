/**
 * App-level commands that any component can trigger without prop drilling.
 * AppSidebar owns the dialogs and listens for these (see app-sidebar.tsx).
 */
export type AppCommand =
  | "search"
  | "new-dm"
  | "create-channel"
  | "explore-channels"
  /** Re-fetch the chat list (new room, deleted message) without router.refresh. */
  | "refresh-sidebar";

const EVENT = "komunikasi:command";

export function runAppCommand(command: AppCommand) {
  window.dispatchEvent(new CustomEvent<AppCommand>(EVENT, { detail: command }));
}

export function onAppCommand(handler: (command: AppCommand) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<AppCommand>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
