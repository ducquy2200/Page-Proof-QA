import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import Spinner from '../ui/Spinner'

const MESSAGES = {
  uploading: 'Uploading document...',
  processing: 'Processing - extracting text and building index...',
}

export default function ProcessingStatus() {
  const status = useAppStore((s) => s.documentStatus)
  const uploadProgress = useAppStore((s) => s.uploadProgress)
  const { t } = useTheme()

  const isUploading = status === 'uploading'
  const clampedProgress = Math.max(0, Math.min(100, Number(uploadProgress) || 0))

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-6 text-center p-8"
      style={{ backgroundColor: t('#181412', '#f7f2e8') }}
    >
      <Spinner size="lg" />

      <div>
        <p
          className="font-medium tracking-widest text-sm uppercase"
          style={{ color: t('#d4c090', '#231f20') }}
        >
          {MESSAGES[status]}
        </p>
        <p
          className="text-xs mt-2 tracking-wide"
          style={{ color: t('#5a4e3a', '#a09070') }}
        >
          {isUploading
            ? `${clampedProgress}% uploaded`
            : 'Upload complete. Processing may take a moment for large documents.'}
        </p>
      </div>

      <div
        className="w-64 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: t('#2e2a24', '#ddd4b0') }}
      >
        {isUploading ? (
          <div
            className="h-full transition-[width] duration-200 ease-out"
            style={{ width: `${clampedProgress}%`, backgroundColor: '#ad974f' }}
          />
        ) : (
          <div
            className="h-full w-full animate-pulse"
            style={{ backgroundColor: '#ad974f' }}
          />
        )}
      </div>
    </div>
  )
}
