import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import Button from '../ui/Button'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

export default function PDFControls() {
  const currentPage = useAppStore((s) => s.currentPage)
  const totalPages = useAppStore((s) => s.totalPages)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const pdfZoom = useAppStore((s) => s.pdfZoom)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)
  const resetPdfZoom = useAppStore((s) => s.resetPdfZoom)
  const reset = useAppStore((s) => s.reset)
  const { t } = useTheme()

  const prev = () => setCurrentPage(Math.max(1, currentPage - 1))
  const next = () => setCurrentPage(Math.min(totalPages ?? 1, currentPage + 1))

  return (
    <div
      className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2"
      style={{
        borderBottom: `1px solid ${t('#2e2a24', '#ddd4b0')}`,
        backgroundColor: t('#1e1a16', '#fdfaf2'),
      }}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <Button variant="ghost" size="sm" onClick={prev} disabled={currentPage <= 1} title="Previous page">
          <ChevronLeft size={15} />
        </Button>
        <span
          className="text-xs sm:text-sm tabular-nums tracking-widest whitespace-nowrap"
          style={{ color: t('#7a6a50', '#8a7a5a') }}
        >
          {currentPage} / {totalPages ?? '?'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={next}
          disabled={currentPage >= (totalPages ?? 1)}
          title="Next page"
        >
          <ChevronRight size={15} />
        </Button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={zoomOut}
          disabled={pdfZoom <= MIN_ZOOM}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={resetPdfZoom} title="Reset zoom">
          <span className="text-xs tabular-nums tracking-widest">{Math.round(pdfZoom * 100)}%</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={zoomIn}
          disabled={pdfZoom >= MAX_ZOOM}
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={reset} title="Upload new document">
        <RotateCcw size={13} />
        <span className="ml-1 hidden sm:inline text-xs tracking-widest">New doc</span>
      </Button>
    </div>
  )
}
