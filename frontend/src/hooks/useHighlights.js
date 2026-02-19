import { useAppStore } from '../store/useAppStore'

/**
 * Returns highlights that belong to a specific page.
 */
export function useHighlightsForPage(page) {
  const highlights = useAppStore((s) => s.highlights)
  return highlights.filter((h) => h.page === page)
}
