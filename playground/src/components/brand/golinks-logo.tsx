import { Orbit } from "lucide-react"

import { cx } from "../../lib/cx"

type GoLinksLogoProps = {
  size?: "sm" | "md" | "lg" | "xl"
  inverted?: boolean
  iconOnly?: boolean
  className?: string
}

const iconSize = {
  sm: 24,
  md: 34,
  lg: 46,
  xl: 56,
}

const textSize = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
}

export const GoLinksLogo = ({ size = "md", inverted = false, iconOnly = false, className }: GoLinksLogoProps) => {
  const iconColor = inverted ? "text-white" : "text-primary"

  return (
    <div className={cx("inline-flex items-center", iconOnly ? "justify-center" : "gap-3", className)}>
      <Orbit size={iconSize[size]} strokeWidth={2.1} className={iconColor} />
      {!iconOnly ? (
        <span className={cx("font-poppins font-semibold tracking-tight", inverted ? "text-white" : "text-neutral-900", textSize[size])}>
          golinks
        </span>
      ) : null}
    </div>
  )
}
