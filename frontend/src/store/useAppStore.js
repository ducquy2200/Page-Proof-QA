import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MIN_PDF_ZOOM = 0.5
const MAX_PDF_ZOOM = 3
const PDF_ZOOM_STEP = 0.25

function clampPdfZoom(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, numeric))
}

export const useAppStore = create(
  persist(
    (set) => ({
  // Document
  documentId: null,
  documentStatus: 'idle',
  totalPages: null,
  pageWidth: null,
  pageHeight: null,
  uploadProgress: 0,

  // Navigation
  currentPage: 1,
  pdfZoom: 1,

  // Highlights
  highlights: [],
  activeHighlightPage: null,
  hoveredHighlightId: null,

  // Q&A history
  qaHistory: [],

  // Toast
  toast: null,

  // Theme
  theme: 'light',

  // ── Actions ──────────────────────────────────────────────────────────────

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  setDocument: (id, totalPages, pageWidth, pageHeight) =>
    set({ documentId: id, totalPages, pageWidth, pageHeight }),

  setDocumentStatus: (status) => set({ documentStatus: status }),
  setUploadProgress: (value) =>
    set({
      uploadProgress: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)),
    }),
  resetUploadProgress: () => set({ uploadProgress: 0 }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPdfZoom: (value) => set({ pdfZoom: clampPdfZoom(value) }),
  zoomIn: () => set((state) => ({ pdfZoom: clampPdfZoom(state.pdfZoom + PDF_ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ pdfZoom: clampPdfZoom(state.pdfZoom - PDF_ZOOM_STEP) })),
  resetPdfZoom: () => set({ pdfZoom: 1 }),

  setHighlights: (highlights) => set({ highlights, hoveredHighlightId: null }),

  clearHighlights: () => set({ highlights: [], activeHighlightPage: null, hoveredHighlightId: null }),

  setHoveredHighlightId: (id) => set({ hoveredHighlightId: id }),

  clearHoveredHighlightId: () => set({ hoveredHighlightId: null }),

  jumpToPage: (page) => set({ currentPage: page, activeHighlightPage: page }),

  addQAEntry: (entry) =>
    set((state) => ({
      qaHistory: [entry, ...state.qaHistory],
    })),

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },

  reset: () =>
    set((state) => ({
      documentId: null,
      documentStatus: 'idle',
      totalPages: null,
      pageWidth: null,
      pageHeight: null,
      uploadProgress: 0,
      currentPage: 1,
      pdfZoom: 1,
      highlights: [],
      activeHighlightPage: null,
      hoveredHighlightId: null,
      qaHistory: [],
      toast: null,
      theme: state.theme,   // preserve theme across resets
    })),
    }),
    {
      name: 'pageproof-settings',
      partialize: (state) => ({ theme: state.theme }), // only persist theme
    }
  )
)
