import { useEffect, useState, useRef } from 'react'
import { usePageImage } from '../../hooks/usePageImage'
import { useHighlightsForPage } from '../../hooks/useHighlights'
import PDFHighlighter from './PDFHighlighter'
import Spinner from '../ui/Spinner'
import { useAppStore } from '../../store/useAppStore'

export default function PDFPage({ page }) {
  const { src } = usePageImage(page)
  const highlights = useHighlightsForPage(page)
  const pageWidth = useAppStore((s) => s.pageWidth)
  const pageHeight = useAppStore((s) => s.pageHeight)
  const pdfZoom = useAppStore((s) => s.pdfZoom)

  const [baseSize, setBaseSize] = useState({ width: 0, height: 0 })
  const [loadedSrc, setLoadedSrc] = useState(null)
  const imgRef = useRef(null)
  const loaded = Boolean(src && loadedSrc === src)

  const updateBaseSize = () => {
    if (!imgRef.current) return
    setBaseSize({
      width: imgRef.current.offsetWidth,
      height: imgRef.current.offsetHeight,
    })
  }

  const handleLoad = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setBaseSize({ width: rect.width, height: rect.height })
    }
    setLoadedSrc(src)
    requestAnimationFrame(updateBaseSize)
  }

  useEffect(() => {
    if (!loaded || !imgRef.current) return undefined

    updateBaseSize()

    const element = imgRef.current
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateBaseSize)
      : null

    if (observer) {
      observer.observe(element)
    }
    window.addEventListener('resize', updateBaseSize)

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateBaseSize)
    }
  }, [loaded, src])

  const hasBaseSize = baseSize.width > 0 && baseSize.height > 0
  const scaledWidth = loaded && hasBaseSize ? baseSize.width * pdfZoom : undefined
  const scaledHeight = loaded && hasBaseSize ? baseSize.height * pdfZoom : undefined

  return (
    <div
      className={`relative ${loaded ? 'shadow-2xl bg-white' : ''}`}
      style={{
        display: 'inline-block',
        width: scaledWidth ? `${scaledWidth}px` : undefined,
        height: scaledHeight ? `${scaledHeight}px` : undefined,
      }}
    >
      {!loaded && <Spinner />}

      <div
        style={{
          transform: loaded && hasBaseSize ? `scale(${pdfZoom})` : undefined,
          transformOrigin: 'top left',
          visibility: loaded ? 'visible' : 'hidden',
          width: loaded && hasBaseSize ? `${baseSize.width}px` : undefined,
          height: loaded && hasBaseSize ? `${baseSize.height}px` : undefined,
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={`Page ${page}`}
          onLoad={handleLoad}
          className="block w-auto max-h-[calc(100dvh-220px)] md:max-h-[calc(100vh-120px)]"
        />

        {loaded && highlights.length > 0 && (
          <PDFHighlighter
            highlights={highlights}
            originalWidth={pageWidth}
            originalHeight={pageHeight}
            renderedWidth={baseSize.width}
            renderedHeight={baseSize.height}
          />
        )}
      </div>
    </div>
  )
}
