/**
 * ─────────────────────────────────────────────────────────────
 *  THEME CONFIGURATION — edit only this file to change the
 *  entire app's color palette, including component states.
 * ─────────────────────────────────────────────────────────────
 */

export const theme = {
  dark: {
    // Backgrounds
    bgBase:     '#181412',
    bgSurface:  '#1e1a16',
    bgElevated: '#24201c',
    bgInput:    '#24201c',

    // Borders
    borderSubtle: '#2e2a24',
    borderMid:    '#3a3028',

    // Text
    textPrimary:   '#e8d8a8',
    textSecondary: '#b8a882',
    textMuted:     '#7a6a50',
    textFaint:     '#5a4e3a',

    // Accent
    accent:       '#ad974f',
    accentHover:  '#c8a84b',
    accentSubtle: '#8e793e',
    accentBg:     'rgba(173,151,79,0.1)',
    accentBorder: 'rgba(173,151,79,0.27)',

    // Toast status colors
    toast: {
      success: { bg: '#1a2e1a', border: '#2d5a2d', color: '#86c986' },
      error:   { bg: '#2e1a1a', border: '#5a2d2d', color: '#c98686' },
      info:    { bg: '#2a241e', border: 'rgba(173,151,79,0.27)', color: '#ad974f' },
    },
  },

  light: {
    // Backgrounds
    bgBase:     '#f7f2e8',
    bgSurface:  '#fdfaf2',
    bgElevated: '#faf6ec',
    bgInput:    '#faf6ec',

    // Borders
    borderSubtle: '#ddd4b0',
    borderMid:    '#c8ba90',

    // Text
    textPrimary:   '#231f20',
    textSecondary: '#5a4e38',
    textMuted:     '#a09070',
    textFaint:     '#c8ba90',

    // Accent
    accent:       '#8e793e',
    accentHover:  '#ad974f',
    accentSubtle: '#7a6a32',
    accentBg:     'rgba(142,121,62,0.1)',
    accentBorder: 'rgba(142,121,62,0.3)',

    // Toast status colors
    toast: {
      success: { bg: '#edf7ed', border: '#a8d5a8', color: '#2d6a2d' },
      error:   { bg: '#fdf0f0', border: '#e0a0a0', color: '#8b2020' },
      info:    { bg: '#faf3e0', border: 'rgba(142,121,62,0.3)', color: '#8e793e' },
    },
  },
}

/**
 * Highlight colors for PDF evidence overlays.
 * Index 0 = primary match, rest = secondary.
 */
export const highlightColors = [
  { border: '#ad974f', bg: 'rgba(173,151,79,0.28)' },
  { border: '#c8a84b', bg: 'rgba(200,168,75,0.22)' },
  { border: '#8e793e', bg: 'rgba(142,121,62,0.28)' },
  { border: '#d4b896', bg: 'rgba(212,184,150,0.25)' },
  { border: '#b8956a', bg: 'rgba(184,149,106,0.25)' },
]
