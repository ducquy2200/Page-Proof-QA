import PDFViewer from '../components/pdf/PDFViewer'
import QuestionInput from '../components/qa/QuestionInput'
import AnswerPanel from '../components/qa/AnswerPanel'
import QuestionHistory from '../components/qa/QuestionHistory'
import { useAppStore } from '../store/useAppStore'
import { useTheme } from '../hooks/useTheme'

export default function MainLayout() {
  const qaHistory = useAppStore((s) => s.qaHistory)
  const { t } = useTheme()

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: PDF Viewer ─────────────────────────────── */}
      <div
        className="flex-[3] min-w-0 overflow-hidden"
        style={{ borderRight: `1px solid ${t('#2e2a24', '#ddd4b0')}` }}
      >
        <PDFViewer />
      </div>

      {/* ── Right: Q&A Panel ─────────────────────────────── */}
      <div
        className="flex-[2] min-w-0 flex flex-col overflow-hidden"
        style={{ backgroundColor: t('#1e1a16', '#fdfaf2') }}
      >
        <div
          className="p-4"
          style={{ borderBottom: `1px solid ${t('#2e2a24', '#ddd4b0')}` }}
        >
          <QuestionInput />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {qaHistory.length === 0 ? (
            <p
              className="text-sm text-center mt-12"
              style={{ color: t('#5a4e3a', '#a09070') }}
            >
              Ask a question about the document.
            </p>
          ) : (
            <>
              <AnswerPanel entry={qaHistory[0]} />
              {qaHistory.length > 1 && <QuestionHistory entries={qaHistory.slice(1)} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
