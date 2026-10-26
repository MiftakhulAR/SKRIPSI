import "./globals.css";
import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import { Shell } from "@/components/Shell";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = { title: "CareerAI", description: "IT career recommendation for PNJ Informatics students" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-slate-50 font-sans text-slate-800">
        <I18nProvider><AuthProvider><Shell>{children}</Shell></AuthProvider></I18nProvider>
      </body>
    </html>
  );
}
