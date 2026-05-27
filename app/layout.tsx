import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MJM Brokerage Scheduling Application",
  description:
    "Brokerage scheduling for call center and driver operations. Coverage, validation, pods, shifts, cubicles, team matrix, roster, and optimizer — backed by the latest snapshot.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>{children}</NuqsAdapter>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
