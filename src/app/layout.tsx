import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Doto, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NativeShell } from "@/components/native-shell";
import NextTopLoader from "nextjs-toploader";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;
const doto = Doto({
  subsets: ["latin"],
  variable: "--font-doto",
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "Komunikasi",
  description:
    "Komunikasi adalah aplikasi web chat untuk obrolan ringan, cepat, dan aman. Cocok untuk tim, komunitas, and keluarga.",
  keywords: [
    "komunikasi",
    "web chat app",
    "aplikasi komunikasi",
    "chat online",
    "komunikasi ringan",
    "grup chat Indonesia",
  ],
  openGraph: {
    title: "Komunikasi",
    description:
      "Komunikasi adalah aplikasi web chat untuk obrolan ringan, cepat, dan aman. Cocok untuk tim, komunitas, dan keluarga.",
    url: "https://komunikasi.qzz.io/",
    siteName: "Komunikasi",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Komunikasi",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Komunikasi",
    description:
      "Komunikasi adalah aplikasi web chat untuk obrolan ringan, cepat, and aman.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Komunikasi",
  },
  metadataBase: new URL("https://komunikasi.qzz.io/"),
};

export const viewport: Viewport = {
  themeColor: "#000000",
  maximumScale: 1,
  userScalable: false,
  // Android Chrome: shrink the layout (not just the visual viewport) when the
  // keyboard opens, so the composer stays above it. iOS ignores this; see
  // ViewportHeightSync for that side.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} ${plusJakartaSans.variable} antialiased h-full flex flex-col`}
      >
        <NextTopLoader
          color="#A855F7"
          initialPosition={0.08}
          crawlSpeed={200}
          height={4}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={400}
          shadow="0 0 10px #A855F7,0 0 5px #A855F7"
          zIndex={999999999}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme={false}
        >
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
        <NativeShell />
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
