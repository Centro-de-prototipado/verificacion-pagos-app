import { CheckCircle2Icon, CircleIcon } from "lucide-react"

interface DocCheckItemProps {
  label: string
  done: boolean
}

export function DocCheckItem({ label, done }: DocCheckItemProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2Icon className="size-3.5 shrink-0 text-green-500 dark:text-green-400" />
      ) : (
        <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/40" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  )
}
