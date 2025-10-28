import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const ubuntu = localFont({
  src: [
    {
      path: '../public/fonts/Ubuntu/Ubuntu-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/Ubuntu/Ubuntu-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Ubuntu/Ubuntu-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Ubuntu/Ubuntu-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-ubuntu',
});

export const metadata: Metadata = {
  title: "Meeting Summarizer - AI-Powered Meeting Analysis",
  description: "Analyze and summarize your meeting transcripts with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${ubuntu.variable} font-ubuntu antialiased`}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          {children}
        </div>
      </body>
    </html>
  );
}
