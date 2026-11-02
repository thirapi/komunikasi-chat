import { useState, useMemo } from "react";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { Button } from "@/components/ui/button";
import { ChatTeardropText, Crown, UserMinus, SignOut, UserPlus } from "@phosphor-icons/react/dist/ssr";
import { createRoom, removeParticipant } from "../room.action";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InviteMemberDialog } from "./invite-member-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfileHoverCard } from "@/components/ui/profile-hover-card";



interface MemberListProps {
  roomData: RoomWithParticipantsDTO;
  onlineUserIds: string[];
  currentUserId: string;
}

export function MemberList({
  roomData,
  onlineUserIds,
  currentUserId,
}: MemberListProps) {
  const router = useRouter();

  const handleStartDM = async (targetUserId: string) => {
    if (targetUserId === currentUserId) return;

    const response = await createRoom(currentUserId, targetUserId);
    if (response.status === "success" && response.data) {
      router.push(`/channels/${response.data.id}`);
    } else {
      toast.error(response.error?.message || "Gagal membuat percakapan");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ userId: string, isSelf: boolean } | null>(null);

  const handleKick = async (targetUserId: string) => {
    const isSelf = targetUserId === currentUserId;
    setConfirmData({ userId: targetUserId, isSelf });
    setConfirmOpen(true);
  };

  const executeAction = async () => {
    if (!confirmData) return;
    const { userId: targetUserId, isSelf } = confirmData;

    try {
      const response = await removeParticipant(roomData.id, targetUserId, currentUserId);
      if (response.status === "success") {
        toast.success(isSelf ? "Berhasil keluar dari channel" : "Berhasil mengeluarkan anggota");
        if (isSelf) {
          router.push("/channels");
          router.refresh();
        } else {
          router.refresh();
        }
      } else {
        toast.error(response.error?.message || "Gagal melakukan aksi");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setConfirmOpen(false);
    }
  };

  const [showInvite, setShowInvite] = useState(false);
  // Owner and admins can invite.
  const isOwner =
    currentUserId === roomData.ownerId ||
    roomData.participants.some((p) => p.user.id === currentUserId && p.role === "admin");

  const onlineParticipants = useMemo(() => {
    return roomData.participants.filter((p) => onlineUserIds.includes(p.user.id));
  }, [roomData.participants, onlineUserIds]);

  const offlineParticipants = useMemo(() => {
    return roomData.participants.filter((p) => !onlineUserIds.includes(p.user.id));
  }, [roomData.participants, onlineUserIds]);

  const renderParticipant = (participant: any, isParticipantOnline: boolean) => {
    const isParticipantOwner = participant.user.id === roomData.ownerId;
    return (
      <li key={participant.user.id} className="group flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
        <ProfileHoverCard
          user={{
            id: participant.user.id,
            username: participant.user.username,
            avatar: participant.user.avatar,
            banner: participant.user.banner,
            bio: participant.user.bio,
            customStatus: participant.user.customStatus,
          }}
          isOnline={isParticipantOnline}
          currentUserId={currentUserId}
          onStartDM={handleStartDM}
          side="left"
        >
          <div className={cn("relative cursor-pointer shrink-0", !isParticipantOnline && "opacity-50")}>
            <UserAvatar
              src={participant.user.avatar}
              alt={participant.user.username}
              className="h-8 w-8 rounded-full"
            />
            {isParticipantOnline && (
              <div className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </div>
        </ProfileHoverCard>

        <ProfileHoverCard
          user={{
            id: participant.user.id,
            username: participant.user.username,
            avatar: participant.user.avatar,
            banner: participant.user.banner,
            bio: participant.user.bio,
            customStatus: participant.user.customStatus,
          }}
          isOnline={isParticipantOnline}
          currentUserId={currentUserId}
          onStartDM={handleStartDM}
          side="left"
        >
          <div className="flex flex-col min-w-0 flex-1 cursor-pointer">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-[13px] font-medium truncate",
                  isParticipantOnline ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {participant.user.name || participant.user.username}
              </span>
              {isParticipantOwner && (
                <Crown weight="fill" className="size-3 text-amber-500 shrink-0" aria-label="Pemilik" />
              )}
              {!isParticipantOwner && participant.role === "admin" && (
                <ShieldCheck weight="fill" className="size-3 text-primary shrink-0" aria-label="Admin" />
              )}
            </div>
            {participant.user.customStatus && (
              <span className="text-[11px] text-muted-foreground truncate leading-tight">
                {participant.user.customStatus}
              </span>
            )}
          </div>
        </ProfileHoverCard>
      </li>
    );
  };

  return (
    <>
      <aside className="w-60 h-full border-l border-border pt-3 pb-2 px-2 hidden lg:flex flex-col bg-background shrink-0">
        <div className="flex items-center justify-between mb-2 shrink-0 px-2 py-1">
          <h3 className="text-xs font-medium text-muted-foreground">
            Anggota · {roomData.participants.length}
          </h3>
          {isOwner && (
            <button
              onClick={() => setShowInvite(true)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Undang Anggota"
            >
              <UserPlus weight="bold" className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1 pb-4 space-y-4">
          {onlineParticipants.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                Online — {onlineParticipants.length}
              </div>
              <ul className="space-y-0.5 flex flex-col">
                {onlineParticipants.map((p) => renderParticipant(p, true))}
              </ul>
            </div>
          )}

          {offlineParticipants.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                Offline — {offlineParticipants.length}
              </div>
              <ul className="space-y-0.5 flex flex-col">
                {offlineParticipants.map((p) => renderParticipant(p, false))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        roomId={roomData.id}
        roomName={roomData.name}
        currentUserId={currentUserId}
      />
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmData?.isSelf ? "Keluar dari Channel" : "Keluarkan Anggota"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmData?.isSelf
                ? "Apakah Anda yakin ingin keluar dari channel ini? Anda perlu undangan kembali jika channel ini privat."
                : "Apakah Anda yakin ingin mengeluarkan anggota ini dari channel?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className="bg-destructive hover:bg-destructive/90"
            >
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
