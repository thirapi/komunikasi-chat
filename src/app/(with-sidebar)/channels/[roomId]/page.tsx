import { getUserSession } from "@/app/auth.action";
import { redirect } from "next/navigation";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await getUserSession();

  // The proxy only checks that a session cookie exists. An expired or revoked
  // one used to render the chat shell with no user (empty sidebar, failing
  // actions); send it back to login and return here afterwards.
  if (!session?.user) {
    const target = `/channels/${roomId}`;
    redirect(roomId === "default" ? "/" : `/?callbackUrl=${encodeURIComponent(target)}`);
  }

  // Both the open room and the empty state are rendered by <RoomHost> in
  // channels/layout.tsx, purely from the URL, so switching chats (including
  // back to the empty state) can happen entirely on the client. This page only
  // keeps the session gate for full page loads.
  return null;
}
