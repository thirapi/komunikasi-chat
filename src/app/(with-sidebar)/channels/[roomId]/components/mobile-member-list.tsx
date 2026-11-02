import { useState, useMemo } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { ChatTeardropText, Crown, UserMinus, SignOut, UserPlus, X } from "@phosphor-icons/react/dist/ssr";
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

interface MobileMemberListProps {
  roomData: RoomWithParticipantsDTO;
  onlineUserIds: string[];
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function MobileMemberList({
  roomData,
  onlineUserIds,
  isOpen,
  onClose,
  currentUserId
}: MobileMemberListProps) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ userId: string, isSelf: boolean } | null>(null);

  // Owner and admins can invite.
  const isOwner =
    currentUserId === roomData.ownerId ||
    roomData.participants.some((p) => p.user.id === currentUserId && p.role === "admin");

  const handleStartDM = async (targetUserId: string) => {
    if (targetUserId === currentUserId) return;
    const response = await createRoom(currentUserId, targetUserId);
    if (response.status === "success" && response.data) {
      onClose();
      router.push(`/channels/${response.data.id}`);
    } else {
      toast.error(response.error?.message || "Gagal membuat percakapan");
    }
  };

  const handleKick = (targetUserId: string) => {
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
          onClose();
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

  const onlineParticipants = useMemo(() => {
    return roomData.participants.filter((p) => onlineUserIds.includes(p.user.id));
  }, [roomData.participants, onlineUserIds]);

  const offlineParticipants = useMemo(() => {
    return roomData.participants.filter((p) => !onlineUserIds.includes(p.user.id));
  }, [roomData.participants, onlineUserIds]);

  const renderMobileParticipant = (participant: any, isParticipantOnline: boolean) => {
    const isParticipantOwner = participant.user.id === roomData.ownerId;
    const isSelf = participant.user.id === currentUserId;

    return (
      <div
        key={participant.user.id}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
      >
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
        >
          <div className="relative cursor-pointer shrink-0">
            <UserAvatar
              src={participant.user.avatar}
              alt={participant.user.username}
              className="h-9 w-9 rounded-lg border border-border/50 shadow-2xs"
            />
            {isParticipantOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
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
        >
          <div className="flex flex-col min-w-0 flex-1 cursor-pointer">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "text-xs font-medium truncate",
                isParticipantOnline ? "text-foreground" : "text-muted-foreground/75"
              )}>
                {participant.user.name || participant.user.username} {isSelf && "(Anda)"}
              </span>
              {isParticipantOwner && <Crown className="size-3 text-amber-500 fill-amber-500 shrink-0" />}
            </div>
            {participant.user.customStatus ? (
              <span className="text-[10px] text-muted-foreground truncate leading-tight">
                {participant.user.customStatus}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 leading-tight">
                {isParticipantOnline ? "Online" : "Offline"}
              </span>
            )}
          </div>
        </ProfileHoverCard>
      </div>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[300px] sm:w-[360px] flex flex-col p-0 [&>button]:hidden">
          <SheetHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anggota &bull; {roomData.participants.length}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {isOwner && (
                <Button
                  onClick={() => setShowInvite(true)}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Undang Anggota"
                >
                  <UserPlus weight="bold" className="size-3.5" />
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X weight="bold" className="size-3.5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {onlineParticipants.length > 0 && (
              <div>
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Online — {onlineParticipants.length}
                </div>
                <div className="space-y-0.5">
                  {onlineParticipants.map((p) => renderMobileParticipant(p, true))}
                </div>
              </div>
            )}

            {offlineParticipants.length > 0 && (
              <div>
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Offline — {offlineParticipants.length}
                </div>
                <div className="space-y-0.5">
                  {offlineParticipants.map((p) => renderMobileParticipant(p, false))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        roomId={roomData.id}
        roomName={roomData.name}
        currentUserId={currentUserId}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="w-[90vw] rounded-2xl sm:max-w-md">
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
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
