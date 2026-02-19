import MainLayout from './layouts/MainLayout'
import { useAppStore } from './store/useAppStore'
import { useTheme } from './hooks/useTheme'
import UploadZone from './components/upload/UploadZone'
import ProcessingStatus from './components/upload/ProcessingStatus'
import Toast from './components/ui/Toast'
import ThemeToggle from './components/ui/ThemeToggle'

export default function App() {
  const documentStatus = useAppStore((s) => s.documentStatus)
  const { c, mode } = useTheme()

  return (
    <div
      data-theme={mode}
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: c.bgBase, color: c.textPrimary }}
    >
      <header
        className="h-12 flex items-center justify-between px-6 shrink-0"
        style={{ borderBottom: `1px solid ${c.borderSubtle}`, backgroundColor: c.bgSurface }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="logo" className="w-6 h-6" />
          <span
            className="font-semibold text-xs uppercase"
            style={{ color: c.accent, letterSpacing: '0.2em' }}
          >
            PageProof QA
          </span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 overflow-hidden">
        {documentStatus === 'idle'       && <UploadZone />}
        {(documentStatus === 'uploading' || documentStatus === 'processing') && <ProcessingStatus />}
        {(documentStatus === 'ready'     || documentStatus === 'error')      && <MainLayout />}
      </div>

      <Toast />
    </div>
  )
}
