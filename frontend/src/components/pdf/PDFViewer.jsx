import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import PDFPage from './PDFPage'
import PDFControls from './PDFControls'

export default function PDFViewer() {
  const currentPage = useAppStore((s) => s.currentPage)
  const totalPages = useAppStore((s) => s.totalPages)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)
  const { t } = useTheme()

  const handleWheel = (event) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    if (event.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: t('#181412', '#f0ead8') }}
    >
      <PDFControls />
      <div
        className="flex-1 overflow-auto flex justify-center items-start p-2 sm:p-4 md:p-6"
        onWheel={handleWheel}
      >
        <PDFPage page={currentPage} />
      </div>
      {totalPages && (
        <div
          className="text-center text-[11px] py-1.5 tracking-widest"
          style={{ color: t('#5a4e3a', '#a09070') }}
        >
          {currentPage} / {totalPages}
        </div>
      )}
    </div>
  )
}
