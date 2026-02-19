import { clsx } from 'clsx'
import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'

const base = 'inline-flex items-center justify-center rounded-xl font-medium tracking-wide transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs gap-1',
  md: 'px-4 py-2.5 text-sm gap-2',
}

export default function Button({ children, variant = 'default', size = 'md', className, style, ...props }) {
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)

  const variantStyle =
    variant === 'default'
      ? {
          backgroundColor: hovered ? c.accentHover : c.accent,
          color: c.bgBase,
          border: 'none',
          transform: hovered ? 'scale(1.03)' : 'scale(1)',
        }
      : variant === 'ghost'
      ? {
          backgroundColor: hovered ? c.accentBg : 'transparent',
          color: hovered ? c.accentHover : c.accent,
          border: '1px solid transparent',
        }
      : {
          backgroundColor: hovered ? c.accentBg : 'transparent',
          color: hovered ? c.accentHover : c.accent,
          border: `1px solid ${hovered ? c.accent : c.accentBorder}`,
        }

  return (
    <button
      className={clsx(base, sizes[size], className)}
      style={{ ...variantStyle, ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  )
}
