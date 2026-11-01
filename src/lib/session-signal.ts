/**
 * Tiny client-side "a user is signed in" signal.
 *
 * Some components live in the root layout (outside the signed-in tree), e.g.
 * the native shell. They must not register for push before login, and must
 * register right after it. CurrentUserProvider announces the user; those
 * components wait for it with whenSignedIn().
 */
const EVENT = "komunikasi:signed-in";
let currentUserId: string | null = null;

export function announceSignedIn(userId: string) {
  if (typeof window === "undefined" || currentUserId === userId) return;
  currentUserId = userId;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: userId }));
}

/** Runs `cb` once a user is signed in (immediately if already). Returns an unsubscribe. */
export function whenSignedIn(cb: (userId: string) => void) {
  if (typeof window === "undefined") return () => {};
  if (currentUserId) {
    cb(currentUserId);
    return () => {};
  }
  const listener = (e: Event) => {
    window.removeEventListener(EVENT, listener);
    cb((e as CustomEvent<string>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
