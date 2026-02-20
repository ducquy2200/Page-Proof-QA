import { useState, useCallback } from 'react'
import { askQuestion } from '../services/api'
import { useAppStore } from '../store/useAppStore'
import { getHighlightColor } from '../utils/highlightColors'

export function useQA() {
  const [loading, setLoading] = useState(false)
  const { documentId, addQAEntry, setHighlights, jumpToPage, showToast } = useAppStore()

  const ask = useCallback(async (question) => {
    if (!question.trim() || !documentId) return

    setLoading(true)
    try {
      const result = await askQuestion(documentId, question)

      // Map evidence to highlight objects with color
      const highlights = result.evidence.map((ev, i) => ({
        id: `${Date.now()}-${i}`,
        page: ev.page,
        bbox: ev.bbox,
        text: ev.text,
        pageWidth: ev.page_width ?? null,
        pageHeight: ev.page_height ?? null,
        ...getHighlightColor(i),
      }))

      addQAEntry({
        id: Date.now(),
        question,
        answer: result.answer,
        evidence: result.evidence,
        highlights,
        timestamp: new Date().toISOString(),
      })

      setHighlights(highlights)

      // Jump to the first evidence page automatically
      if (highlights.length > 0) {
        jumpToPage(highlights[0].page)
      }
    } catch {
      showToast('Failed to get an answer. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }, [documentId, addQAEntry, setHighlights, jumpToPage, showToast])

  return { ask, loading }
}
