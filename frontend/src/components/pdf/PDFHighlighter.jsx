import { scaleCoords } from '../../utils/pdfCoords'

export default function PDFHighlighter({
  highlights,
  originalWidth,
  originalHeight,
  renderedWidth,
  renderedHeight,
}) {
  if (!originalWidth || !originalHeight || !renderedWidth || !renderedHeight) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map((h) => {
        const { left, top, width, height } = scaleCoords(
          h.bbox,
          originalWidth,
          originalHeight,
          renderedWidth,
          renderedHeight
        )

        return (
          <div
            key={h.id}
            title={h.text}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              backgroundColor: h.bg,
              border: `2px solid ${h.border}`,
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
        )
      })}
    </div>
  )
}
