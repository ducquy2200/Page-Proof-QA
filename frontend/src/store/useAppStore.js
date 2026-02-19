import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set, get) => ({
  // Document
  documentId: null,
  documentStatus: 'idle',
  totalPages: null,
  pageWidth: null,
  pageHeight: null,

  // Navigation
  currentPage: 1,

  // Highlights
  highlights: [],
  activeHighlightPage: null,

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

  setCurrentPage: (page) => set({ currentPage: page }),

  setHighlights: (highlights) => set({ highlights }),

  clearHighlights: () => set({ highlights: [], activeHighlightPage: null }),

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
      currentPage: 1,
      highlights: [],
      activeHighlightPage: null,
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
