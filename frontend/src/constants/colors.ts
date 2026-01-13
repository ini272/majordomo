export const COLORS = {
  // Gold/Primary
  gold: "#d4af37",
  goldDarker: "#8b7a2f",

  // Parchment/Text
  parchment: "#c9b896",
  parchmentLight: "#e8dcc8",

  // Dark/Backgrounds
  dark: "#1a1a1a",
  darkPanel: "#0f0f0f",
  darkGradient1: "#0a0a0a",
  darkGradient2: "#1a0a2e",
  black: "#000000",

  // Brown/Muted
  brown: "#8b7355",
  brownLight: "#8b7355",

  // Red/Errors
  redDark: "#8b0000",
  redDarker: "#4a0000",
  redLight: "#ff6b6b",
  redBorder: "#8b0000",

  // Green/Success
  greenSuccess: "#5fb754",
  greenDark: "#1a3d1a",
  greenDarker: "#2a5d2a",
};

export const GRADIENTS = {
  background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkGradient1} 50%, ${COLORS.darkGradient2} 100%)`,
};

export const PARCHMENT_STYLES = {
  backgroundColor: "#2a2418",
  borderColor: "#d4af37",
  textColor: "#d4af37",
  backgroundImage: `
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(212, 175, 55, 0.03) 2px,
      rgba(212, 175, 55, 0.03) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(212, 175, 55, 0.02) 2px,
      rgba(212, 175, 55, 0.02) 4px
    )
  `,
  boxShadow: `inset 0 0 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)`,
  burnt: `
    radial-gradient(ellipse at 20% 50%, rgba(0, 0, 0, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(0, 0, 0, 0.2) 0%, transparent 50%)
  `,
};
