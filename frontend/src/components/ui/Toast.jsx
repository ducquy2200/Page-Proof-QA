import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'

export default function Toast() {
  const toast = useAppStore((s) => s.toast)
  const { c } = useTheme()

  if (!toast) return null

  const s = c.toast[toast.type] ?? c.toast.info

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div
        className="px-4 py-3 rounded-xl text-sm shadow-2xl"
        style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
      >
        {toast.message}
      </div>
    </div>
  )
}