import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { ToastProvider } from "@/components/Toast";
import { getPublicSupabaseConfig } from "@/lib/supabase/public-config";
import "./globals.css";

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SynapseCRO — Landing pages that convert for local business",
  description:
    "Help local businesses get more leads with a landing page that learns from visitor behavior. See visits, clicks, and updates in plain English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseConfig = getPublicSupabaseConfig();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider supabaseConfig={supabaseConfig}>
          <ToastProvider>
            <SiteNav />
            {children}
            <SiteFooter />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
