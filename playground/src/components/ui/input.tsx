import type { InputHTMLAttributes } from "react"

import { cx } from "../../lib/cx"

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={cx(
        "w-full min-h-12 rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-900",
        "placeholder:text-neutral-400 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20",
        className,
      )}
      {...props}
    />
  )
}
