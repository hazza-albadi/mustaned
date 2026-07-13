import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

// Site-wide typeface — the brand identity actually specifies DIN Next LT
// Arabic, but that's a licensed font we don't have yet. IBM Plex Sans Arabic
// is a close open-license stand-in with a matching weight system; swapping
// it out later only means changing this one import.
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "مستند",
  description: "Internal company forms, routed to the right department head for approval.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body className={`${ibmPlexSansArabic.variable} ${geistMono.variable} font-sans antialiased`}>
        <I18nProvider initialLocale={locale}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </I18nProvider>
      </body>
    </html>
  );
}
