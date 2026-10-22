import { fft1d, fft2dMagnitudeShifted } from './fft';

describe('fft1d', () => {
  it('transforms a constant (DC-only) signal into energy entirely at bin 0', () => {
    const n = 16;
    const real = new Float64Array(n).fill(5);
    const imag = new Float64Array(n);

    fft1d(real, imag);

    expect(real[0]).toBeCloseTo(5 * n, 5);
    expect(imag[0]).toBeCloseTo(0, 5);
    for (let k = 1; k < n; k++) {
      expect(Math.hypot(real[k]!, imag[k]!)).toBeCloseTo(0, 5);
    }
  });

  it('transforms a pure sinusoid into a sharp peak at its own frequency bin', () => {
    const n = 32;
    const frequency = 5;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      real[i] = Math.cos((2 * Math.PI * frequency * i) / n);
    }

    fft1d(real, imag);

    const magnitudes = Array.from({ length: n }, (_, k) => Math.hypot(real[k]!, imag[k]!));
    // A real cosine at bin `frequency` produces two symmetric peaks: at
    // `frequency` and at n - frequency (the standard real-signal FFT mirror).
    const peakBins = magnitudes
      .map((magnitude, bin) => ({ magnitude, bin }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 2)
      .map((entry) => entry.bin)
      .sort((a, b) => a - b);

    expect(peakBins).toEqual([frequency, n - frequency]);
  });

  it('rejects a non-power-of-two length', () => {
    expect(() => fft1d(new Float64Array(10), new Float64Array(10))).toThrow();
  });
});

describe('fft2dMagnitudeShifted', () => {
  it('puts all the energy of a constant image at the shifted center (DC) bin', () => {
    const n = 16;
    const grid = Array.from({ length: n }, () => new Array(n).fill(3));

    const spectrum = fft2dMagnitudeShifted(grid);

    expect(spectrum[n / 2]![n / 2]!).toBeCloseTo(3 * n * n, 4);
    let offCenterEnergy = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (y !== n / 2 || x !== n / 2) {
          offCenterEnergy += spectrum[y]![x]!;
        }
      }
    }
    expect(offCenterEnergy).toBeCloseTo(0, 4);
  });

  it('produces a strong, spatially localized peak for a genuinely periodic (checkerboard-like) grid, unlike a smoothly varying gradient', () => {
    const n = 32;
    const periodic = Array.from({ length: n }, () =>
      Array.from({ length: n }, (_, x) => (Math.floor(x / 2) % 2 === 0 ? 0 : 255)),
    );
    const gradient = Array.from({ length: n }, () => Array.from({ length: n }, (_, x) => x * 8));

    const periodicSpectrum = fft2dMagnitudeShifted(periodic);
    const gradientSpectrum = fft2dMagnitudeShifted(gradient);

    const center = n / 2;
    const maxAwayFromDc = (spectrum: number[][]): number => {
      let max = 0;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (Math.hypot(x - center, y - center) > 3) {
            max = Math.max(max, spectrum[y]![x]!);
          }
        }
      }
      return max;
    };
    const meanAwayFromDc = (spectrum: number[][]): number => {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (Math.hypot(x - center, y - center) > 3) {
            sum += spectrum[y]![x]!;
            count++;
          }
        }
      }
      return sum / count;
    };

    const periodicPeakRatio = maxAwayFromDc(periodicSpectrum) / meanAwayFromDc(periodicSpectrum);
    const gradientPeakRatio = maxAwayFromDc(gradientSpectrum) / meanAwayFromDc(gradientSpectrum);

    expect(periodicPeakRatio).toBeGreaterThan(gradientPeakRatio * 3);
  });
});
