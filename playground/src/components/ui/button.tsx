import type { ButtonHTMLAttributes } from "react"

import { cx } from "../../lib/cx"

type ButtonTone = "primary" | "secondary" | "neutral" | "danger"

const toneClasses: Record<ButtonTone, string> = {
  primary: "bg-primary text-white hover:bg-[#e84a31] focus-visible:ring-primary",
  secondary: "bg-secondary text-white hover:bg-[#2f76df] focus-visible:ring-secondary",
  neutral: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus-visible:ring-neutral-300",
  danger: "bg-error text-white hover:bg-[#e03f3f] focus-visible:ring-error",
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone
}

export const Button = ({ tone = "primary", className, type = "button", ...props }: ButtonProps) => {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
