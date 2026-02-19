import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import Button from '../ui/Button'

export default function PDFControls() {
  const currentPage    = useAppStore((s) => s.currentPage)
  const totalPages     = useAppStore((s) => s.totalPages)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const reset          = useAppStore((s) => s.reset)
  const { t } = useTheme()

  const prev = () => setCurrentPage(Math.max(1, currentPage - 1))
  const next = () => setCurrentPage(Math.min(totalPages ?? 1, currentPage + 1))

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        borderBottom: `1px solid ${t('#2e2a24', '#ddd4b0')}`,
        backgroundColor: t('#1e1a16', '#fdfaf2'),
      }}
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={prev} disabled={currentPage <= 1}>
          <ChevronLeft size={15} />
        </Button>
        <span
          className="text-sm tabular-nums tracking-widest"
          style={{ color: t('#7a6a50', '#8a7a5a') }}
        >
          {currentPage} / {totalPages ?? '?'}
        </span>
        <Button variant="ghost" size="sm" onClick={next} disabled={currentPage >= (totalPages ?? 1)}>
          <ChevronRight size={15} />
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={reset} title="Upload new document">
        <RotateCcw size={13} />
        <span className="ml-1 text-xs tracking-widest">New doc</span>
      </Button>
    </div>
  )
}
