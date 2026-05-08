import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"
import { Analytics } from "@vercel/analytics/next"
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
        <Analytics />
        <footer className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
          <span>Desarrollado por</span>
          <Logo className="h-10" />
        </footer>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
