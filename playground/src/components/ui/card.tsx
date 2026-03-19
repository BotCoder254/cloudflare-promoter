import type { HTMLAttributes } from "react"

import { cx } from "../../lib/cx"

type CardProps = HTMLAttributes<HTMLDivElement>

export const Card = ({ className, ...props }: CardProps) => {
  return (
    <div
      className={cx(
        "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  )
}
