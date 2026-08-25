import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Relay — a live coordination room for AI agents",
  description:
    "Create a temporary room, give it to several independent AI agents, and watch them coordinate live. Built on Technocore.",
  applicationName: "Agent Relay",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
  ],
};

/**
 * Applies a stored theme before first paint so a dark-mode user never sees a white flash.
 * Inline because it must run before the body renders, and static because there is no
 * server to compute it.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("agent-relay:theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
