/**
 * nID login-ui's own brand VALUES, typed against @nadeemmurtaza/design-system's
 * BrandTheme contract. The engine (radius/space/motion math, contrast
 * checking, the Tailwind builder) lives in the shared package; this file is
 * the one place that owns nID's actual colours/radii/spacing. See
 * packages/design-system/README.md in core-newax for the split.
 *
 * Values below are unchanged from the previous hand-written globals.css --
 * this file documents and types them, it does not restyle the product.
 */
import type { BrandTheme } from '@nadeemmurtaza/design-system';

export const THEME: BrandTheme = {
  colors: {
    neutral: {
      50: '#ffffff',
      100: '#f8f9fb',
      200: '#dfe2e8',
      300: '#9aa1ad',
      400: '#5b6270',
      500: '#111318',
    },
    accent: { DEFAULT: '#2f6fed', hover: '#2a63d6' },
    white: '#ffffff',
    surface: '#f8f9fb',
    overlay: '#ffffff',
    inverse: '#111318',
    onInverse: '#ffffff',
    scrim: '#111318',
    star: '#d9a441',
    feedback: { positive: '#1a8a5f', negative: '#c4392b' },
    chart: ['#2f6fed'],
  },
  colorsDark: {
    neutral: {
      50: '#0e1013',
      100: '#16181d',
      200: '#2a2e36',
      300: '#9aa1ad',
      400: '#9aa1ad',
      500: '#e8eaee',
    },
    accent: { DEFAULT: '#2f6fed', hover: '#2a63d6' },
    accentInk: { DEFAULT: '#6ea1ff', hover: '#8fb6ff' },
    white: '#ffffff',
    surface: '#16181d',
    overlay: '#16181d',
    inverse: '#e8eaee',
    onInverse: '#0e1013',
    scrim: '#000000',
    star: '#d9a441',
    feedback: { positive: '#4fd39a', negative: '#ff7a68' },
    chart: ['#6ea1ff'],
  },
  radii: { sharp: 8, lg: 14, pill: 9999 },
  type: {
    micro: { size: 11, line: 16 },
    tiny: { size: 12, line: 16 },
    small: { size: 13, line: 18 },
    body: { size: 15, line: 22 },
    large: { size: 16, line: 24 },
    heading: { size: 19, line: 26 },
    title: { size: 22, line: 28 },
    display: { size: 28, line: 34 },
    metric: { size: 40, line: 44 },
  },
  fonts: {
    googleFont: 'Inter',
    displayStack: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
    sansStack: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  },
  space: { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 24, 7: 32, 8: 48, 9: 64 },
  size: {
    control: { sm: 32, md: 40, lg: 48, xl: 56 },
    icon: { sm: 16, md: 20, lg: 24 },
    touch: { min: 44, pos: 48 },
  },
  elevation: {
    light: {
      flat: 'none',
      raised: '0 1px 2px rgba(17, 19, 24, 0.05)',
      overlay: '0 8px 24px rgba(17, 19, 24, 0.08), 0 1px 2px rgba(17, 19, 24, 0.06)',
      modal: '0 8px 24px rgba(17, 19, 24, 0.08), 0 1px 2px rgba(17, 19, 24, 0.06)',
    },
    dark: {
      flat: 'none',
      raised: '0 1px 2px rgba(0, 0, 0, 0.3)',
      overlay: '0 8px 24px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)',
      modal: '0 8px 24px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)',
    },
  },
  layers: { base: 0, sticky: 10, dropdown: 20, overlay: 30, modal: 40, toast: 50 },
  motion: {
    duration: { fast: 100, normal: 150 },
    easing: { standard: [0.2, 0, 0, 1] },
    distance: {},
    scale: {},
    stagger: { step: 0, fine: 0 },
    speed: { read: 0 },
  },
};
