"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import {
  Hash, Globe, Lock, CircleNotch, Camera, X, SignOut, UserMinus, Crown,
  MagnifyingGlass, UserPlus, LinkSimple, Gear, ImageSquare, User as UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import { InviteMemberDialog } from "./invite-member-dialog";
import { SharedMediaGrid } from "@/components/shared-media-grid";
import Link from "next/link";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { updateChannel, deleteChannel, removeParticipant } from "../room.action";
import { uploadFileResult } from "@/lib/chat/upload";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface RoomDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomData: RoomWithParticipantsDTO;
  currentUserId: string;
  onUpdateRoom?: (data: Partial<RoomWithParticipantsDTO>) => void;
  onlineUserIds?: string[];
  /** Opens in-room message search (the dialog closes first). */
  onSearch?: () => void;
}

// Flat tones drawn from the app palette (see globals.css chart colours).
const bannerPresets = [
  "#6B8E7B",
  "#5C738B",
  "#C27A65",
  "#D8C3A5",
  "#8E8D8A",
  "#2C2C2E",
];

export function RoomDetailDialog({
  open,
  onOpenChange,
  roomData,
  currentUserId,
  onUpdateRoom,
  onlineUserIds = [],
  onSearch,
}: RoomDetailDialogProps) {
  const [name, setName] = useState(roomData.name);
  const [description, setDescription] = useState(roomData.description ?? "");
  const [isPublic, setIsPublic] = useState(roomData.isPublic);
  const [banner, setBanner] = useState(roomData.banner || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isOwner = currentUserId === roomData.ownerId;
  const isGeneral = roomData.id === "general-channel";
  const isDirect = roomData.isDirect;

  useEffect(() => {
    if (!open) {
      setAvatarPreview(null);
      setAvatarFile(null);
      setIsLeaving(false);
    }
  }, [open]);

  const [isLeaving, setIsLeaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [memberQuery, setMemberQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isDirty =
    name !== roomData.name ||
    description !== (roomData.description || "") ||
    isPublic !== roomData.isPublic ||
    banner !== (roomData.banner || "") ||
    avatarFile !== null;

  // Sync state when roomData changes
  useEffect(() => {
    setName(roomData.name);
    setDescription(roomData.description ?? "");
    setIsPublic(roomData.isPublic);
    setBanner(roomData.banner || "");
  }, [roomData]);

  const otherUser = isDirect
    ? roomData.participants.find((p) => p.user.id !== currentUserId)?.user
    : null;

  const currentAvatarSrc = avatarPreview || (isDirect ? otherUser?.avatar || "" : roomData.avatar);
  const currentAvatarName = isDirect ? otherUser?.username || "" : roomData.name;

  const handleAvatarClick = () => {
    if (isOwner && !isDirect) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran banner maksimal 5MB");
      return;
    }

    setIsBannerUploading(true);
    try {
      const response = await uploadFileResult(file, "room-banners");

      if (response.status === "success" && response.data) {
        setBanner(response.data.fileurl);
        toast.success("Banner diunggah");
      } else {
        toast.error(response.error?.message || "Gagal mengunggah banner");
      }
    } finally {
      setIsBannerUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama channel tidak boleh kosong");
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = roomData.avatar;

      if (avatarFile) {
        const uploadRes = await uploadFileResult(avatarFile, "room-avatars");
        if (uploadRes.status === "success" && uploadRes.data) {
          avatarUrl = uploadRes.data.fileurl;
        } else {
          toast.error("Gagal mengunggah avatar");
          setIsSaving(false);
          return;
        }
      }

      if (onUpdateRoom) {
        onUpdateRoom({
          name: name.trim(),
          description: description.trim(),
          isPublic,
          avatar: avatarUrl,
          banner: banner || null,
        });
      }

      const response = await updateChannel(roomData.id, currentUserId, {
        name: name.trim(),
        // Empty strings, not undefined: the repository's .set() skips
        // undefined columns, so clearing the description or removing the
        // banner never reached the database.
        description: description.trim(),
        isPublic,
        avatar: avatarUrl,
        banner: banner || "",
      });

      if (response.status === "success") {
        // Stay open: the owner usually wants to see the result in place.
        setAvatarFile(null);
        setAvatarPreview(null);
        toast.success("Pengaturan disimpan");
        router.refresh();
      } else {
        toast.error(response.error?.message ?? "Gagal menyimpan pengaturan");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveRoom = async () => {
    setIsLeaving(true);
    try {
      const response = await removeParticipant(roomData.id, currentUserId, currentUserId);
      if (response.status === "success") {
        toast.success("Berhasil keluar dari channel");
        onOpenChange(false);
        router.push("/channels");
        router.refresh();
      } else {
        toast.error(response.error?.message || "Gagal keluar channel");
      }
    } finally {
      setIsLeaving(false);
    }
  };

  const handleKickMember = async (userId: string, username: string) => {
    try {
      const response = await removeParticipant(roomData.id, userId, currentUserId);
      if (response.status === "success") {
        toast.success(`${username} berhasil dikeluarkan`);
        router.refresh();
      } else {
        toast.error(response.error?.message || "Gagal mengeluarkan member");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan");
    }
  };

  const isBannerUrl = banner && (banner.startsWith("http") || banner.startsWith("/"));

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await deleteChannel(roomData.id, currentUserId);

      if (response.status === "success") {
        toast.success("Channel berhasil dihapus");
        onOpenChange(false);
        router.push("/channels");
        router.refresh();
      } else {
        toast.error(response.error?.message ?? "Gagal menghapus channel");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const owner = roomData.participants.find((p) => p.user.id === roomData.ownerId)?.user;
  const isOtherOnline = !!otherUser && onlineUserIds.includes(otherUser.id);
  const onlineCount = roomData.participants.filter((p) => onlineUserIds.includes(p.user.id)).length;
  const joinLink = typeof window !== "undefined" ? `${window.location.origin}/join/${roomData.id}` : "";
  const canShareLink = !isDirect && (isPublic || isOwner);

  const displayBanner = (isDirect ? otherUser?.banner : banner) || "";
  const isDisplayBannerUrl = displayBanner.startsWith("http") || displayBanner.startsWith("/");
  const bannerStyle: React.CSSProperties = displayBanner
    ? { background: isDisplayBannerUrl ? `url(${displayBanner}) center/cover no-repeat` : displayBanner }
    : { background: fallbackTone(roomData.id) };

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const resetChanges = () => {
    setName(roomData.name);
    setDescription(roomData.description || "");
    setIsPublic(roomData.isPublic);
    setBanner(roomData.banner || "");
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  // Closing with unsaved edits asks first instead of silently keeping (or
  // losing) them.
  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setConfirmDiscard(true);
      return;
    }
    if (!next) setTab("overview");
    onOpenChange(next);
  };

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinLink);
    toast.success("Tautan undangan disalin");
  };

  const sortedParticipants = [...roomData.participants].sort((a, b) => {
    if (a.user.id === roomData.ownerId) return -1;
    if (b.user.id === roomData.ownerId) return 1;
    return (a.user.name || a.user.username).localeCompare(b.user.name || b.user.username);
  });
  const q = memberQuery.trim().toLowerCase();
  const matchingMembers = q
    ? sortedParticipants.filter(
        (p) => p.user.username.toLowerCase().includes(q) || (p.user.name || "").toLowerCase().includes(q),
      )
    : sortedParticipants;
  const onlineMembers = matchingMembers.filter((p) => onlineUserIds.includes(p.user.id));
  const offlineMembers = matchingMembers.filter((p) => !onlineUserIds.includes(p.user.id));

  const renderMember = (participant: (typeof roomData.participants)[number]) => {
    const isCurrentUser = participant.user.id === currentUserId;
    const isParticipantOwner = participant.user.id === roomData.ownerId;
    const online = onlineUserIds.includes(participant.user.id);
    return (
      <li key={participant.user.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors">
        <div className={cn("relative shrink-0", !online && "opacity-60")}>
          <UserAvatar src={participant.user.avatar} className="h-8 w-8 rounded-full" />
          {online && (
            <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {participant.user.name || participant.user.username}
            {isCurrentUser && <span className="ml-1 text-xs font-normal text-muted-foreground">(kamu)</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {participant.user.customStatus || `@${participant.user.username}`}
          </p>
        </div>
        {isParticipantOwner && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
            <Crown weight="fill" className="h-3 w-3" /> Pemilik
          </span>
        )}
        {isOwner && !isParticipantOwner && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={`Keluarkan ${participant.user.username}`}
              >
                <UserMinus className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Keluarkan {participant.user.username}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {participant.user.username} akan dikeluarkan dari #{roomData.name} dan tidak menerima pesannya lagi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleKickMember(participant.user.id, participant.user.username)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Keluarkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </li>
    );
  };

  const leaveDialog = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <QuickAction icon={SignOut} label="Keluar" tone="danger" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluar dari #{roomData.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Kamu tidak akan menerima pesan dari channel ini lagi.{" "}
            {isPublic ? "Kamu bisa bergabung kembali kapan saja." : "Kamu perlu diundang lagi untuk kembali."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeaveRoom}
            disabled={isLeaving}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isLeaving && <CircleNotch className="w-4 h-4 animate-spin mr-2" />}
            Keluar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const tabs = [
    { v: "overview", l: "Tentang" },
    ...(isDirect ? [{ v: "media", l: "Media" }] : [{ v: "members", l: "Anggota", n: roomData.participants.length }]),
    ...(isOwner && !isDirect ? [{ v: "settings", l: "Pengaturan" }] : []),
  ] as { v: string; l: string; n?: number }[];

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0 gap-0 w-[calc(100%-1.5rem)] sm:max-w-[520px] h-[min(720px,88dvh)] flex flex-col [&>button:last-child]:hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* ── Cover ─────────────────────────────────────────── */}
          <div className="relative h-32 shrink-0" style={bannerStyle}>
            {isDisplayBannerUrl && <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />}
            <DialogClose asChild>
              <button
                type="button"
                className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors"
                aria-label="Tutup"
              >
                <X weight="bold" className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>

          {/* ── Identity ──────────────────────────────────────── */}
          <div className="px-5">
            <div className="-mt-11 flex items-end">
              <button
                type="button"
                onClick={() => currentAvatarSrc && setIsLightboxOpen(true)}
                className={cn("relative block ring-[5px] ring-background bg-background", isDirect ? "rounded-full" : "rounded-[22px]")}
                aria-label="Lihat foto"
              >
                {currentAvatarSrc ? (
                  <UserAvatar
                    src={currentAvatarSrc}
                    alt={currentAvatarName}
                    className={cn("h-[84px] w-[84px]", isDirect ? "rounded-full" : "rounded-[18px]")}
                  />
                ) : (
                  <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[18px] bg-muted text-muted-foreground">
                    <Hash weight="bold" className="h-9 w-9" />
                  </span>
                )}
                {isDirect && (
                  <span className={cn(
                    "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full ring-[3px] ring-background",
                    isOtherOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )} />
                )}
              </button>
            </div>

            <DialogTitle className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span className="truncate">{isDirect ? otherUser?.name || otherUser?.username : roomData.name}</span>
              {!isDirect && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {isPublic ? "Publik" : "Privat"}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">
              {isDirect ? (
                <>
                  @{otherUser?.username}
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span className={isOtherOnline ? "text-emerald-600 dark:text-emerald-400" : undefined}>
                    {isOtherOnline ? "Online" : "Offline"}
                  </span>
                </>
              ) : (
                <>
                  {roomData.participants.length} anggota
                  {onlineCount > 0 && (
                    <>
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{onlineCount} online</span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>

            {/* Quick actions, Telegram-style */}
            <div className="mt-4 grid grid-flow-col auto-cols-fr gap-2">
              {onSearch && (
                <QuickAction
                  icon={MagnifyingGlass}
                  label="Cari"
                  onClick={() => {
                    onOpenChange(false);
                    onSearch();
                  }}
                />
              )}
              {isDirect && otherUser && (
                <QuickAction icon={UserIcon} label="Profil" href={`/profile/${otherUser.username}`} onClick={() => onOpenChange(false)} />
              )}
              {!isDirect && isOwner && <QuickAction icon={UserPlus} label="Undang" onClick={() => setShowInvite(true)} />}
              {canShareLink && <QuickAction icon={LinkSimple} label="Salin tautan" onClick={copyJoinLink} />}
              {!isDirect && isOwner && <QuickAction icon={Gear} label="Pengaturan" onClick={() => setTab("settings")} />}
              {!isDirect && !isOwner && !isGeneral && leaveDialog}
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────── */}
          <Tabs value={tab} onValueChange={setTab} className="mt-5 gap-0">
            <div className="sticky top-0 z-10 bg-background">
              <TabsList className="mx-5 h-10 w-auto justify-start gap-5 rounded-none border-b border-border bg-transparent p-0">
                {tabs.map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                  >
                    {t.l}
                    {t.n !== undefined && <span className="ml-1 tabular-nums text-muted-foreground">{t.n}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="px-5 py-5">
              {/* Tentang */}
              <TabsContent value="overview" className="mt-0 space-y-5">
                {isDirect ? (
                  <>
                    {otherUser?.customStatus && (
                      <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm break-words">{otherUser.customStatus}</p>
                    )}
                    <Field label="Bio">
                      {otherUser?.bio ? (
                        <p className="whitespace-pre-line break-words leading-relaxed">{otherUser.bio}</p>
                      ) : (
                        <span className="text-muted-foreground">Belum menulis bio.</span>
                      )}
                    </Field>
                    {otherUser?.createdAt && <Field label="Bergabung">{formatDate(otherUser.createdAt)}</Field>}
                  </>
                ) : (
                  <>
                    <Field label="Deskripsi">
                      {roomData.description ? (
                        <p className="whitespace-pre-line break-words leading-relaxed">{roomData.description}</p>
                      ) : (
                        <span className="text-muted-foreground">
                          Belum ada deskripsi.
                          {isOwner && (
                            <button type="button" onClick={() => setTab("settings")} className="ml-1 text-primary hover:underline">
                              Tambahkan
                            </button>
                          )}
                        </span>
                      )}
                    </Field>
                    <div className="grid grid-cols-2 gap-5">
                      <Field label="Pemilik">
                        <span className="flex items-center gap-2 min-w-0">
                          <UserAvatar src={owner?.avatar || ""} className="h-5 w-5 rounded-full" />
                          <span className="truncate">{owner?.name || owner?.username || "Tidak diketahui"}</span>
                        </span>
                      </Field>
                      <Field label="Dibuat">{formatDate(roomData.createdAt)}</Field>
                    </div>
                    {canShareLink && (
                      <Field label="Tautan undangan">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                            {joinLink.replace(/^https?:\/\//, "")}
                          </code>
                          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copyJoinLink}>
                            Salin
                          </Button>
                        </div>
                      </Field>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Media (DM) */}
              {isDirect && otherUser && (
                <TabsContent value="media" className="mt-0 -mx-5 -mb-5 [&>div]:md:px-5">
                  <SharedMediaGrid currentUserId={currentUserId} profileUsername={otherUser.username} />
                  <p className="px-5 pb-5 text-center text-sm text-muted-foreground only:block hidden">Belum ada media.</p>
                </TabsContent>
              )}

              {/* Anggota */}
              {!isDirect && (
                <TabsContent value="members" className="mt-0">
                  {roomData.participants.length > 8 && (
                    <div className="relative mb-3">
                      <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Cari anggota"
                        className="h-9 pl-9"
                      />
                    </div>
                  )}
                  {matchingMembers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada anggota yang cocok.</p>
                  ) : (
                    <div className="space-y-4">
                      {onlineMembers.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Online — {onlineMembers.length}</p>
                          <ul className="-mx-2">{onlineMembers.map(renderMember)}</ul>
                        </div>
                      )}
                      {offlineMembers.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Offline — {offlineMembers.length}</p>
                          <ul className="-mx-2">{offlineMembers.map(renderMember)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Pengaturan (owner) */}
              {isOwner && !isDirect && (
                <TabsContent value="settings" className="mt-0 space-y-7">
                  <Section title="Tampilan" description="Banner dan foto yang dilihat semua anggota.">
                    {/* Banner editor with a live preview */}
                    <div className="overflow-hidden rounded-lg border border-border">
                      <div className="relative h-24" style={bannerStyle}>
                        {isBannerUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                            <CircleNotch className="h-5 w-5 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => bannerInputRef.current?.click()}
                          disabled={isBannerUploading}
                        >
                          <ImageSquare className="h-4 w-4" />
                          {isDisplayBannerUrl ? "Ganti gambar" : "Unggah gambar"}
                        </Button>
                        {banner && (
                          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setBanner("")}>
                            Hapus
                          </Button>
                        )}
                        <div className="ml-auto flex items-center gap-1.5" role="radiogroup" aria-label="Warna banner">
                          {bannerPresets.map((p) => (
                            <button
                              key={p}
                              type="button"
                              role="radio"
                              aria-checked={banner === p}
                              onClick={() => setBanner(p)}
                              className={cn(
                                "h-6 w-6 rounded-full border border-black/10 transition-shadow dark:border-white/10",
                                banner === p && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                              )}
                              style={{ background: p }}
                              aria-label={`Warna ${p}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">Gambar disarankan 1500 × 500 px, maksimal 5 MB.</p>

                    <div className="mt-4 flex items-center gap-3">
                      {currentAvatarSrc ? (
                        <UserAvatar src={currentAvatarSrc} alt={currentAvatarName} className="h-12 w-12 rounded-xl" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Hash weight="bold" className="h-5 w-5" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Foto channel</p>
                        <p className="text-xs text-muted-foreground">PNG atau JPG, maksimal 5 MB.</p>
                      </div>
                      {avatarFile && (
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                          Batal
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleAvatarClick}>
                        <Camera className="h-4 w-4" /> Ganti
                      </Button>
                    </div>
                  </Section>

                  <Section title="Informasi">
                    <div className="grid gap-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor="channel-name" className="text-xs">Nama channel</Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="channel-name"
                            value={name}
                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                            className="pl-9"
                            disabled={isSaving}
                            placeholder="nama-channel"
                          />
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <div className="flex items-baseline justify-between">
                          <Label htmlFor="channel-desc" className="text-xs">Deskripsi</Label>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{description.length}/300</span>
                        </div>
                        <Textarea
                          id="channel-desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                          disabled={isSaving}
                          placeholder="Untuk apa channel ini?"
                          className="resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Privasi">
                    <label
                      htmlFor="channel-public"
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3",
                        isGeneral ? "opacity-50" : "cursor-pointer hover:bg-muted/40 transition-colors",
                      )}
                    >
                      <span>
                        <span className="block text-sm font-medium">Channel publik</span>
                        <span className="block text-xs text-muted-foreground">
                          {isPublic ? "Siapa pun bisa menemukan dan bergabung." : "Hanya bisa bergabung lewat undangan."}
                        </span>
                      </span>
                      <Switch id="channel-public" checked={isPublic} onCheckedChange={setIsPublic} disabled={isSaving || isGeneral} />
                    </label>
                  </Section>

                  {!isGeneral && (
                    <Section title="Zona bahaya">
                      <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 px-3.5 py-3">
                        <span>
                          <span className="block text-sm font-medium">Hapus channel</span>
                          <span className="block text-xs text-muted-foreground">Channel dan semua pesannya hilang permanen.</span>
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isDeleting}>
                              {isDeleting ? <CircleNotch className="w-4 h-4 animate-spin" /> : "Hapus"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus #{roomData.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Channel dan seluruh pesannya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                                Hapus channel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Section>
                  )}
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>

        <input type="file" ref={bannerInputRef} onChange={handleBannerUpload} className="hidden" accept="image/*" />
        <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />

        {isOwner && !isDirect && isDirty && (
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-3 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <span className="text-xs text-muted-foreground">Ada perubahan yang belum disimpan</span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={resetChanges} className="h-8" disabled={isSaving}>
                Batalkan
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !name.trim()} className="h-8">
                {isSaving && <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Simpan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      <ImageLightbox
        images={[{ url: currentAvatarSrc, filename: `Foto ${currentAvatarName}` }]}
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
      />
    </Dialog>

    {!isDirect && isOwner && (
      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        roomId={roomData.id}
        roomName={roomData.name}
        currentUserId={currentUserId}
      />
    )}

    <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Buang perubahan?</AlertDialogTitle>
          <AlertDialogDescription>Perubahan pada pengaturan channel belum disimpan.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Lanjut mengedit</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              resetChanges();
              setTab("overview");
              onOpenChange(false);
            }}
          >
            Buang
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

type QuickActionProps = {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

/** Icon-over-label action tile used in the dialog header. */
const QuickAction = forwardRef<HTMLButtonElement, QuickActionProps>(function QuickAction(
  { icon: Icon, label, onClick, href, tone = "default", className, ...rest },
  ref,
) {
  const classes = cn(
    "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/30 px-2 text-xs font-medium transition-colors hover:bg-muted",
    tone === "danger" ? "text-destructive hover:bg-destructive/10" : "text-foreground",
    className,
  );
  const content = (
    <>
      <Icon className="h-[18px] w-[18px]" />
      <span className="truncate max-w-full">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" onClick={onClick} className={classes} {...rest}>
      {content}
    </button>
  );
});

/** A calm default cover per room, so rooms without a banner are not all grey. */
function fallbackTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const base = bannerPresets[h % (bannerPresets.length - 1)];
  return `linear-gradient(135deg, ${base} 0%, color-mix(in oklab, ${base} 70%, black) 100%)`;
}
