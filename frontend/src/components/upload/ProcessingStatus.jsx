import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import Spinner from '../ui/Spinner'

const MESSAGES = {
  uploading:  'Uploading document…',
  processing: 'Processing — extracting text and building index…',
}

export default function ProcessingStatus() {
  const status = useAppStore((s) => s.documentStatus)
  const { t } = useTheme()

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
          This may take a moment for large documents.
        </p>
      </div>
      <div
        className="w-48 h-px overflow-hidden"
        style={{ backgroundColor: t('#2e2a24', '#ddd4b0') }}
      >
        <div
          className="h-full animate-pulse w-2/3"
          style={{ backgroundColor: '#ad974f' }}
        />
      </div>
    </div>
  )
}
