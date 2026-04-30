import "./globals.css"
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
      lang="es"
      className={cn("antialiased", ancizarFont.variable, "font-sans")}
    >
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
