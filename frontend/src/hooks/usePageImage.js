import { getPageImageUrl } from '../services/api'
import { useAppStore } from '../store/useAppStore'

/**
 * Returns the image URL for a given page number.
 * Uses React Query via the parent component if caching is needed,
 * or can be used directly as a simple URL builder.
 */
export function usePageImage(page) {
  const documentId = useAppStore((s) => s.documentId)

  if (!documentId || !page) return { src: null }

  return { src: getPageImageUrl(documentId, page) }
}
