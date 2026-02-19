import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import PDFPage from './PDFPage'
import PDFControls from './PDFControls'

export default function PDFViewer() {
  const currentPage = useAppStore((s) => s.currentPage)
  const totalPages  = useAppStore((s) => s.totalPages)
  const { t } = useTheme()

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: t('#181412', '#f0ead8') }}
    >
      <PDFControls />
      <div className="flex-1 overflow-auto flex justify-center items-start p-6">
        <PDFPage page={currentPage} />
      </div>
      {totalPages && (
        <div
          className="text-center text-xs py-2 tracking-widest"
          style={{ color: t('#5a4e3a', '#a09070') }}
        >
          {currentPage} / {totalPages}
        </div>
      )}
    </div>
  )
}
