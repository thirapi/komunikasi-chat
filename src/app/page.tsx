import { getUserSession } from "@/app/auth.action";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/landingpage/auth-shell";
import { SignInForm } from "@/app/signin/sign-in-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Komunikasi",
  description: "Komunikasi adalah platform pesan instan modern yang dirancang untuk kecepatan, keamanan, dan produktivitas. Hubungkan tim Anda dan berbagi ide dengan lancar.",
  keywords: ["chat", "real-time", "komunikasi", "pesan instan", "kolaborasi", "platform chat", "aman"],
  authors: [{ name: "Thirafi" }],
  openGraph: {
    title: "Komunikasi",
    description: "Hubungkan tim Anda dan berbagi ide dengan lancar di platform komunikasi masa depan.",
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
            description: "Platform pesan instan modern untuk kolaborasi tim.",
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
