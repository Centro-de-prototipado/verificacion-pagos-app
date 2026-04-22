import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  number: number
  title: string
  subtitle?: string
  done?: boolean
}

export function SectionHeader({
  number,
  title,
  subtitle,
  done,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
          done
            ? "bg-green-500 text-white dark:bg-green-400"
            : "bg-primary/10 text-primary"
        )}
      >
        {done ? <CheckIcon className="size-3.5" /> : number}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
