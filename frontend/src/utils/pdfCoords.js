/**
 * Scale a backend bbox (in original PDF pts) to rendered <img> pixel coords.
 *
 * @param {Object} bbox - { x1, y1, x2, y2 } in PDF pts
 * @param {number} originalWidth - PDF page width in pts (from backend)
 * @param {number} originalHeight - PDF page height in pts (from backend)
 * @param {number} renderedWidth - Displayed <img> width in px
 * @param {number} renderedHeight - Displayed <img> height in px
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function scaleCoords(bbox, originalWidth, originalHeight, renderedWidth, renderedHeight) {
  const scaleX = renderedWidth / originalWidth
  const scaleY = renderedHeight / originalHeight
  const x1 = Math.max(0, Math.min(bbox.x1, originalWidth))
  const x2 = Math.max(0, Math.min(bbox.x2, originalWidth))
  const y1 = Math.max(0, Math.min(bbox.y1, originalHeight))
  const y2 = Math.max(0, Math.min(bbox.y2, originalHeight))

  return {
    left: x1 * scaleX,
    top: y1 * scaleY,
    width: Math.max(0, (x2 - x1) * scaleX),
    height: Math.max(0, (y2 - y1) * scaleY),
  }
}
