import { Metadata } from "next";
import { getUserWithRolesFromSession, sidaBarUserInfo } from "../../auth.action";
import SettingsView from "./settings-view";
import { getInitials } from "@/lib/get-initials";

export const metadata: Metadata = {
    title: "Pengaturan - Komunikasi",
    description: "Atur akun Komunikasi kamu.",
};

export default async function SettingsPage() {
    const fullCurrentUser = await getUserWithRolesFromSession();
    const userInfo = await sidaBarUserInfo();

    const user = fullCurrentUser ? {
        id: fullCurrentUser.id,
        name: userInfo.name,
        username: userInfo.username,
        initial: getInitials(userInfo.name),
        role: fullCurrentUser.roles.map(r => r.name).join(", "),
        email: "komunikasi.qzz.io",
        avatar: userInfo.avatar,
        bio: userInfo.bio,
        banner: userInfo.banner,
        customStatus: userInfo.customStatus,
    } : null;

    return <SettingsView user={user} />;
}
