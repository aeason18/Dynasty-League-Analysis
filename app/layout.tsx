import type { Metadata } from "next";
import { Big_Shoulders, Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader } from "@/components/site-header";
import { SeasonProvider } from "@/components/season-context";

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Dynasty Archive",
    template: "%s · Dynasty Archive",
  },
  description: "Your league. Your history. Your analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${archivo.variable} ${martianMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider delay={150}>
          <SeasonProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </SeasonProvider>
          <footer className="border-t border-border/60 py-6">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
              <span>Dynasty Archive — built on real Sleeper data.</span>
              <span>Not affiliated with Sleeper.</span>
            </div>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
