import { useCallback, useRef } from 'react'
import { uploadDocument, getDocumentStatus } from '../services/api'
import { useAppStore } from '../store/useAppStore'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 90 // 3 minutes max

export function useDocumentUpload() {
  const {
    setDocument,
    setDocumentStatus,
    setUploadProgress,
    resetUploadProgress,
    showToast,
  } = useAppStore()
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
        resetUploadProgress()
        setDocumentStatus('error')
        showToast('Document processing timed out.', 'error')
        return
      }

      try {
        const result = await getDocumentStatus(documentId)
        if (result.status === 'ready') {
          stopPolling()
          resetUploadProgress()
          setDocument(documentId, result.total_pages, result.page_width, result.page_height)
          setDocumentStatus('ready')
          showToast('Document ready!', 'success')
        } else if (result.status === 'error') {
          stopPolling()
          resetUploadProgress()
          setDocumentStatus('error')
          showToast('Document processing failed.', 'error')
        }
        // still 'processing' - keep polling
      } catch {
        stopPolling()
        resetUploadProgress()
        setDocumentStatus('error')
        showToast('Lost connection to server.', 'error')
      }
    }, POLL_INTERVAL_MS)
  }, [setDocument, setDocumentStatus, resetUploadProgress, showToast])

  const upload = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) {
      setDocumentStatus('idle')
      resetUploadProgress()
      showToast('Please upload a PDF file.', 'error')
      return
    }

    try {
      stopPolling()
      setDocumentStatus('uploading')
      setUploadProgress(0)
      const { document_id } = await uploadDocument(file, setUploadProgress)
      setUploadProgress(100)
      setDocumentStatus('processing')
      startPolling(document_id)
    } catch {
      stopPolling()
      resetUploadProgress()
      setDocumentStatus('idle')
      showToast('Upload failed. Is the backend running?', 'error')
    }
  }, [setDocumentStatus, setUploadProgress, resetUploadProgress, showToast, startPolling])

  return { upload }
}
