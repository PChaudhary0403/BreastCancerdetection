import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import ChatWidgetWrapper from "@/components/ChatWidgetWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Breast Cancer Screening Support | Clinician-in-the-Loop Platform",
  description: "A research and support tool for breast cancer screening. All findings are reviewed by certified medical professionals. This is not a diagnostic tool.",
  keywords: ["breast cancer", "mammography", "screening", "medical imaging"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 antialiased">
        <Providers>
          {children}
          <ChatWidgetWrapper />
        </Providers>
      </body>
    </html>
  );
}

