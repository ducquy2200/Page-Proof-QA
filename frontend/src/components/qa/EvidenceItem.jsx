import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'

export default function EvidenceItem({ evidence, color, onClick }) {
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)

  const borderColor = color?.border ?? c.accent
  const bgColor     = color?.bg     ?? c.accentBg

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left p-3 rounded-xl focus:outline-none cursor-pointer transition-all"
      style={{
        backgroundColor: hovered ? c.accentBg : bgColor,
        border: `1px solid ${hovered ? borderColor : borderColor}`,
        opacity: hovered ? 1 : 0.85,
        transform: hovered ? 'translateX(3px)' : 'translateX(0)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs uppercase tracking-[0.15em] font-medium" style={{ color: borderColor }}>
          Page {evidence.page}
        </span>
        <span className="text-xs" style={{ color: hovered ? c.accent : c.textMuted }}>↗ Jump</span>
      </div>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: c.textSecondary }}>
        {evidence.text}
      </p>
    </button>
  )
}
