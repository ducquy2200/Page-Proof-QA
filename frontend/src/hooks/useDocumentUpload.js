import { useCallback, useRef } from 'react'
import { uploadDocument, getDocumentStatus } from '../services/api'
import { useAppStore } from '../store/useAppStore'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 90  // 3 minutes max

export function useDocumentUpload() {
  const { setDocument, setDocumentStatus, showToast } = useAppStore()
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPolling = useCallback((documentId) => {
    let polls = 0
    pollRef.current = setInterval(async () => {
      polls++
      if (polls > MAX_POLLS) {
        stopPolling()
        setDocumentStatus('error')
        showToast('Document processing timed out.', 'error')
        return
      }

      try {
        const result = await getDocumentStatus(documentId)
        if (result.status === 'ready') {
          stopPolling()
          setDocument(documentId, result.total_pages, result.page_width, result.page_height)
          setDocumentStatus('ready')
          showToast('Document ready!', 'success')
        } else if (result.status === 'error') {
          stopPolling()
          setDocumentStatus('error')
          showToast('Document processing failed.', 'error')
        }
        // still 'processing' — keep polling
      } catch {
        stopPolling()
        setDocumentStatus('error')
        showToast('Lost connection to server.', 'error')
      }
    }, POLL_INTERVAL_MS)
  }, [setDocument, setDocumentStatus, showToast])

  const upload = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) {
      showToast('Please upload a PDF file.', 'error')
      return
    }

    try {
      setDocumentStatus('uploading')
      const { document_id } = await uploadDocument(file)
      setDocumentStatus('processing')
      startPolling(document_id)
    } catch {
      setDocumentStatus('error')
      showToast('Upload failed. Is the backend running?', 'error')
    }
  }, [setDocumentStatus, showToast, startPolling])

  return { upload }
}
