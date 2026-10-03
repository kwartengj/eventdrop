import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "EventDrop",
  description: "One event. Everyone's photos. One place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5EFE6" },
    { media: "(prefers-color-scheme: dark)", color: "#16120E" },
  ],
};

const themeBoot = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.theme="dark";}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        {children}
      </body>
    </html>
  );
}
