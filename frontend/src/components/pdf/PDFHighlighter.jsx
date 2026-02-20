import { scaleCoords } from '../../utils/pdfCoords'
import { useAppStore } from '../../store/useAppStore'

export default function PDFHighlighter({
  highlights,
  originalWidth,
  originalHeight,
  renderedWidth,
  renderedHeight,
}) {
  const hoveredHighlightId = useAppStore((s) => s.hoveredHighlightId)
  const setHoveredHighlightId = useAppStore((s) => s.setHoveredHighlightId)
  const clearHoveredHighlightId = useAppStore((s) => s.clearHoveredHighlightId)

  if (!renderedWidth || !renderedHeight) return null

  return (
    <div
      className="absolute"
      style={{
        left: 0,
        top: 0,
        width: `${renderedWidth}px`,
        height: `${renderedHeight}px`,
      }}
    >
      {highlights.map((h) => {
        const sourceWidth = h.pageWidth ?? originalWidth
        const sourceHeight = h.pageHeight ?? originalHeight
        if (!sourceWidth || !sourceHeight) return null

        const { left, top, width, height } = scaleCoords(
          h.bbox,
          sourceWidth,
          sourceHeight,
          renderedWidth,
          renderedHeight
        )
        const hasHovered = hoveredHighlightId !== null
        const isHovered = hoveredHighlightId === h.id
        const opacity = hasHovered ? (isHovered ? 1 : 0.22) : 0.72

        return (
          <div
            key={h.id}
            title={h.text}
            onMouseEnter={() => setHoveredHighlightId(h.id)}
            onMouseLeave={() => clearHoveredHighlightId()}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              backgroundColor: h.bg,
              border: `${isHovered ? 3 : 2}px solid ${h.border}`,
              borderRadius: '2px',
              boxShadow: isHovered ? `0 0 0 2px ${h.border}55` : 'none',
              opacity,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
          />
        )
      })}
    </div>
  )
}
