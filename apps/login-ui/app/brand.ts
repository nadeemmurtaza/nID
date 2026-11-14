/**
 * nID login-ui brand tokens — now mirroring Communicator's Intercom-style
 * design system so the identity provider shares the same visual language
 * as the rest of the platform.  Fin Orange accent, warm cream canvas,
 * sharp 4 px geometry, solid white cards with warm borders.
 */
import type { BrandTheme } from '../lib/brand-theme';

export const THEME: BrandTheme = {
  colors: {
    neutral: {
      50: '#ffffff',
      100: '#faf9f6',
      200: '#dedbd6',
      300: '#9a9590',
      400: '#6b6560',
      500: '#111111',
    },
    accent: { DEFAULT: '#ff5600', hover: '#e64e00' },
    white: '#ffffff',
    surface: '#faf9f6',
    overlay: '#ffffff',
    inverse: '#111111',
    onInverse: '#ffffff',
    scrim: '#111111',
    star: '#d9a441',
    feedback: { positive: '#16a34a', negative: '#dc2626' },
    chart: ['#ff5600', '#3b82f6', '#16a34a', '#ec4899', '#84cc16'],
  },
  colorsDark: {
    neutral: {
      50: '#111111',
      100: '#1a1a1a',
      200: '#2a2a2a',
      300: '#8b8580',
      400: '#9a9590',
      500: '#e8e4df',
    },
    accent: { DEFAULT: '#ff5600', hover: '#ff7a42' },
    accentInk: { DEFAULT: '#ff7a42', hover: '#ff9a6e' },
    white: '#ffffff',
    surface: '#1a1a1a',
    overlay: '#1a1a1a',
    inverse: '#e8e4df',
    onInverse: '#111111',
    scrim: '#000000',
    star: '#d9a441',
    feedback: { positive: '#4fd39a', negative: '#ff7a68' },
    chart: ['#ff7a42'],
  },
  radii: { sharp: 4, lg: 8, pill: 9999 },
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
      raised: '0 1px 2px rgba(0, 0, 0, 0.05)',
      overlay: '0 4px 12px rgba(0, 0, 0, 0.08)',
      modal: '0 12px 48px rgba(0, 0, 0, 0.12)',
    },
    dark: {
      flat: 'none',
      raised: '0 1px 2px rgba(0, 0, 0, 0.3)',
      overlay: '0 4px 12px rgba(0, 0, 0, 0.45)',
      modal: '0 12px 48px rgba(0, 0, 0, 0.5)',
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
