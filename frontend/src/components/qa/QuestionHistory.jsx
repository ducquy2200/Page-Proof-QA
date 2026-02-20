import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import AnswerPanel from './AnswerPanel'

export default function QuestionHistory({ entries, onEvidenceJump }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { c } = useTheme()

  if (!entries?.length) return null

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] focus:outline-none cursor-pointer transition-all px-2 py-1 rounded-lg"
        style={{
          color: hovered ? c.accentHover : c.textMuted,
          backgroundColor: hovered ? c.accentBg : 'transparent',
        }}
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'Show'} {entries.length} previous
      </button>

      {open && (
        <div className="space-y-3 opacity-50">
          {entries.map((entry) => (
            <AnswerPanel key={entry.id} entry={entry} onEvidenceJump={onEvidenceJump} />
          ))}
        </div>
      )}
    </div>
  )
}
