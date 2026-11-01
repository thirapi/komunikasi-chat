"use client";

import { createContext, useContext, useEffect } from "react";
import { clientChatCache } from "@/lib/infrastructure/cache/client-cache";
import { announceSignedIn } from "@/lib/session-signal";
import { WebPushSubscription } from "@/components/web-push-subscription";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

/**
 * The signed-in user, resolved once by the (with-sidebar) layout. Rooms read it
 * synchronously so switching chats never waits on a session round-trip.
 */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  // A cache written by another account (shared computer, account switch,
  // expired session followed by a different login) is wiped before use.
  useEffect(() => {
    if (!user?.id) return;
    void clientChatCache.ensureOwner(user.id);
    announceSignedIn(user.id);
  }, [user?.id]);

  return (
    <CurrentUserContext.Provider value={user}>
      {user?.id && <WebPushSubscription userId={user.id} />}
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
