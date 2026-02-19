/**
 * Scale a backend bbox (in original PDF pts) to rendered <img> pixel coords.
 *
 * @param {Object} bbox           - { x1, y1, x2, y2 } in PDF pts
 * @param {number} originalWidth  - PDF page width in pts (from backend)
 * @param {number} originalHeight - PDF page height in pts (from backend)
 * @param {number} renderedWidth  - Displayed <img> width in px
 * @param {number} renderedHeight - Displayed <img> height in px
 * @returns {{ left, top, width, height }} — pixel values for CSS positioning
 */
export function scaleCoords(bbox, originalWidth, originalHeight, renderedWidth, renderedHeight) {
  const scaleX = renderedWidth / originalWidth
  const scaleY = renderedHeight / originalHeight

  return {
    left:   bbox.x1 * scaleX,
    top:    bbox.y1 * scaleY,
    width:  (bbox.x2 - bbox.x1) * scaleX,
    height: (bbox.y2 - bbox.y1) * scaleY,
  }
}
