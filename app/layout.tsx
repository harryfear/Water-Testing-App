import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Deep Blue Strip Ease Pro - Pool Water Testing",
  description: "Analyze your pool water test strips instantly with AI-powered color detection",
  icons: {
    icon: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deep Blue Strip Ease Pro",
  },
  manifest: "./manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Deep Blue Strip Ease Pro" />
        <link rel="apple-touch-icon" href="./icon-192x192.png" />
        <link rel="manifest" href="./manifest.json" />
        <link rel="icon" href="/favicon.ico" />

        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
