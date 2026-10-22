/**
 * A real, from-scratch iterative radix-2 Cooley-Tukey FFT — the standard
 * textbook algorithm, not a black box or an approximation. Used by
 * recapture-artifact.ts to look for periodic structure in an image (screen
 * pixel-grid moiré), which is fundamentally a frequency-domain question;
 * there's no honest way to answer it without an actual DFT.
 */

/** Mutates `real`/`imag` in place. Both arrays' length must be a power of two. */
export function fft1d(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error('fft1d requires a power-of-two length');
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imag[i], imag[j]] = [imag[j]!, imag[i]!];
    }
  }

  // Iterative butterfly passes.
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const angleStep = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const evenIndex = start + k;
        const oddIndex = start + k + halfSize;
        const oddRe = real[oddIndex]! * cos - imag[oddIndex]! * sin;
        const oddIm = real[oddIndex]! * sin + imag[oddIndex]! * cos;
        real[oddIndex] = real[evenIndex]! - oddRe;
        imag[oddIndex] = imag[evenIndex]! - oddIm;
        real[evenIndex] = real[evenIndex]! + oddRe;
        imag[evenIndex] = imag[evenIndex]! + oddIm;
      }
    }
  }
}

/**
 * A separable 2D FFT (1D FFT over every row, then over every column) of a
 * square power-of-two grid, returning the magnitude spectrum with the DC
 * term shifted to the center — the conventional layout for reasoning about
 * "distance from DC" the way an exclusion radius needs to.
 */
export function fft2dMagnitudeShifted(grid: number[][]): number[][] {
  const n = grid.length;

  const real: Float64Array[] = grid.map((row) => Float64Array.from(row));
  const imag: Float64Array[] = grid.map(() => new Float64Array(n));

  for (let y = 0; y < n; y++) {
    fft1d(real[y]!, imag[y]!);
  }

  for (let x = 0; x < n; x++) {
    const columnReal = new Float64Array(n);
    const columnImag = new Float64Array(n);
    for (let y = 0; y < n; y++) {
      columnReal[y] = real[y]![x]!;
      columnImag[y] = imag[y]![x]!;
    }
    fft1d(columnReal, columnImag);
    for (let y = 0; y < n; y++) {
      real[y]![x] = columnReal[y]!;
      imag[y]![x] = columnImag[y]!;
    }
  }

  const magnitude: number[][] = [];
  for (let y = 0; y < n; y++) {
    const row: number[] = [];
    for (let x = 0; x < n; x++) {
      row.push(Math.hypot(real[y]![x]!, imag[y]![x]!));
    }
    magnitude.push(row);
  }

  return fftshift(magnitude);
}

/** Swaps quadrants so the DC (0Hz) bin moves from [0][0] to the grid's center — standard spectrum-viewing convention. */
function fftshift(grid: number[][]): number[][] {
  const n = grid.length;
  const half = n / 2;
  const shifted: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const shiftedY = (y + half) % n;
      const shiftedX = (x + half) % n;
      shifted[shiftedY]![shiftedX] = grid[y]![x]!;
    }
  }
  return shifted;
}
