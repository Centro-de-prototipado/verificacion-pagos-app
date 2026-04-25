import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

import localFont from "next/font/local"

const ancizarFont = localFont({
  src: [
    {
      path: "../fonts/AncizarSans-VariableFont_wght.ttf",
      style: "normal",
      weight: "400 900",
    },
  ],
  variable: "--font-sans",
  display: "swap",
})
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", ancizarFont.variable, "font-sans")}
    >
      <body>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
