/**
 * Gold-toned highlight palette for evidence matching.
 * Index 0 is primary (gold), others are for secondary evidence.
 */
const COLORS = [
  { border: '#ad974f', bg: 'rgba(173,151,79,0.28)' },
  { border: '#c8a84b', bg: 'rgba(200,168,75,0.22)' },
  { border: '#8e793e', bg: 'rgba(142,121,62,0.28)' },
  { border: '#d4b896', bg: 'rgba(212,184,150,0.25)' },
  { border: '#b8956a', bg: 'rgba(184,149,106,0.25)' },
]

export function getHighlightColor(index = 0) {
  return COLORS[index % COLORS.length]
}
