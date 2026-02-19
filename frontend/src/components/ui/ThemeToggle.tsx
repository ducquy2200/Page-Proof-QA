import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'

export default function ThemeToggle() {
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const { c, isDark } = useTheme()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={toggleTheme}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Toggle theme"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer text-xs font-medium transition-all focus:outline-none"
      style={{
        backgroundColor: hovered ? c.accentBg : c.bgElevated,
        color: hovered ? c.accentHover : c.accent,
        border: `1px solid ${hovered ? c.accent : c.accentBorder}`,
        letterSpacing: '0.12em',
      }}
    >
      {isDark ? <Moon size={11} /> : <Sun size={11} />}
      {isDark ? 'Dark' : 'Light'}
    </button>
  )
}
