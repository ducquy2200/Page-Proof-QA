import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useAppStore } from '../../store/useAppStore'

export default function EvidenceItem({ evidence, color, highlightId, onClick }) {
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)
  const hoveredHighlightId = useAppStore((s) => s.hoveredHighlightId)
  const setHoveredHighlightId = useAppStore((s) => s.setHoveredHighlightId)
  const clearHoveredHighlightId = useAppStore((s) => s.clearHoveredHighlightId)

  const borderColor = color?.border ?? c.accent
  const bgColor = color?.bg ?? c.accentBg
  const syncedHover = Boolean(highlightId && hoveredHighlightId === highlightId)
  const active = hovered || syncedHover

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true)
        if (highlightId) setHoveredHighlightId(highlightId)
      }}
      onMouseLeave={() => {
        setHovered(false)
        clearHoveredHighlightId()
      }}
      className="w-full text-left p-3 rounded-xl focus:outline-none cursor-pointer transition-all"
      style={{
        backgroundColor: active ? c.accentBg : bgColor,
        border: `1px solid ${borderColor}`,
        opacity: active ? 1 : 0.85,
        transform: active ? 'translateX(3px)' : 'translateX(0)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs uppercase tracking-[0.15em] font-medium" style={{ color: borderColor }}>
          Page {evidence.page}
        </span>
        <span className="text-xs" style={{ color: active ? c.accent : c.textMuted }}>
          Jump
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: c.textSecondary }}>
        {evidence.text}
      </p>
    </button>
  )
}
