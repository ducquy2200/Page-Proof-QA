import EvidenceItem from './EvidenceItem'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'

export default function AnswerPanel({ entry, onEvidenceJump }) {
  const setHighlights = useAppStore((s) => s.setHighlights)
  const jumpToPage = useAppStore((s) => s.jumpToPage)
  const { c } = useTheme()

  if (!entry) return null

  const divider = { borderTop: `1px solid ${c.borderSubtle}`, paddingTop: '0.875rem' }

  return (
    <div
      className="p-4 space-y-3.5 rounded-2xl"
      style={{ border: `1px solid ${c.borderMid}`, backgroundColor: c.bgSurface }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.2em] mb-1.5" style={{ color: c.accent }}>
          Question
        </p>
        <p className="text-sm leading-relaxed" style={{ color: c.textSecondary }}>
          {entry.question}
        </p>
      </div>
      <div style={divider}>
        <p className="text-xs uppercase tracking-[0.2em] mb-1.5" style={{ color: c.accent }}>
          Answer
        </p>
        <p className="text-sm leading-relaxed" style={{ color: c.textPrimary }}>
          {entry.answer}
        </p>
      </div>
      {entry.evidence?.length > 0 && (
        <div style={divider} className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: c.accent }}>
            Evidence - {entry.evidence.length} {entry.evidence.length === 1 ? 'match' : 'matches'}
          </p>
          {entry.evidence.map((ev, i) => (
            <EvidenceItem
              key={i}
              evidence={ev}
              color={entry.highlights?.[i]}
              highlightId={entry.highlights?.[i]?.id ?? null}
              onClick={() => {
                setHighlights(entry.highlights)
                jumpToPage(ev.page)
                if (typeof onEvidenceJump === 'function') {
                  onEvidenceJump(ev.page)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
