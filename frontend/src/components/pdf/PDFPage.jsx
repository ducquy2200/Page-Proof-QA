import { useEffect, useState, useRef } from 'react'
import { usePageImage } from '../../hooks/usePageImage'
import { useHighlightsForPage } from '../../hooks/useHighlights'
import PDFHighlighter from './PDFHighlighter'
import Spinner from '../ui/Spinner'
import { useAppStore } from '../../store/useAppStore'

export default function PDFPage({ page }) {
  const { src } = usePageImage(page)
  const highlights = useHighlightsForPage(page)
  const pageWidth  = useAppStore((s) => s.pageWidth)
  const pageHeight = useAppStore((s) => s.pageHeight)

  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  const [loadedSrc, setLoadedSrc] = useState(null)
  const imgRef = useRef(null)
  const loaded = Boolean(src && loadedSrc === src)

  const updateImgSize = () => {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    setImgSize({
      width: rect.width,
      height: rect.height,
    })
  }

  const handleLoad = () => {
    updateImgSize()
    setLoadedSrc(src)
  }

  useEffect(() => {
    if (!loaded || !imgRef.current) return undefined

    updateImgSize()

    const element = imgRef.current
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateImgSize)
      : null

    if (observer) {
      observer.observe(element)
    }
    window.addEventListener('resize', updateImgSize)

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateImgSize)
    }
  }, [loaded, src])

  return (
    <div
      className={`relative ${loaded ? 'shadow-2xl bg-white' : ''}`}
      style={{ display: 'inline-block' }}
    >
      {!loaded && <Spinner />}

      <img
        ref={imgRef}
        src={src}
        alt={`Page ${page}`}
        onLoad={handleLoad}
        className="block max-w-full"
        style={{ maxHeight: 'calc(100vh - 120px)', visibility: loaded ? 'visible' : 'hidden', width: loaded ? undefined : 0, height: loaded ? undefined : 0 }}
      />

      {loaded && highlights.length > 0 && (
        <PDFHighlighter
          highlights={highlights}
          originalWidth={pageWidth}
          originalHeight={pageHeight}
          renderedWidth={imgSize.width}
          renderedHeight={imgSize.height}
        />
      )}
    </div>
  )
}
