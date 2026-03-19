import type { HTMLAttributes } from "react"

import { cx } from "../../lib/cx"

type BadgeTone = "success" | "warning" | "error" | "info" | "neutral"

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
  neutral: "bg-neutral-100 text-neutral-600",
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export const Badge = ({ tone = "neutral", className, ...props }: BadgeProps) => {
  return (
    <span
      className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone], className)}
      {...props}
    />
  )
}
