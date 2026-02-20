import { useEffect, useRef, useState } from 'react'
import PDFViewer from '../components/pdf/PDFViewer'
import QuestionInput from '../components/qa/QuestionInput'
import AnswerPanel from '../components/qa/AnswerPanel'
import QuestionHistory from '../components/qa/QuestionHistory'
import { useAppStore } from '../store/useAppStore'
import { useTheme } from '../hooks/useTheme'

const SPLIT_STORAGE_KEY = 'pageproof-layout-split-ratio'
const DEFAULT_SPLIT_RATIO = 0.62
const MIN_SPLIT_RATIO = 0.35
const MAX_SPLIT_RATIO = 0.8

function clampSplitRatio(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_SPLIT_RATIO
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, numeric))
}

function readInitialSplitRatio() {
  if (typeof window === 'undefined') return DEFAULT_SPLIT_RATIO
  const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY)
  if (!raw) return DEFAULT_SPLIT_RATIO
  return clampSplitRatio(raw)
}

export default function MainLayout() {
  const qaHistory = useAppStore((s) => s.qaHistory)
  const { t } = useTheme()

  const [mobilePane, setMobilePane] = useState('pdf')
  const [splitRatio, setSplitRatio] = useState(readInitialSplitRatio)
  const [isResizing, setIsResizing] = useState(false)
  const desktopContainerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitRatio))
  }, [splitRatio])

  useEffect(() => {
    if (!isResizing) return undefined

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (event) => {
      const container = desktopContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const nextRatio = (event.clientX - rect.left) / rect.width
      setSplitRatio(clampSplitRatio(nextRatio))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing])

  const startResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setIsResizing(true)
  }

  const showPdfOnMobile = mobilePane === 'pdf'
  const showQaOnMobile = mobilePane === 'qa'
  const onEvidenceJump = () => setMobilePane('pdf')

  const renderQAPane = (evidenceJumpHandler) => (
    <div
      className="flex h-full flex-col min-w-0 min-h-0 overflow-hidden"
      style={{ backgroundColor: t('#1e1a16', '#fdfaf2') }}
    >
      <div
        className="p-3 md:p-4"
        style={{ borderBottom: `1px solid ${t('#2e2a24', '#ddd4b0')}` }}
      >
        <QuestionInput />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-4">
        {qaHistory.length === 0 ? (
          <p
            className="text-sm text-center mt-12"
            style={{ color: t('#5a4e3a', '#a09070') }}
          >
            Ask a question about the document.
          </p>
        ) : (
          <>
            <AnswerPanel entry={qaHistory[0]} onEvidenceJump={evidenceJumpHandler} />
            {qaHistory.length > 1 && (
              <QuestionHistory
                entries={qaHistory.slice(1)}
                onEvidenceJump={evidenceJumpHandler}
              />
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="md:hidden px-3 py-2" style={{ borderBottom: `1px solid ${t('#2e2a24', '#ddd4b0')}`, backgroundColor: t('#1e1a16', '#fdfaf2') }}>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMobilePane('pdf')}
            className="rounded-lg px-3 py-2 text-xs uppercase tracking-[0.18em] transition-all"
            style={{
              border: `1px solid ${showPdfOnMobile ? t('#ad974f', '#ad974f') : t('#3a352d', '#d8cfb0')}`,
              backgroundColor: showPdfOnMobile ? t('#28231d', '#f2e6c8') : 'transparent',
              color: showPdfOnMobile ? t('#e8d7a8', '#6e5c2b') : t('#9b8b70', '#8b7b60'),
            }}
          >
            Document
          </button>
          <button
            onClick={() => setMobilePane('qa')}
            className="rounded-lg px-3 py-2 text-xs uppercase tracking-[0.18em] transition-all"
            style={{
              border: `1px solid ${showQaOnMobile ? t('#ad974f', '#ad974f') : t('#3a352d', '#d8cfb0')}`,
              backgroundColor: showQaOnMobile ? t('#28231d', '#f2e6c8') : 'transparent',
              color: showQaOnMobile ? t('#e8d7a8', '#6e5c2b') : t('#9b8b70', '#8b7b60'),
            }}
          >
            Q&A
          </button>
        </div>
      </div>

      <div className="md:hidden flex-1 min-h-0 overflow-hidden">
        {showPdfOnMobile ? (
          <div className="h-full min-h-0">
            <PDFViewer />
          </div>
        ) : (
          <div className="h-full min-h-0">
            {renderQAPane(onEvidenceJump)}
          </div>
        )}
      </div>

      <div ref={desktopContainerRef} className="hidden md:flex md:flex-1 md:min-h-0 md:overflow-hidden">
        <div
          className="min-w-0 min-h-0 overflow-hidden"
          style={{ flex: `0 0 ${(splitRatio * 100).toFixed(2)}%` }}
        >
          <PDFViewer />
        </div>

        <button
          type="button"
          aria-label="Resize panels"
          onMouseDown={startResize}
          className="w-2 shrink-0 cursor-col-resize flex items-center justify-center transition-colors"
          style={{ backgroundColor: isResizing ? t('#2a251f', '#e4d9ba') : t('#201c17', '#efe7cf') }}
        >
          <span
            className="h-16 w-px"
            style={{ backgroundColor: t('#8b7a55', '#bca76d') }}
          />
        </button>

        <div className="min-w-0 min-h-0 overflow-hidden flex-1">
          <div className="h-full min-h-0">
            {renderQAPane()}
          </div>
        </div>
      </div>
    </div>
  )
}
