/**
 * Local mirror of the BrandTheme type from @nadeemmurtaza/design-system
 * to avoid the private GitHub Packages dependency during local development.
 */

export interface BrandTheme {
  colors: {
    neutral: Record<number, string>;
    accent: { DEFAULT: string; hover: string };
    white: string;
    surface: string;
    overlay: string;
    inverse: string;
    onInverse: string;
    scrim: string;
    star: string;
    feedback: { positive: string; negative: string };
    chart: string[];
  };
  colorsDark: {
    neutral: Record<number, string>;
    accent: { DEFAULT: string; hover: string };
    accentInk: { DEFAULT: string; hover: string };
    white: string;
    surface: string;
    overlay: string;
    inverse: string;
    onInverse: string;
    scrim: string;
    star: string;
    feedback: { positive: string; negative: string };
    chart: string[];
  };
  radii: { sharp: number; lg: number; pill: number };
  type: Record<string, { size: number; line: number }>;
  fonts: {
    googleFont: string;
    displayStack: string[];
    sansStack: string[];
  };
  space: Record<number, number>;
  size: {
    control: { sm: number; md: number; lg: number; xl: number };
    icon: { sm: number; md: number; lg: number };
    touch: { min: number; pos: number };
  };
  elevation: {
    light: { flat: string; raised: string; overlay: string; modal: string };
    dark: { flat: string; raised: string; overlay: string; modal: string };
  };
  layers: Record<string, number>;
  motion: {
    duration: { fast: number; normal: number };
    easing: { standard: number[] };
    distance: Record<string, any>;
    scale: Record<string, any>;
    stagger: { step: number; fine: number };
    speed: { read: number };
  };
}
