import type { TextareaHTMLAttributes } from "react"

import { cx } from "../../lib/cx"

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = ({ className, ...props }: TextareaProps) => {
  return (
    <textarea
      className={cx(
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900",
        "placeholder:text-neutral-400 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20",
        className,
      )}
      {...props}
    />
  )
}
