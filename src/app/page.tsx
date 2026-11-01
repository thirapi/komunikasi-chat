import { getUserSession } from "@/app/auth.action";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/landingpage/auth-shell";
import { SignInForm } from "@/app/signin/sign-in-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Komunikasi",
  description: "Aplikasi chat dengan channel untuk grup dan pesan pribadi antar pengguna. Pesan masuk langsung tanpa perlu refresh.",
  keywords: ["chat", "real-time", "komunikasi", "pesan instan", "kolaborasi", "platform chat", "aman"],
  authors: [{ name: "Thirafi" }],
  openGraph: {
    title: "Komunikasi",
    description: "Channel buat ramai-ramai, DM buat yang pribadi.",
    url: "https://komunikasi.qzz.io",
    siteName: "Komunikasi",
    locale: "id_ID",
    type: "website",
  },
};

export default async function House() {
  const session = await getUserSession();

  // If user is already logged in, redirect to the app immediately
  if (session) {
    redirect("/channels/default");
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Komunikasi",
            url: "https://komunikasi.qzz.io",
            description: "Aplikasi chat dengan channel dan pesan pribadi.",
            applicationCategory: "CommunicationApplication",
          }),
        }}
      />
      <AuthShell switchTo={{ href: "/signup", label: "Daftar", hint: "Belum punya akun?" }}>
        <SignInForm />
      </AuthShell>
    </>
  );
}
