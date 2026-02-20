import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
})

// ── Document ──────────────────────────────────────────────────────────────

/**
 * Upload a PDF file. Returns { document_id }
 */
export async function uploadDocument(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (typeof onProgress !== 'function') return
      if (!event?.total || event.total <= 0) return
      const percent = Math.round((event.loaded / event.total) * 100)
      onProgress(Math.max(0, Math.min(100, percent)))
    },
  })
  return data
}

/**
 * Poll document status.
 * Returns { status: 'processing'|'ready'|'error', total_pages, page_width, page_height }
 */
export async function getDocumentStatus(documentId) {
  const { data } = await client.get(`/documents/${documentId}/status`)
  return data
}

// ── Pages ─────────────────────────────────────────────────────────────────

/**
 * Returns a URL string for the page image — used directly as <img src>.
 * Backend renders the page as PNG and returns it.
 */
export function getPageImageUrl(documentId, page) {
  return `${BASE_URL}/documents/${documentId}/pages/${page}`
}

// ── Q&A ───────────────────────────────────────────────────────────────────

/**
 * Ask a question about a document.
 * Returns:
 * {
 *   answer: string,
 *   evidence: [
 *     { page: number, text: string, bbox: { x1, y1, x2, y2 } }
 *   ]
 * }
 */
export async function askQuestion(documentId, question) {
  const { data } = await client.post(`/documents/${documentId}/ask`, { question })
  return data
}
