"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CaretLeft, CaretRight, Camera, CircleNotch, User, Key, PaintBrush, Info, Desktop, Sun, Moon, Check, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { updateUserAction, changePasswordAction, getPrivacyAction, updatePrivacyAction } from "../user.action";
import { Switch } from "@/components/ui/switch";
import { uploadFileResult } from "@/lib/chat/upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { APP_VERSION, APP_VERSION_CODE } from "@/lib/version";
import { isNative, platform } from "@/lib/native/platform";

const sections = [
    { id: "profile", label: "Profil", description: "Nama, username, foto, bio", icon: User },
    { id: "security", label: "Keamanan", description: "Ganti password", icon: Key },
    { id: "privacy", label: "Privasi", description: "Terakhir dilihat, tanda dibaca", icon: LockSimple },
    { id: "appearance", label: "Tampilan", description: "Tema terang atau gelap", icon: PaintBrush },
    { id: "about", label: "Tentang", description: "Versi aplikasi", icon: Info },
] as const;

type SectionId = (typeof sections)[number]["id"];

interface SettingsViewProps {
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
    } | null;
}

function ProfileForm({ user }: { user: NonNullable<SettingsViewProps["user"]> }) {
    const [username, setUsername] = React.useState(user.username);
    const [displayName, setDisplayName] = React.useState(user.name);
    const [avatar, setAvatar] = React.useState(user.avatar);
    const [bio, setBio] = React.useState(user.bio || "");
    const [customStatus, setCustomStatus] = React.useState(user.customStatus || "");
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUpdate = async () => {
        if (!username.trim()) return toast.error("Username tidak boleh kosong");
        setIsUpdating(true);
        try {
            const response = await updateUserAction(user.id, {
                username: username.trim(),
                name: displayName.trim() || null,
                avatar,
                bio: bio.trim() || null,
                customStatus: customStatus.trim() || null,
            });
            if (response.status === "success") toast.success("Profil disimpan");
            else toast.error(response.error?.message || "Gagal menyimpan profil");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran file maksimal 2 MB");
        setIsUploading(true);
        try {
            const response = await uploadFileResult(file, "avatars");
            if (response.status === "success" && response.data) {
                setAvatar(response.data.fileurl);
                toast.success("Foto diunggah. Simpan untuk menerapkan.");
            } else toast.error(response.error?.message || "Gagal mengunggah");
        } finally {
            setIsUploading(false);
        }
    };

    const isDirty = username !== user.username || displayName !== user.name || avatar !== user.avatar ||
        bio !== (user.bio || "") || customStatus !== (user.customStatus || "");

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <UserAvatar src={avatar} alt={displayName || user.name} className="size-16 rounded-full" />
                <div className="flex flex-col items-start gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? <CircleNotch className="animate-spin" /> : <Camera />}
                        Ganti foto
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG, atau GIF. Maks 2 MB.</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
            </div>

            <div className="grid gap-5">
                <Field label="Nama tampilan" htmlFor="displayName">
                    <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </Field>
                <Field
                    label="Username"
                    htmlFor="username"
                    hint="Mengganti username juga mengganti tautan profilmu."
                >
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                        <Input
                            id="username"
                            value={username}
                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                            className="pl-7"
                        />
                    </div>
                </Field>
                <Field label="Status" htmlFor="customStatus">
                    <Input
                        id="customStatus"
                        value={customStatus}
                        onChange={e => setCustomStatus(e.target.value)}
                        placeholder="Sedang apa?"
                        maxLength={100}
                    />
                </Field>
                <Field label="Bio" htmlFor="bio" hint={<span className="tabular-nums">{bio.length}/250</span>}>
                    <textarea
                        id="bio"
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="flex min-h-[88px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                        placeholder="Ceritakan sedikit tentang dirimu"
                        maxLength={250}
                    />
                </Field>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleUpdate} disabled={!isDirty || isUpdating}>
                    {isUpdating && <CircleNotch className="animate-spin" />}
                    Simpan
                </Button>
            </div>
        </div>
    );
}

function Field({
    label,
    htmlFor,
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    hint?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function SecurityForm({ user }: { user: NonNullable<SettingsViewProps["user"]> }) {
    const [oldPassword, setOldPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleChange = async () => {
        if (!newPassword) return toast.error("Password baru tidak boleh kosong");
        if (newPassword !== confirmPassword) return toast.error("Konfirmasi password tidak cocok");
        setIsUpdating(true);
        try {
            const response = await changePasswordAction(user.id, { oldPassword, newPassword });
            if (response.status === "success") {
                toast.success("Password diganti");
                setOldPassword(""); setNewPassword(""); setConfirmPassword("");
            } else toast.error(response.error?.message || "Gagal mengganti password");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-5">
                <Field label="Password saat ini" htmlFor="oldPassword">
                    <Input id="oldPassword" type="password" autoComplete="current-password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                </Field>
                <Field label="Password baru" htmlFor="newPassword" hint="Minimal 8 karakter.">
                    <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </Field>
                <Field label="Ulangi password baru" htmlFor="confirmPassword">
                    <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </Field>
            </div>
            <div className="flex justify-end">
                <Button onClick={handleChange} disabled={isUpdating || !newPassword}>
                    {isUpdating && <CircleNotch className="animate-spin" />}
                    Ganti password
                </Button>
            </div>
        </div>
    );
}

function PrivacyRow({
    label,
    description,
    checked,
    disabled,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
}) {
    const id = React.useId();
    return (
        <div className="flex items-start gap-4 px-3 py-3">
            <div className="min-w-0 flex-1">
                <label htmlFor={id} className="text-sm font-medium">{label}</label>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
        </div>
    );
}

/**
 * Both settings are reciprocal, as in WhatsApp: turning one off also hides
 * the same information about other people from you.
 */
function PrivacySection() {
    const [settings, setSettings] = React.useState<{ showLastSeen: boolean; readReceipts: boolean } | null>(null);
    React.useEffect(() => {
        getPrivacyAction().then((res) => {
            if (res.status === "success" && res.data) setSettings(res.data);
        });
    }, []);

    const change = async (key: "showLastSeen" | "readReceipts", value: boolean) => {
        if (!settings) return;
        const previous = settings;
        setSettings({ ...settings, [key]: value });
        const res = await updatePrivacyAction({ [key]: value });
        if (res.status !== "success" || !res.data) {
            setSettings(previous);
            toast.error(res.error?.message || "Gagal menyimpan");
            return;
        }
        setSettings(res.data);
    };

    return (
        <div className="space-y-3">
            <div className="divide-y divide-border rounded-md border border-border">
                <PrivacyRow
                    label="Tampilkan terakhir dilihat"
                    description="Jika dimatikan, orang lain hanya melihat perkiraan (misalnya “baru-baru ini”), dan kamu juga tidak bisa melihat waktu terakhir dilihat orang lain."
                    checked={settings?.showLastSeen ?? true}
                    disabled={!settings}
                    onChange={(v) => change("showLastSeen", v)}
                />
                <PrivacyRow
                    label="Tanda dibaca"
                    description="Centang biru (✓✓) di pesan langsung. Jika dimatikan, kamu juga tidak melihat tanda dibaca dari orang lain."
                    checked={settings?.readReceipts ?? true}
                    disabled={!settings}
                    onChange={(v) => change("readReceipts", v)}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                Pengguna yang kamu blokir tidak bisa melihat terakhir dilihatmu.
            </p>
        </div>
    );
}

function AppearanceSection() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const options = [
        { id: "system", label: "Ikuti sistem", icon: Desktop },
        { id: "light", label: "Terang", icon: Sun },
        { id: "dark", label: "Gelap", icon: Moon },
    ];

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tema</p>
            <div className="divide-y divide-border rounded-md border border-border" role="radiogroup" aria-label="Tema">
                {options.map(({ id, label, icon: Icon }) => {
                    const selected = mounted && theme === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setTheme(id)}
                            className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                            <Icon className="size-4 text-muted-foreground" />
                            <span className="flex-1">{label}</span>
                            {selected && <Check className="size-4" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AboutRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium tabular-nums">{value}</span>
        </div>
    );
}

function AboutSection() {
    // Resolved at render rather than module scope so the Capacitor global is
    // already present; in a browser tab this reports "Web".
    const [runtime, setRuntime] = React.useState("Web");
    React.useEffect(() => {
        setRuntime(
            isNative() ? (platform() === "ios" ? "iOS" : "Android") : "Web",
        );
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/maskable_icon.png" alt="" width={40} height={40} className="rounded-lg" />
                <div>
                    <p className="font-medium">Komunikasi</p>
                    <p className="text-sm text-muted-foreground">Versi {APP_VERSION}</p>
                </div>
            </div>

            <div className="divide-y divide-border rounded-md border border-border px-3">
                <AboutRow label="Versi" value={APP_VERSION} />
                <AboutRow label="Build" value={String(APP_VERSION_CODE)} />
                <AboutRow label="Platform" value={runtime} />
            </div>

            <div className="flex items-center justify-between text-sm">
                <Link href="/CHANGELOG.md" className="underline underline-offset-4">
                    Catatan rilis
                </Link>
                <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Komunikasi</span>
            </div>
        </div>
    );
}

export default function SettingsView({ user }: SettingsViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const param = searchParams.get("section");
    // null = the section list. Mobile shows either the list or one section;
    // desktop always shows both, so it falls back to the first section.
    const selected = sections.find((s) => s.id === param)?.id ?? null;
    const active: SectionId = selected ?? "profile";

    // push, not replace, so the Android back button returns to the list.
    const open = (id: SectionId) => router.push(`/settings?section=${id}`, { scroll: false });

    if (!user) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-muted-foreground">Masuk dulu untuk membuka pengaturan.</p>
                <Button asChild><Link href="/">Masuk</Link></Button>
            </div>
        );
    }

    const current = sections.find((s) => s.id === active)!;

    return (
        <div className="flex h-full flex-col bg-background">
            <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 md:px-6">
                {selected && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/settings", { scroll: false })}
                        className="size-9 md:hidden"
                        aria-label="Kembali"
                    >
                        <CaretLeft className="size-5" />
                    </Button>
                )}
                <h1 className={cn("text-[15px] font-semibold tracking-tight", !selected && "px-2 md:px-0")}>
                    <span className="md:hidden">{selected ? current.label : "Pengaturan"}</span>
                    <span className="hidden md:inline">Pengaturan</span>
                </h1>
            </header>

            <div className="flex min-h-0 flex-1">
                {/* Section list: the whole screen on mobile, a left rail on desktop. */}
                <nav
                    className={cn(
                        "w-full shrink-0 overflow-y-auto md:block md:w-60 md:border-r md:border-border md:p-3",
                        selected && "max-md:hidden"
                    )}
                >
                    <ul className="divide-y divide-border md:space-y-0.5 md:divide-y-0">
                        {sections.map(({ id, label, description, icon: Icon }) => (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => open(id)}
                                    aria-current={active === id ? "page" : undefined}
                                    className={cn(
                                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted md:rounded-md md:px-2.5 md:py-2",
                                        active === id ? "md:bg-muted" : "md:hover:bg-muted/60"
                                    )}
                                >
                                    <Icon className="size-[18px] shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium md:font-normal">{label}</span>
                                        <span className="block truncate text-xs text-muted-foreground md:hidden">{description}</span>
                                    </span>
                                    <CaretRight className="size-4 text-muted-foreground md:hidden" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <main
                    className={cn(
                        "min-w-0 flex-1 overflow-y-auto",
                        !selected && "max-md:hidden"
                    )}
                >
                    <div className="mx-auto max-w-xl px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-10 md:pt-8">
                        <h2 className="mb-6 hidden text-lg font-semibold tracking-tight md:block">{current.label}</h2>
                        {active === "profile" && <ProfileForm user={user} />}
                        {active === "security" && <SecurityForm user={user} />}
                        {active === "privacy" && <PrivacySection />}
                        {active === "appearance" && <AppearanceSection />}
                        {active === "about" && <AboutSection />}
                    </div>
                </main>
            </div>
        </div>
    );
}
