import { useAppStore } from '../store/useAppStore'
import { theme } from '../theme.config'

/**
 * Returns:
 *  - `c`      — the full active color palette (dark or light)
 *  - `t(darkVal, lightVal)` — pick a raw value by theme (for one-offs)
 *  - `isDark` — boolean
 *
 * Every color in the app comes from theme.config.js via `c`.
 * To retheme the entire app, only edit theme.config.js.
 */
export function useTheme() {
  const mode = useAppStore((s) => s.theme)
  const isDark = mode === 'dark'
  const c = isDark ? theme.dark : theme.light

  function t(darkVal, lightVal) {
    return isDark ? darkVal : lightVal
  }

  return { c, t, isDark, mode }
}
