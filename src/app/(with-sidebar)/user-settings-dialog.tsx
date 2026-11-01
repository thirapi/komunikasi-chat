"use client";

import * as React from "react";
import { Shield, User, UserCircle, CircleNotch, Camera, CaretLeft, CaretRight, Info } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { updateUserAction, changePasswordAction } from "./user.action";
import { uploadFileResult } from "@/lib/chat/upload";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const data = {
  nav: [
    { name: "Profil", icon: User },
    { name: "Keamanan", icon: Shield },
    { name: "Tampilan", icon: Paintbrush },
  ],
};

function Paintbrush(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14.622 17.897-3.458-3.458 3.458-3.458 3.458 3.458Z" />
      <path d="M18.396 15.642 20 17.246a1 1 0 0 1 0 1.414l-1.417 1.417a1 1 0 0 1-1.414 0l-1.604-1.604" />
      <path d="M8 11.414 3.414 6.828a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.828 0L12.242 7.172" />
      <path d="m2 21 5-5" />
      <path d="M5 11h2" />
      <path d="M11 5v2" />
      <path d="M13 13h2" />
      <path d="M11 11v2" />
    </svg>
  )
}

// Flat tones drawn from the app palette (see globals.css chart colours).
const presetBanners = [
  "#6B8E7B",
  "#5C738B",
  "#C27A65",
  "#D8C3A5",
  "#8E8D8A",
  "#2C2C2E",
];

export function UserSettingsDialog({
  user,
  trigger,
}: {
  user: {
    id: string;
    name: string;
    username: string;
    initial: string;
    role: string;
    email: string;
    avatar: string;
    bio?: string | null;
    banner?: string | null;
    customStatus?: string | null;
  };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<string | null>("Profil");
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [username, setUsername] = React.useState(user.username);
  const [displayName, setDisplayName] = React.useState(user.name);
  const [avatar, setAvatar] = React.useState(user.avatar);
  const [bio, setBio] = React.useState(user.bio || "");
  const [banner, setBanner] = React.useState(user.banner || "");
  const [customStatus, setCustomStatus] = React.useState(user.customStatus || "");

  const [isUploading, setIsUploading] = React.useState(false);
  const [isBannerUploading, setIsBannerUploading] = React.useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);

  // Password fields
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async () => {
    if (!username.trim()) return toast.error("Nama pengguna tidak boleh kosong");
    setIsUpdating(true);
    try {
      const response = await updateUserAction(user.id, {
        username: username.trim(),
        name: displayName.trim() || null,
        avatar: avatar,
        bio: bio.trim() || null,
        banner: banner || null,
        customStatus: customStatus.trim() || null,

      });

      if (response.status === "success") {
        toast.success("Profil diperbarui");
      } else {
        toast.error(`Gagal memperbarui profil: ${response.error?.message}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return toast.error("Kata sandi baru tidak boleh kosong");
    if (newPassword !== confirmPassword) return toast.error("Konfirmasi kata sandi tidak cocok");

    setIsUpdating(true);
    try {
      const response = await changePasswordAction(user.id, {
        oldPassword,
        newPassword,
      });

      if (response.status === "success") {
        toast.success("Kata sandi diperbarui");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(response.error?.message || "Gagal mengubah kata sandi");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadFileResult(file, "avatars");

      if (response.status === "success" && response.data) {
        setAvatar(response.data.fileurl);
        toast.success("Foto profil diunggah");
      } else {
        toast.error(response.error?.message || "Gagal mengunggah foto");
      }
    } finally {
      setIsUploading(false);
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
      const response = await uploadFileResult(file, "banners");

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

  const isBannerUrl = banner && (banner.startsWith("http") || banner.startsWith("/"));
  const isDirty =
    username !== user.username ||
    displayName !== user.name ||
    avatar !== user.avatar ||
    bio !== (user.bio || "") ||
    banner !== (user.banner || "") ||
    customStatus !== (user.customStatus || "") ||
    customStatus !== (user.customStatus || "");

  const handleReset = () => {
    setUsername(user.username);
    setDisplayName(user.name);
    setAvatar(user.avatar);
    setBio(user.bio || "");
    setBanner(user.banner || "");
    setCustomStatus(user.customStatus || "");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md transition-colors">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            Edit profil
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 gap-0 h-[100dvh] w-full md:h-full md:max-h-[800px] md:max-w-[900px] lg:max-w-[1050px]">
        <SidebarProvider className="items-start min-h-0 h-full">
          <Sidebar collapsible="none" className={cn("hidden md:flex w-52 border-r border-border bg-muted/40", selectedItem && "hidden md:flex")}>
            <SidebarContent className="p-2">
              <div className="px-2 pt-3 pb-2">
                <p className="text-xs font-medium text-muted-foreground">Pengaturan</p>
              </div>
              <SidebarMenu>
                {data.nav.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={selectedItem === item.name}
                      onClick={() => setSelectedItem(item.name)}
                      className={cn(
                        "w-full justify-start gap-2.5 px-2 h-8 rounded-md transition-colors",
                        selectedItem === item.name
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col min-h-0 bg-background h-full relative">
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 pr-14 md:px-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedItem(null)}
                className={cn("md:hidden h-7 w-7 -ml-1", !selectedItem && "hidden")}
                aria-label="Kembali"
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-base font-semibold">
                {selectedItem || "Pengaturan"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Kelola profil, keamanan akun, dan tampilan aplikasi.
              </DialogDescription>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 md:p-6">
                {selectedItem === "Profil" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT COLUMN: EDIT FORM */}
                    <div className="lg:col-span-7 space-y-5 min-w-0">
                      {/* Banner & avatar */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Banner dan foto profil</p>
                        <div className="relative">
                          <div
                            className="relative group/banner h-28 rounded-lg overflow-hidden border border-border bg-muted"
                            style={banner ? { background: isBannerUrl ? `url(${banner}) center/cover no-repeat` : banner } : undefined}
                          >
                            <button
                              type="button"
                              className="absolute bottom-2 right-2 flex h-7 items-center gap-1 rounded-md bg-black/40 px-2 text-xs text-white hover:bg-black/60 transition-colors disabled:opacity-60"
                              onClick={() => bannerInputRef.current?.click()}
                              disabled={isBannerUploading}
                            >
                              {isBannerUploading ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                              Ubah banner
                            </button>
                            <input
                              type="file"
                              ref={bannerInputRef}
                              onChange={handleBannerUpload}
                              className="hidden"
                              accept="image/*"
                            />
                          </div>

                          {/* Overlapping avatar */}
                          <div className="absolute -bottom-10 left-4">
                            <div className="relative">
                              <button
                                type="button"
                                className="block rounded-full ring-4 ring-background"
                                onClick={() => setIsLightboxOpen(true)}
                                aria-label="Lihat foto profil"
                              >
                                <UserAvatar
                                  src={avatar}
                                  className="h-20 w-20 rounded-full"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-sm hover:text-foreground transition-colors disabled:opacity-60"
                                title="Ubah foto profil"
                                aria-label="Ubah foto profil"
                              >
                                {isUploading ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                              </button>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                accept="image/*"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Banner colour presets */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pl-28">
                        {presetBanners.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setBanner(p)}
                            className={cn(
                              "h-5 w-5 rounded-full border border-black/10 transition-shadow",
                              banner === p && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                            )}
                            style={{ background: p }}
                            aria-label={`Warna banner ${p}`}
                          />
                        ))}
                        <label
                          className="relative h-5 w-5 rounded-full overflow-hidden border border-border cursor-pointer focus-within:ring-2 focus-within:ring-ring"
                          title="Warna lain"
                        >
                          <input
                            type="color"
                            className="absolute -top-1 -left-1 h-8 w-8 cursor-pointer"
                            onChange={(e) => setBanner(e.target.value)}
                            value={!isBannerUrl && !presetBanners.includes(banner) ? banner : "#ffffff"}
                            aria-label="Pilih warna banner lain"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor="displayName" className="text-xs">Nama tampilan</Label>
                          <Input
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nama yang dilihat orang lain"
                          />
                        </div>

                        <div className="grid gap-1.5">
                          <Label htmlFor="username" className="text-xs">Nama pengguna</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                            <Input
                              id="username"
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                              className="pl-7"
                              placeholder="username"
                            />
                          </div>
                        </div>
                      </div>

                      <p className="flex items-start gap-2 text-xs text-muted-foreground -mt-2">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                        Mengubah nama pengguna juga mengubah alamat profil kamu.
                      </p>

                      <div className="grid gap-1.5">
                        <Label htmlFor="status" className="text-xs">Status</Label>
                        <Input
                          id="status"
                          value={customStatus}
                          onChange={(e) => setCustomStatus(e.target.value)}
                          placeholder="Sedang apa sekarang?"
                          maxLength={100}
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <div className="flex justify-between items-end">
                          <Label htmlFor="bio" className="text-xs">Bio</Label>
                          <span className="text-xs text-muted-foreground tabular-nums">{bio.length}/250</span>
                        </div>
                        <Textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className="resize-none"
                          rows={3}
                          placeholder="Ceritakan sedikit tentang dirimu"
                          maxLength={250}
                        />
                      </div>
                    </div>

                    {/* RIGHT COLUMN: PREVIEW */}
                    <div className="hidden lg:col-span-5 lg:flex flex-col">
                      <div className="sticky top-0 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Pratinjau</p>
                        <div className="w-full max-w-[300px] rounded-lg overflow-hidden bg-card border border-border">
                          {/* Mini banner */}
                          <div
                            className="h-20 w-full bg-muted"
                            style={banner ? { background: isBannerUrl ? `url(${banner}) center/cover no-repeat` : banner } : undefined}
                          />

                          <div className="px-4 pb-4">
                            <div className="-mt-8 relative w-fit">
                              <UserAvatar src={avatar} className="h-16 w-16 rounded-full ring-4 ring-card" />
                              <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-[3px] ring-card" />
                            </div>

                            <div className="mt-2 space-y-3">
                              <div className="min-w-0">
                                <p className="text-base font-semibold leading-tight truncate">
                                  {displayName || username || user.username}
                                </p>
                                <p className="text-xs text-muted-foreground">@{username || user.username}</p>
                              </div>

                              {customStatus && (
                                <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs break-words">{customStatus}</p>
                              )}

                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Tentang</p>
                                <p className={cn("text-sm leading-relaxed line-clamp-4 break-words", !bio && "text-muted-foreground")}>
                                  {bio || "Belum ada bio."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem === "Keamanan" && (
                  <div className="max-w-md space-y-5">
                    <div>
                      <p className="text-sm font-medium">Ubah kata sandi</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        Gunakan kata sandi yang kuat dan unik, minimal 8 karakter dengan kombinasi angka dan simbol.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor="old-password" className="text-xs">Kata sandi saat ini</Label>
                        <Input
                          id="old-password"
                          type="password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="new-password" className="text-xs">Kata sandi baru</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimal 8 karakter"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="confirm-password" className="text-xs">Konfirmasi kata sandi baru</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ulangi kata sandi baru"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleChangePassword}
                        disabled={isUpdating || !newPassword}
                        className="w-full sm:w-auto"
                      >
                        {isUpdating && <CircleNotch className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan kata sandi
                      </Button>
                    </div>
                  </div>
                )}

                {selectedItem === "Tampilan" && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Paintbrush className="h-8 w-8 text-muted-foreground mb-4" strokeWidth={1.5} />
                    <p className="text-sm font-medium">Tema dan warna aksen</p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mt-1">
                      Pengaturan tema dan warna aksen sedang disiapkan.
                    </p>
                    <span className="mt-4 inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      Segera hadir
                    </span>
                  </div>
                )}

                {/* Mobile navigation list (visible when selectedItem is null) */}
                {!selectedItem && (
                  <div className="md:hidden -mx-4 -mt-4">
                    {data.nav.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => setSelectedItem(item.name)}
                        className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <CaretRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {selectedItem === "Profil" && isDirty && (
              <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 md:px-6 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
                <span className="text-xs text-muted-foreground">Ada perubahan yang belum disimpan</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
                    Batalkan
                  </Button>
                  <Button size="sm" onClick={handleUpdateProfile} disabled={isUpdating} className="h-8 text-xs">
                    {isUpdating && <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Simpan
                  </Button>
                </div>
              </div>
            )}
          </main>
        </SidebarProvider>
      </DialogContent>
      <ImageLightbox
        images={[{
          url: avatar,
          filename: `Avatar ${user.name}`
        }]}
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
      />
    </Dialog>
  );
}
