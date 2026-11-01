import { SidebarTrigger } from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import { ChatRoomClientWrapper } from "@/app/(with-sidebar)/channels/[roomId]/components/chat-room-client-wrapper";
import { getUserSession } from "@/app/auth.action";
import { AnimatedUsername } from "@/components/landingpage/animated-username";
import Link from "next/link";
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

  const username = session.user.username || "Pengguna";

  if (roomId === "default") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background relative px-6">
        <div className="absolute top-4 md:hidden left-4 z-10">
          <SidebarTrigger />
        </div>

        {/* <div className="absolute inset-0 z-0">
          <ColorBends
            className="w-full h-full"
            colors={["#ff7aa2", "#8b7bff", "#4dd6c6"]}
            rotation={90}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            noise={0.15}
            parallax={0.5}
            iterations={1}
            intensity={1.5}
            bandWidth={6}
            transparent
            autoRotate={0}
          />
        </div> */}

        {/* blur */}
        {/* <div className="absolute inset-0 backdrop-blur-2xl z-[1]" /> */}

        <div className="relative z-10 text-center space-y-8">
          <div className="relative">
            <BrandLogo size={96} className="mx-auto relative z-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Selamat datang 👋{" "}
              <span className="block sm:inline font-bold text-primary">
                <AnimatedUsername username={username} />
              </span>
            </h2>
            <p className="text-muted-foreground text-base">
              Pilih channel di sidebar untuk memulai
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/70">
            <span>Atau</span>
            <Link href={"/channels/general-channel"}
              className="text-primary hover:underline font-medium"
            >
              masuk ke #general
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      <ChatRoomClientWrapper roomId={roomId} />
    </div>
  );
}
