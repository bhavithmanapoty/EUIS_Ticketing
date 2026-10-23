import type { Metadata, Viewport } from "next";
import { Cinzel, Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Serif display face for headings, echoing the seal's engraved capitals.
const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "EUIS Tickets",
    template: "%s · EUIS Tickets",
  },
  description: "Ticketing for Edinburgh University Indian Society events",
  applicationName: "EUIS Tickets",
  appleWebApp: {
    capable: true,
    title: "EUIS Tickets",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#121f57",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
